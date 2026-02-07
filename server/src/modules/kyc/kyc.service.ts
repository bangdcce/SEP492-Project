import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycVerificationEntity, KycStatus } from '../../database/entities/kyc-verification.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { SubmitKycDto, RejectKycDto } from './dto';
import { uploadEncryptedFile, getSignedUrl, downloadWithWatermark } from '../../common/utils/supabase-storage.util';
import { hashDocumentNumber } from '../../common/utils/encryption.util';
import { FptAiService } from '../../common/services/fpt-ai.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycVerificationEntity)
    private kycRepo: Repository<KycVerificationEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(AuditLogEntity)
    private auditLogRepo: Repository<AuditLogEntity>,
    private fptAiService: FptAiService,
  ) {}

  /**
   * User submit KYC verification
   * Flow: AI Verification → Upload to Supabase → Auto-approve/reject/review
   */
  async submitKyc(
    userId: string,
    dto: SubmitKycDto,
    files: {
      idCardFront: MulterFile;
      idCardBack: MulterFile;
      selfie: MulterFile;
    },
  ) {
    // Check if user already has pending or approved KYC
    const existingKyc = await this.kycRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (existingKyc && existingKyc.status === KycStatus.PENDING) {
      throw new BadRequestException('You already have a pending KYC verification');
    }

    if (existingKyc && existingKyc.status === KycStatus.APPROVED) {
      throw new BadRequestException('Your KYC is already verified');
    }

    // Validate files
    if (!files.idCardFront || !files.idCardBack || !files.selfie) {
      throw new BadRequestException('All documents are required: ID card front, back, and selfie');
    }

    // Step 1: AI Verification BEFORE uploading
    const aiVerification = await this.fptAiService.verifyKyc(
      files.idCardFront.buffer,
      files.idCardBack.buffer,
      files.selfie.buffer,
    );

    // Step 2: Validate user input against AI extracted data
    const dataValidation = this.validateDataMatch(dto, aiVerification.extractedData);
    
    // Combine AI issues with data validation issues
    const allIssues = [
      ...(aiVerification.issues || []),
      ...dataValidation.issues,
    ];

    // Step 3: Determine KYC status based on AI decision AND data matching
    let kycStatus: KycStatus;
    let autoApproved = false;
    const hasUnreadableIssue = allIssues.some(issue =>
      /could not extract|cannot extract|unable to extract/i.test(issue),
    );
    
    // Critical mismatch = auto-reject or manual review
    if (dataValidation.criticalMismatch) {
      kycStatus = KycStatus.PENDING; // Send to admin for review
      allIssues.unshift('⚠️ CRITICAL: User-entered data does not match ID card');
    } else if (aiVerification.decision === 'AUTO_APPROVED' && dataValidation.matchScore >= 0.8) {
      // Only auto-approve if both AI and data match are good
      kycStatus = KycStatus.APPROVED;
      autoApproved = true;
    } else if (aiVerification.decision === 'AUTO_REJECTED' && !hasUnreadableIssue) {
      kycStatus = KycStatus.REJECTED;
    } else {
      kycStatus = KycStatus.PENDING; // Needs admin review
    }

    // Step 3: Upload encrypted files to Supabase Storage
    const [documentFrontUrl, documentBackUrl, selfieUrl] = await Promise.all([
      uploadEncryptedFile(files.idCardFront.buffer, userId, 'id-front', files.idCardFront.mimetype),
      uploadEncryptedFile(files.idCardBack.buffer, userId, 'id-back', files.idCardBack.mimetype),
      uploadEncryptedFile(files.selfie.buffer, userId, 'selfie', files.selfie.mimetype),
    ]);

    // Hash document number for privacy
    const documentNumberHash = hashDocumentNumber(dto.documentNumber);

    // Step 4: Create KYC record (store hashed document number + Supabase paths + AI results)
    const kyc = this.kycRepo.create({
      userId,
      fullNameOnDocument: dto.fullNameOnDocument,
      documentNumber: documentNumberHash, // Store hash instead of plain text
      documentType: dto.documentType,
      dateOfBirth: new Date(dto.dateOfBirth),
      documentExpiryDate: dto.documentExpiryDate ? new Date(dto.documentExpiryDate) : undefined,
      documentFrontUrl, // Supabase storage path (encrypted)
      documentBackUrl,
      selfieUrl,
      status: kycStatus,
      rejectionReason: allIssues.length > 0 ? allIssues.join(', ') : undefined, // Store all issues
    });

    const savedKyc = await this.kycRepo.save(kyc);

    // Step 5: If auto-approved by AI, update user verification status immediately
    if (autoApproved) {
      await this.userRepo.update(userId, { isVerified: true });
    }

    // Generate signed URLs for immediate response (expire in 1 hour)
    const [frontSignedUrl, backSignedUrl, selfieSignedUrl] = await Promise.all([
      getSignedUrl(documentFrontUrl, 3600),
      getSignedUrl(documentBackUrl, 3600),
      getSignedUrl(selfieUrl, 3600),
    ]);

    return {
      ...savedKyc,
      documentFrontUrl: frontSignedUrl,
      documentBackUrl: backSignedUrl,
      selfieUrl: selfieSignedUrl,
      aiVerification: {
        decision: aiVerification.decision,
        confidence: aiVerification.confidence,
        // Redact PII from extractedData - only show field extraction status
        extractedData: aiVerification.extractedData ? {
          fullName: aiVerification.extractedData.fullName ? '[EXTRACTED]' : undefined,
          idNumber: aiVerification.extractedData.idNumber ? '[EXTRACTED]' : undefined,
          dateOfBirth: aiVerification.extractedData.dateOfBirth ? '[EXTRACTED]' : undefined,
          address: aiVerification.extractedData.address ? '[EXTRACTED]' : undefined,
        } : undefined,
        issues: aiVerification.issues,
      },
      dataValidation: {
        matchScore: dataValidation.matchScore,
        criticalMismatch: dataValidation.criticalMismatch,
        issues: dataValidation.issues,
      },
    };
  }

  /**
   * Get user's KYC status
   */
  async getMyKyc(userId: string) {
    const kyc = await this.kycRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (!kyc) {
      return {
        status: 'NOT_STARTED',
        message: 'You have not submitted KYC verification yet',
      };
    }

    // Generate fresh signed URLs
    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      getSignedUrl(kyc.documentFrontUrl, 3600),
      getSignedUrl(kyc.documentBackUrl, 3600),
      getSignedUrl(kyc.selfieUrl, 3600),
    ]);

    // Redact PII from user-facing response - only show status info
    return {
      id: kyc.id,
      userId: kyc.userId,
      status: kyc.status,
      documentType: kyc.documentType,
      documentFrontUrl: frontUrl,
      documentBackUrl: backUrl,
      selfieUrl: selfieUrl,
      // Mask sensitive fields
      fullNameOnDocument: kyc.fullNameOnDocument ? '[SUBMITTED]' : undefined,
      documentNumber: kyc.documentNumber ? '[SUBMITTED]' : undefined,
      dateOfBirth: kyc.dateOfBirth ? '[SUBMITTED]' : undefined,
      address: kyc.address ? '[SUBMITTED]' : undefined,
      // Include non-sensitive metadata
      rejectionReason: kyc.rejectionReason,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      reviewedAt: kyc.reviewedAt,
    };
  }

  /**
   * Admin: Get all KYC submissions with filters
   * Generate fresh signed URLs for each item
   */
  async getAllKyc(status?: KycStatus, page = 1, limit = 20) {
    const query = this.kycRepo
      .createQueryBuilder('kyc')
      .leftJoinAndSelect('kyc.user', 'user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('kyc.reviewer', 'reviewer');

    if (status) {
      query.where('kyc.status = :status', { status });
    }

    query
      .orderBy('kyc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await query.getManyAndCount();

    // Generate fresh signed URLs for all items
    const itemsWithSignedUrls = await Promise.all(
      items.map(async (kyc) => {
        const [frontUrl, backUrl, selfieUrl] = await Promise.all([
          getSignedUrl(kyc.documentFrontUrl, 3600),
          getSignedUrl(kyc.documentBackUrl, 3600),
          getSignedUrl(kyc.selfieUrl, 3600),
        ]);

        return {
          ...kyc,
          user: kyc.user
            ? {
                ...kyc.user,
                avatarUrl: kyc.user.profile?.avatarUrl,
              }
            : kyc.user,
          documentFrontUrl: frontUrl,
          documentBackUrl: backUrl,
          selfieUrl: selfieUrl,
        };
      })
    );

    return {
      items: itemsWithSignedUrls,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin/Staff: Get KYC by ID WITH WATERMARK
   * CRITICAL: Logs access + applies forensic watermark
   * Uses existing audit_logs table
   */
  async getKycByIdWithWatermark(
    id: string,
    reviewerId: string,
    reviewerEmail: string,
    reviewerRole: 'ADMIN' | 'STAFF',
    ipAddress: string,
    sessionId: string,
    userAgent: string,
    reason?: string,
    reasonDetails?: string,
  ) {
    const kyc = await this.kycRepo.findOne({
      where: { id },
      relations: ['user', 'user.profile', 'reviewer'],
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    // Generate unique watermark ID for traceability
    const watermarkId = uuidv4();
    const timestamp = new Date();

    // Log access using existing audit_logs table
    const auditLog = this.auditLogRepo.create({
      actorId: reviewerId,
      action: 'VIEW_KYC_WITH_WATERMARK',
      entityType: 'KycVerification',
      entityId: id,
      ipAddress,
      userAgent,
      afterData: {
        // KYC-specific metadata in JSONB
        reviewerEmail,
        reviewerRole,
        sessionId,
        watermarkId,
        watermarkApplied: true,
        accessedImages: ['front', 'back', 'selfie'],
        reason: reason || 'ROUTINE_REVIEW',
        reasonDetails,
        kycStatus: kyc.status,
        userId: kyc.userId,
      },
    });

    await this.auditLogRepo.save(auditLog);

    // Download and apply watermark to all images
    const watermarkOptions = {
      reviewerEmail,
      reviewerRole,
      ipAddress,
      sessionId,
      timestamp,
      kycId: id,
    };

    const [frontBuffer, backBuffer, selfieBuffer] = await Promise.all([
      downloadWithWatermark(kyc.documentFrontUrl, watermarkOptions),
      downloadWithWatermark(kyc.documentBackUrl, watermarkOptions),
      downloadWithWatermark(kyc.selfieUrl, watermarkOptions),
    ]);

    // Convert buffers to base64 for frontend display
    return {
      ...kyc,
      user: kyc.user
        ? {
            ...kyc.user,
            avatarUrl: kyc.user.profile?.avatarUrl,
          }
        : kyc.user,
      documentFrontUrl: `data:image/jpeg;base64,${frontBuffer.toString('base64')}`,
      documentBackUrl: `data:image/jpeg;base64,${backBuffer.toString('base64')}`,
      selfieUrl: `data:image/jpeg;base64,${selfieBuffer.toString('base64')}`,
      watermarkInfo: {
        watermarkId,
        reviewerEmail,
        timestamp: timestamp.toISOString(),
        warning: 'CONFIDENTIAL - This document contains forensic watermark. Any unauthorized distribution will be traced.',
      },
      auditLog: {
        id: auditLog.id,
        loggedAt: auditLog.createdAt,
      },
    };
  }

  /**
   * Admin: Get KYC by ID (legacy - without watermark)
   * DEPRECATED: Use getKycByIdWithWatermark instead
   */
  async getKycById(id: string) {
    const kyc = await this.kycRepo.findOne({
      where: { id },
      relations: ['user', 'user.profile', 'reviewer'],
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    // Generate fresh signed URLs
    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      getSignedUrl(kyc.documentFrontUrl, 3600),
      getSignedUrl(kyc.documentBackUrl, 3600),
      getSignedUrl(kyc.selfieUrl, 3600),
    ]);

    return {
      ...kyc,
      user: kyc.user
        ? {
            ...kyc.user,
            avatarUrl: kyc.user.profile?.avatarUrl,
          }
        : kyc.user,
      documentFrontUrl: frontUrl,
      documentBackUrl: backUrl,
      selfieUrl: selfieUrl,
    };
  }

  /**
   * Admin: Approve KYC
   */
  async approveKyc(id: string, adminId: string) {
    const kyc = await this.kycRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    if (kyc.status !== KycStatus.PENDING) {
      throw new BadRequestException('Only pending KYC can be approved');
    }

    kyc.status = KycStatus.APPROVED;
    kyc.reviewedBy = adminId;
    kyc.reviewedAt = new Date();

    await this.kycRepo.save(kyc);

    // Update user's isVerified status
    await this.userRepo.update(kyc.userId, { isVerified: true });

    return kyc;
  }

  /**
   * Admin: Reject KYC
   */
  async rejectKyc(id: string, adminId: string, dto: RejectKycDto) {
    const kyc = await this.kycRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!kyc) {
      throw new NotFoundException('KYC verification not found');
    }

    if (kyc.status !== KycStatus.PENDING) {
      throw new BadRequestException('Only pending KYC can be rejected');
    }

    const reason = dto.rejectionReason?.trim();
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    kyc.status = KycStatus.REJECTED;
    kyc.rejectionReason = reason;
    kyc.reviewedBy = adminId;
    kyc.reviewedAt = new Date();

    await this.kycRepo.save(kyc);

    return kyc;
  }

  /**
   * Check if user has verified KYC
   */
  async hasVerifiedKyc(userId: string): Promise<boolean> {
    const kyc = await this.kycRepo.findOne({
      where: { userId, status: KycStatus.APPROVED },
    });

    return !!kyc;
  }

  // ============================================================
  // DATA MATCHING VALIDATION - Compare user input with AI OCR
  // ============================================================

  /**
   * Normalize string for comparison (remove accents, lowercase, trim)
   */
  private normalizeString(str: string | undefined | null): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese accents
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove special chars
      .trim();
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    // Levenshtein distance-based similarity for typos
    const len1 = s1.length;
    const len2 = s2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;

    // Simple character match ratio
    let matches = 0;
    const shorter = len1 < len2 ? s1 : s2;
    const longer = len1 < len2 ? s2 : s1;
    
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        matches++;
      }
    }

    // Also check if one string contains the other
    if (longer.includes(shorter) || shorter.includes(longer)) {
      return 0.9;
    }

    return matches / maxLen;
  }

  /**
   * Normalize date to YYYY-MM-DD format for comparison
   * Handle Vietnamese DD/MM/YYYY format explicitly before falling back to ISO
   */
  private normalizeDateString(dateStr: string | undefined | null): string {
    if (!dateStr) return '';
    
    try {
      const trimmed = dateStr.trim();
      
      // 1. Handle DD/MM/YYYY or DD-MM-YYYY format (common in Vietnam) FIRST
      const vnMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (vnMatch) {
        const [, day, month, year] = vnMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // 2. Handle YYYY-MM-DD (ISO format)
      const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // 3. Handle YYYY/MM/DD
      const isoSlashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (isoSlashMatch) {
        const [, year, month, day] = isoSlashMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // 4. Only try Date parsing for ISO-like formats (avoid MM/DD/YYYY ambiguity)
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }

      return trimmed;
    } catch {
      return dateStr || '';
    }
  }

  /**
   * Validate user input against AI extracted data
   * Returns issues list and match score
   */
  private validateDataMatch(
    dto: SubmitKycDto,
    extractedData: any,
  ): { issues: string[]; matchScore: number; criticalMismatch: boolean } {
    const issues: string[] = [];
    let totalChecks = 0;
    let matches = 0;
    let criticalMismatch = false;

    // If no extracted data available, cannot validate - require manual review
    if (!extractedData || (!extractedData.fullName && !extractedData.idNumber && !extractedData.dateOfBirth)) {
      issues.push('Cannot validate: AI did not extract data from documents. Manual review required.');
      return {
        issues,
        matchScore: 0.5, // Low score to trigger manual review
        criticalMismatch: false, // Not a mismatch, just unable to verify
      };
    }

    // 1. Compare Full Name (CRITICAL)
    if (extractedData?.fullName) {
      totalChecks++;
      const nameSimilarity = this.calculateSimilarity(
        dto.fullNameOnDocument,
        extractedData.fullName,
      );
      
      if (nameSimilarity >= 0.8) {
        matches++;
      } else if (nameSimilarity >= 0.6) {
        matches += 0.5;
        issues.push('Name partially matches with ID document');
      } else {
        criticalMismatch = true;
        issues.push('Name does not match ID document');
      }
    }

    // 2. Compare ID Number (CRITICAL)
    if (extractedData?.idNumber) {
      totalChecks++;
      const inputId = this.normalizeString(dto.documentNumber);
      const extractedId = this.normalizeString(extractedData.idNumber);
      
      if (inputId === extractedId) {
        matches++;
      } else if (inputId.includes(extractedId) || extractedId.includes(inputId)) {
        matches += 0.5;
        issues.push('ID number partially matches with ID document');
      } else {
        criticalMismatch = true;
        issues.push('ID number does not match ID document');
      }
    }

    // 3. Compare Date of Birth (CRITICAL)
    if (extractedData?.dateOfBirth) {
      totalChecks++;
      const inputDob = this.normalizeDateString(dto.dateOfBirth);
      const extractedDob = this.normalizeDateString(extractedData.dateOfBirth);
      
      if (inputDob === extractedDob) {
        matches++;
      } else {
        criticalMismatch = true;
        issues.push('Date of birth does not match ID document');
      }
    }

    // 4. Compare Address (optional, not critical)
    if (extractedData?.address && dto.address) {
      totalChecks++;
      const addrSimilarity = this.calculateSimilarity(dto.address, extractedData.address);
      
      if (addrSimilarity >= 0.5) {
        matches++;
      } else {
        issues.push('Address may not match ID document');
      }
    }

    const matchScore = totalChecks > 0 ? matches / totalChecks : 1;

    return { issues, matchScore, criticalMismatch };
  }
}
