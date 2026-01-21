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
    let score = 0;
    let weights = 0;

    // OCR front quality (60% - increased weight)
    if (frontOcr?.data?.confidence) {
      score += frontOcr.data.confidence * 0.6;
      weights += 0.6;
    }

    // OCR back quality (40% - increased weight)
    if (backOcr?.data?.confidence) {
      score += backOcr.data.confidence * 0.4;
      weights += 0.4;
    }

    return weights > 0 ? score / weights : 0.5; // Default to 50% if no data
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

    if (frontOcr?.data) {
      data.fullName = frontOcr.data.name || frontOcr.data.fullName;
      data.idNumber = frontOcr.data.id || frontOcr.data.idNumber;
      data.dateOfBirth = frontOcr.data.dob || frontOcr.data.dateOfBirth;
    }

    if (backOcr?.data) {
      data.address = backOcr.data.address || backOcr.data.permanentAddress;
      data.issueDate = backOcr.data.issueDate;
      data.expiryDate = backOcr.data.expiryDate;
    }

    return data;
  }

  /**
   * Detect issues with verification (OCR only)
   */
  private detectIssuesOcrOnly(frontOcr: any, backOcr: any): string[] {
    const issues: string[] = [];

    // Check OCR quality
    if (frontOcr?.data?.confidence < 0.7) {
      issues.push('ID card front image quality is low');
    }

    if (backOcr?.data?.confidence < 0.7) {
      issues.push('ID card back image quality is low');
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
