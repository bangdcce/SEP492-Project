import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { fptAiConfig } from '../../config/fpt-ai.config';
import FormData = require('form-data');

/**
 * FPT.AI eKYC Service
 * Automated KYC verification using FPT.AI Vision API
 */

export interface FptAiVerificationResult {
  success: boolean;
  confidence: number; // 0-1 (0-100%)
  decision: 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'AUTO_REJECTED';
  extractedData?: {
    fullName?: string;
    idNumber?: string;
    dateOfBirth?: string;
    address?: string;
    issueDate?: string;
    expiryDate?: string;
  };
  faceMatch?: {
    matched: boolean;
    similarity: number; // 0-1
  };
  issues?: string[]; // List of problems detected
  rawResponse?: any;
}

@Injectable()
export class FptAiService {
  private readonly logger = new Logger(FptAiService.name);
  private readonly apiUrl = fptAiConfig.apiUrl;
  private readonly apiKey = fptAiConfig.apiKey;

  /**
   * Verify KYC documents using FPT.AI
   * @param idCardFront - Front side of ID card buffer
   * @param idCardBack - Back side of ID card buffer  
   * @param selfie - Selfie photo buffer
   * @returns Verification result with decision
   */
  async verifyKyc(
    idCardFront: Buffer,
    idCardBack: Buffer,
    selfie: Buffer,
  ): Promise<FptAiVerificationResult> {
    if (!fptAiConfig.enabled) {
      this.logger.warn('FPT.AI is disabled, using mock verification');
      return this.mockVerification();
    }

    if (!this.apiKey) {
      this.logger.error('FPT.AI API key not configured');
      return this.mockVerification();
    }

    try {
      // Step 1: OCR ID card front
      console.log('  🔍 Step 1/3: OCR scanning ID card front...');
      const frontOcr = await this.ocrIdCard(idCardFront, 'front');
      console.log('  ✓ Front OCR completed');
      
      // Step 2: OCR ID card back
      console.log('  🔍 Step 2/3: OCR scanning ID card back...');
      const backOcr = await this.ocrIdCard(idCardBack, 'back');
      console.log('  ✓ Back OCR completed');
      
      // Step 3: Selfie (stored for manual review, not AI-processed)
      console.log('  📸 Step 3/3: Selfie stored for manual review');
      console.log('  ✓ All documents processed\n');
      
      console.log('  📊 Analyzing OCR data quality...');
      
      // Note: Selfie is uploaded but NOT verified by AI
      // FPT.AI only has OCR API, no face comparison API
      // Selfie will be stored for manual admin review
      
      // Step 3: Calculate confidence (OCR only)
      const confidence = this.calculateConfidenceOcrOnly(frontOcr, backOcr);
      
      // Step 4: Make decision
      const decision = this.makeDecision(confidence);
      
      // Step 5: Extract data
      const extractedData = this.extractData(frontOcr, backOcr);
      
      // Step 6: Detect issues (OCR only)
      const issues = this.detectIssuesOcrOnly(frontOcr, backOcr);

      return {
        success: true,
        confidence,
        decision,
        extractedData,
        faceMatch: {
          matched: false, // No AI face comparison available
          similarity: 0,
        },
        issues: issues.length > 0 ? issues : undefined,
        rawResponse: {
          frontOcr,
          backOcr,
        },
      };
    } catch (error) {
      this.logger.error('FPT.AI verification failed:', error);
      console.error('❌ [FPT.AI ERROR]', error.response?.data || error.message);
      console.error('   Status:', error.response?.status);
      console.error('   API URL:', this.apiUrl);
      console.error('   Has API Key:', !!this.apiKey);
      
      // Fallback to pending review if AI fails
      return {
        success: false,
        confidence: 0.5,
        decision: 'PENDING_REVIEW',
        issues: ['AI verification service temporarily unavailable'],
      };
    }
  }

