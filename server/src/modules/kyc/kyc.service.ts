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
    console.log('\n=================================');
    console.log('🤖 [AI VERIFICATION] Starting...');
    console.log('📄 Processing 3 documents (Front, Back, Selfie)');
    console.log('=================================\n');
    
    const aiVerification = await this.fptAiService.verifyKyc(
      files.idCardFront.buffer,
      files.idCardBack.buffer,
      files.selfie.buffer,
    );

    console.log('\n=================================');
    console.log('✅ [AI RESULT] Verification Complete!');
    console.log('📊 Decision:', aiVerification.decision);
    console.log('📈 Confidence:', `${(aiVerification.confidence * 100).toFixed(2)}%`);
    if (aiVerification.issues?.length > 0) {
      console.log('⚠️  Issues:', aiVerification.issues.join(', '));
    }
    console.log('=================================\n');

    // Step 2: Determine KYC status based on AI decision
    let kycStatus: KycStatus;
    let autoApproved = false;
    const aiIssues = aiVerification.issues || [];
    const hasUnreadableIssue = aiIssues.some(issue =>
      /could not extract|cannot extract|unable to extract/i.test(issue),
    );
    
    if (aiVerification.decision === 'AUTO_APPROVED') {
      kycStatus = KycStatus.APPROVED;
      autoApproved = true;
    } else if (aiVerification.decision === 'AUTO_REJECTED') {
      // If AI cannot read key fields, send to manual review instead of hard reject
      kycStatus = hasUnreadableIssue ? KycStatus.PENDING : KycStatus.REJECTED;
    } else {
      kycStatus = KycStatus.PENDING; // Needs admin review
    }

    // Step 3: Upload encrypted files to Supabase Storage
    console.log('📤 [UPLOAD] Encrypting and uploading documents to Supabase...');
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
      rejectionReason: aiVerification.issues?.join(', '), // Store AI issues if any
    });

    const savedKyc = await this.kycRepo.save(kyc);
    console.log('💾 [DATABASE] KYC record saved successfully');

    // Step 5: If auto-approved by AI, update user verification status immediately
    if (autoApproved) {
      await this.userRepo.update(userId, { isVerified: true });
      console.log('\n🎉 ✅ [SUCCESS] KYC AUTO-APPROVED by AI!');
      console.log('User verification status updated.\n');
    } else if (kycStatus === KycStatus.REJECTED) {
      console.log('\n❌ [REJECTED] KYC auto-rejected by AI');
      console.log('Reason:', aiIssues.join(', ') || 'Quality issues detected\n');
    } else if (hasUnreadableIssue) {
      console.log('\n⏳ [PENDING] AI could not extract key fields. Sent for manual review');
      console.log('Issues:', aiIssues.join(', ') || 'Unreadable fields\n');
    } else {
      console.log('\n⏳ [PENDING] KYC requires manual admin review');
      console.log('Confidence too low for auto-decision\n');
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
        extractedData: aiVerification.extractedData,
        issues: aiVerification.issues,
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

    return {
      ...kyc,
      documentFrontUrl: frontUrl,
      documentBackUrl: backUrl,
      selfieUrl: selfieUrl,
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
}