  /**
   * OCR ID card using FPT.AI Vietnam ID Recognition API
   * Endpoint: POST https://api.fpt.ai/vision/idr/vnm/
   */
  private async ocrIdCard(imageBuffer: Buffer, side: 'front' | 'back'): Promise<any> {
    const formData = new FormData();
    formData.append('image', imageBuffer, { 
      filename: `id-${side}.jpg`,
      contentType: 'image/jpeg'
    });

    console.log(`  📤 Sending ${side} image to FPT.AI (${imageBuffer.length} bytes)...`);

    const response = await axios.post(
      this.apiUrl, // POST https://api.fpt.ai/vision/idr/vnm
      formData,
      {
        headers: {
          'api-key': this.apiKey, // Header: api-key (as per cURL command)
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30s timeout
      }
    );

    console.log(`  ✅ FPT.AI response for ${side}:`, response.data.errorCode === 0 ? 'SUCCESS' : `ERROR ${response.data.errorCode}`);

    return response.data;
  }

  /**
   * Compare faces using FPT.AI Face Comparison API
   * Endpoint: POST https://api.fpt.ai/vision/face/compare
   */
  private async compareFaces(selfie: Buffer, idCardFront: Buffer): Promise<any> {
    const formData = new FormData();
    formData.append('face1', selfie, { filename: 'selfie.jpg' });
    formData.append('face2', idCardFront, { filename: 'id-photo.jpg' });

    const response = await axios.post(
      fptAiConfig.faceCompareUrl, // POST https://api.fpt.ai/vision/face/compare
      formData,
      {
        headers: {
          'api-key': this.apiKey, // Header: api-key (as per cURL command)
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    return response.data;
  }

  /**
   * Calculate confidence score (OCR only - no face comparison)
   * FPT.AI only provides OCR, not face matching
   */
  private calculateConfidenceOcrOnly(frontOcr: any, backOcr: any): number {
    const frontData = this.normalizeOcrData(frontOcr);
    const backData = this.normalizeOcrData(backOcr);
    const frontConfidence = this.getOcrConfidence(frontData);
    const backConfidence = this.getOcrConfidence(backData);

    if (frontConfidence !== null || backConfidence !== null) {
      let score = 0;
      let weights = 0;
      if (frontConfidence !== null) {
        score += frontConfidence * 0.6;
        weights += 0.6;
      }
      if (backConfidence !== null) {
        score += backConfidence * 0.4;
        weights += 0.4;
      }
      return weights > 0 ? score / weights : 0.5;
    }

    return this.estimateConfidence(frontData, backData);
  }

  /**
   * DEPRECATED: Face comparison not available in FPT.AI
   * Kept for future integration with other services
   */
  private calculateConfidence(frontOcr: any, backOcr: any, faceMatch: any): number {
    let score = 0;
    let weights = 0;

    // OCR front quality (40%)
    if (frontOcr?.data?.confidence) {
      score += frontOcr.data.confidence * 0.4;
      weights += 0.4;
    }

    // OCR back quality (20%)
    if (backOcr?.data?.confidence) {
      score += backOcr.data.confidence * 0.2;
      weights += 0.2;
    }

    // Face match (40%)
    if (faceMatch?.similarity !== undefined) {
      score += faceMatch.similarity * 0.4;
      weights += 0.4;
    }

    return weights > 0 ? score / weights : 0.5; // Default to 50% if no data
  }

  /**
   * Make decision based on confidence
   */
  private makeDecision(confidence: number): 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'AUTO_REJECTED' {
    if (confidence >= fptAiConfig.autoApproveThreshold) {
      return 'AUTO_APPROVED';
    } else if (confidence >= fptAiConfig.adminReviewThreshold) {
      return 'PENDING_REVIEW';
    } else {
      return 'AUTO_REJECTED';
    }
  }

  /**
   * Extract structured data from OCR results
   */
  private extractData(frontOcr: any, backOcr: any): any {
    const data: any = {};
    const frontData = this.normalizeOcrData(frontOcr);
    const backData = this.normalizeOcrData(backOcr);

    data.fullName = this.getOcrField(frontData, [
      'name',
      'fullName',
      'full_name',
      'fullNameOnDocument',
      'hoTen',
      'ho_ten',
    ]);
    data.idNumber = this.getOcrField(frontData, [
      'id',
      'idNumber',
      'id_number',
      'idNo',
      'id_no',
      'identityNumber',
      'identity_number',
      'so',
      'so_cccd',
      'socccd',
    ]);
    data.dateOfBirth = this.getOcrField(frontData, [
      'dob',
      'dateOfBirth',
      'date_of_birth',
      'birthDate',
      'birthday',
    ]);
    data.address = this.getOcrField(backData, [
      'address',
      'permanentAddress',
      'permanent_address',
      'residence',
    ]);
    data.issueDate = this.getOcrField(backData, [
      'issueDate',
      'issue_date',
      'issueDateTime',
    ]);
    data.expiryDate = this.getOcrField(backData, [
      'expiryDate',
      'expiry_date',
      'expireDate',
    ]);

    return data;
  }

  /**
   * Detect issues with verification (OCR only)
   */
  private detectIssuesOcrOnly(frontOcr: any, backOcr: any): string[] {
    const issues: string[] = [];
    const frontData = this.normalizeOcrData(frontOcr);
    const backData = this.normalizeOcrData(backOcr);
    const hasName = !!this.getOcrField(frontData, [
      'name',
      'fullName',
      'full_name',
      'fullNameOnDocument',
      'hoTen',
      'ho_ten',
    ]);
    const hasId = !!this.getOcrField(frontData, [
      'id',
      'idNumber',
      'id_number',
      'idNo',
      'id_no',
      'identityNumber',
      'identity_number',
      'so',
      'so_cccd',
      'socccd',
    ]);

    // Check OCR quality
    const frontConfidence = this.getOcrConfidence(frontData);
    const backConfidence = this.getOcrConfidence(backData);

    if (frontConfidence !== null && frontConfidence < 0.7) {
      issues.push('ID card front image quality is low');
    }

    if (backConfidence !== null && backConfidence < 0.7) {
      issues.push('ID card back image quality is low');
    }

    // Check for missing data
    if (!hasName) {
      issues.push('Could not extract name from ID card');
    }

    if (!hasId) {
      issues.push('Could not extract ID number from ID card');
    }

    return issues;
  }

  private normalizeOcrData(ocr: any): Record<string, any> {
    if (!ocr) return {};
    const data = ocr.data ?? ocr;

    if (Array.isArray(data)) {
      return this.mapKeyValueArray(data);
    }

    if (data?.data) {
      if (Array.isArray(data.data)) {
        return this.mapKeyValueArray(data.data);
      }
      if (typeof data.data === 'object') {
        return data.data;
      }
    }

    return data || {};
  }

  private mapKeyValueArray(items: any[]): Record<string, any> {
    if (!items.length) return {};
    const mapped: Record<string, any> = {};
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const key = item.type || item.field || item.label || item.key;
      const value = item.value ?? item.text ?? item.result;
      if (key && value !== undefined) {
        mapped[key] = value;
      }
    }
    if (Object.keys(mapped).length > 0) {
      return mapped;
    }
    return items[0] || {};
  }

  private normalizeKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private getOcrField(data: any, keys: string[]): string | undefined {
    if (!data || typeof data !== 'object') return undefined;

    for (const key of keys) {
      const value = data[key];
      if (value !== undefined && value !== null && value !== '') {
        return typeof value === 'object' ? value.value ?? value.text ?? String(value) : value;
      }
    }

    const normalizedLookup = new Map<string, any>();
    for (const [rawKey, rawValue] of Object.entries(data)) {
      normalizedLookup.set(this.normalizeKey(rawKey), rawValue);
    }

    for (const key of keys) {
      const normalized = this.normalizeKey(key);
      if (normalizedLookup.has(normalized)) {
        const value = normalizedLookup.get(normalized);
        if (value !== undefined && value !== null && value !== '') {
          return typeof value === 'object' ? value.value ?? value.text ?? String(value) : value;
        }
      }
    }

    const regexes = keys.map((key) => new RegExp(this.normalizeKey(key), 'i'));
    for (const [rawKey, rawValue] of Object.entries(data)) {
      const normalized = this.normalizeKey(rawKey);
      if (regexes.some((regex) => regex.test(normalized))) {
        if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
          return typeof rawValue === 'object'
            ? rawValue.value ?? rawValue.text ?? String(rawValue)
            : rawValue;
        }
      }
    }

    return undefined;
  }

  private getOcrConfidence(data: any): number | null {
    if (!data || typeof data !== 'object') return null;
    const raw =
      data.confidence ??
      data.ocr_confidence ??
      data.quality ??
      data.confidenceScore ??
      data.confidence_score ??
      data.score;
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof numeric === 'number' && !Number.isNaN(numeric)) {
      return numeric;
    }
    return null;
  }

  private estimateConfidence(frontData: any, backData: any): number {
    const hasName = !!this.getOcrField(frontData, [
      'name',
      'fullName',
      'full_name',
      'fullNameOnDocument',
      'hoTen',
      'ho_ten',
    ]);
    const hasId = !!this.getOcrField(frontData, [
      'id',
      'idNumber',
      'id_number',
      'idNo',
      'id_no',
      'identityNumber',
      'identity_number',
      'so',
      'so_cccd',
      'socccd',
    ]);
    const hasDob = !!this.getOcrField(frontData, [
      'dob',
      'dateOfBirth',
      'date_of_birth',
      'birthDate',
      'birthday',
    ]);
    const hasAddress = !!this.getOcrField(backData, [
      'address',
      'permanentAddress',
      'permanent_address',
      'residence',
    ]);

    if (hasName && hasId) return 0.85;
    if (hasName || hasId) return 0.6;
    if (hasDob || hasAddress) return 0.5;
    return 0.4;
  }

  /**
   * DEPRECATED: Detect issues including face match
   * Kept for future integration
   */
  private detectIssues(frontOcr: any, backOcr: any, faceMatch: any): string[] {
    const issues: string[] = [];

    // Check OCR quality
    if (frontOcr?.data?.confidence < 0.7) {
      issues.push('ID card front image quality is low');
    }

    if (backOcr?.data?.confidence < 0.7) {
      issues.push('ID card back image quality is low');
    }

    // Check face match
    if (faceMatch && !faceMatch.isMatch) {
      issues.push('Face does not match ID card photo');
    }

    if (faceMatch?.similarity < 0.7) {
      issues.push('Low face similarity score');
    }

    // Check for missing data
    if (!frontOcr?.data?.name) {
      issues.push('Could not extract name from ID card');
    }

    if (!frontOcr?.data?.id) {
      issues.push('Could not extract ID number from ID card');
    }

    return issues;
  }

  /**
   * Mock verification for testing (when API key not available)
   */
  private mockVerification(): FptAiVerificationResult {
    // Simulate random confidence for testing
    const confidence = 0.7 + Math.random() * 0.3; // 70-100%
    
    return {
      success: true,
      confidence,
      decision: this.makeDecision(confidence),
      extractedData: {
        fullName: 'NGUYỄN VĂN A (Mock)',
        idNumber: '001234567890 (Mock)',
        dateOfBirth: '01/01/1990 (Mock)',
      },
      faceMatch: {
        matched: confidence > 0.8,
        similarity: confidence,
      },
      issues: confidence < 0.9 ? ['Mock verification - replace with real FPT.AI'] : undefined,
    };
  }
}
