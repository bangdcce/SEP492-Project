import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  StaffApplicationEntity,
  StaffApplicationStatus,
} from '../../database/entities/staff-application.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ListStaffApplicationsDto, RejectStaffApplicationDto } from './dto';
import { StaffApplicationsGateway } from './staff-applications.gateway';
import { supabaseClient } from '../../config/supabase.config';
import { downloadWithWatermark } from '../../common/utils/supabase-storage.util';
import { EmailService } from '../auth/email.service';

interface ReviewAssetViewerContext {
  reviewerId: string;
  reviewerEmail: string;
  reviewerRole: 'ADMIN' | 'STAFF';
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

@Injectable()
export class StaffApplicationsService {
  private readonly logger = new Logger(StaffApplicationsService.name);

  constructor(
    @InjectRepository(StaffApplicationEntity)
    private readonly staffApplicationRepository: Repository<StaffApplicationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly staffApplicationsGateway: StaffApplicationsGateway,
    private readonly emailService: EmailService,
  ) {}

  async getMyApplication(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['staffApplication', 'staffApplication.reviewer', 'profile'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.STAFF) {
      throw new ForbiddenException('Only staff accounts have application status');
    }

    if (!user.staffApplication) {
      return this.createSyntheticApplicationView(user);
    }

    return this.mapApplication(user.staffApplication, {
      redactSensitive: true,
    });
  }

  async getAllApplications(filters: ListStaffApplicationsDto) {
    const page = this.parsePage(filters.page);
    const limit = this.parseLimit(filters.limit);
    const search = `${filters.search || ''}`.trim();
    const hasStatusFilter = Object.values(StaffApplicationStatus).includes(
      filters.status as StaffApplicationStatus,
    );

    const queryBuilder = this.staffApplicationRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.user', 'user')
      .leftJoinAndSelect('application.reviewer', 'reviewer')
      .leftJoinAndSelect('user.profile', 'profile');

    if (hasStatusFilter) {
      queryBuilder.andWhere('application.status = :status', { status: filters.status });
    }

    if (search) {
      queryBuilder.andWhere('(user.fullName ILIKE :search OR user.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    queryBuilder
      .orderBy('application.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [applications, total] = await queryBuilder.getManyAndCount();

    return {
      items: applications.map((application) =>
        this.mapApplication(application, {
          includeAdminSnapshot: true,
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getApplicationById(id: string) {
    const application = await this.staffApplicationRepository.findOne({
      where: { id },
      relations: ['user', 'user.profile', 'reviewer'],
    });

    if (!application) {
      throw new NotFoundException('Staff application not found');
    }

    return this.mapApplication(application, {
      includeAdminSnapshot: true,
    });
  }

  async getApplicationReviewAssets(id: string, viewer: ReviewAssetViewerContext) {
    const application = await this.staffApplicationRepository.findOne({
      where: { id },
      relations: ['user', 'reviewer'],
    });

    if (!application) {
      throw new NotFoundException('Staff application not found');
    }

    const watermarkTimestamp = new Date();
    const watermarkSessionId = viewer.sessionId || randomUUID();
    const watermarkOptions = {
      reviewerEmail: viewer.reviewerEmail,
      reviewerRole: viewer.reviewerRole,
      ipAddress: viewer.ipAddress || 'Unknown IP',
      sessionId: watermarkSessionId,
      timestamp: watermarkTimestamp,
      kycId: application.id,
    };

    const [cvUrl, idCardFrontUrl, idCardBackUrl, selfieUrl] = await Promise.all([
      this.getCvSignedUrl(application.cvStorageKey),
      this.getWatermarkedImageDataUrl(application.idCardFrontStorageKey, watermarkOptions),
      this.getWatermarkedImageDataUrl(application.idCardBackStorageKey, watermarkOptions),
      this.getWatermarkedImageDataUrl(application.selfieStorageKey, watermarkOptions),
    ]);

    this.auditLogsService
      .logCustom(
        'STAFF_APPLICATION_REVIEW_ASSETS_VIEWED',
        'StaffApplication',
        application.id,
        {
          applicationId: application.id,
          userId: application.userId,
          reviewerId: viewer.reviewerId,
          reviewerEmail: viewer.reviewerEmail,
          watermarkSessionId,
        },
        undefined,
        viewer.reviewerId,
      )
      .catch(() => {});

    return {
      id: application.id,
      status: application.status,
      cv: {
        url: cvUrl,
        originalFilename: application.cvOriginalFilename,
        mimeType: application.cvMimeType,
        size: application.cvSize,
      },
      manualKyc: {
        fullNameOnDocument: application.fullNameOnDocument,
        documentType: application.documentType,
        documentNumber: application.documentNumber,
        dateOfBirth: application.dateOfBirth,
        address: application.address,
      },
      previews: {
        idCardFrontUrl,
        idCardBackUrl,
        selfieUrl,
      },
      watermarkInfo: {
        reviewedBy: viewer.reviewerEmail,
        reviewedAt: watermarkTimestamp.toISOString(),
        warning:
          'CONFIDENTIAL - This review payload contains watermarked KYC images for manual approval only.',
      },
    };
  }

  async approveApplication(id: string, reviewerId: string) {
    const application = await this.staffApplicationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!application) {
      throw new NotFoundException('Staff application not found');
    }

    if (application.status !== StaffApplicationStatus.PENDING) {
      throw new BadRequestException('Only pending staff applications can be approved');
    }

    application.status = StaffApplicationStatus.APPROVED;
    application.reviewedBy = reviewerId;
    application.reviewedAt = new Date();
    application.rejectionReason = null;

    await this.staffApplicationRepository.save(application);
    await this.userRepository.update(application.userId, { isVerified: true });

    this.auditLogsService
      .logCustom(
        'STAFF_APPLICATION_APPROVED',
        'StaffApplication',
        application.id,
        {
          applicationId: application.id,
          userId: application.userId,
          reviewedBy: reviewerId,
        },
        undefined,
        reviewerId,
      )
      .catch(() => {});

    const updatedApplication = await this.getApplicationById(id);
    this.staffApplicationsGateway.emitApplicationUpdated(application.userId, {
      applicationId: updatedApplication.id,
      status: updatedApplication.status,
      reviewedAt: updatedApplication.reviewedAt,
      rejectionReason: updatedApplication.rejectionReason,
    });

    await this.sendApprovalNotificationEmail(application);

    return updatedApplication;
  }

  async rejectApplication(id: string, reviewerId: string, dto: RejectStaffApplicationDto) {
    const application = await this.staffApplicationRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!application) {
      throw new NotFoundException('Staff application not found');
    }

    if (application.status !== StaffApplicationStatus.PENDING) {
      throw new BadRequestException('Only pending staff applications can be rejected');
    }

    const rejectionReason = `${dto.rejectionReason || ''}`.trim();
    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    application.status = StaffApplicationStatus.REJECTED;
    application.reviewedBy = reviewerId;
    application.reviewedAt = new Date();
    application.rejectionReason = rejectionReason;

    await this.staffApplicationRepository.save(application);
    await this.userRepository.update(application.userId, { isVerified: false });

    this.auditLogsService
      .logCustom(
        'STAFF_APPLICATION_REJECTED',
        'StaffApplication',
        application.id,
        {
          applicationId: application.id,
          userId: application.userId,
          reviewedBy: reviewerId,
          rejectionReason,
        },
        undefined,
        reviewerId,
      )
      .catch(() => {});

    const updatedApplication = await this.getApplicationById(id);
    this.staffApplicationsGateway.emitApplicationUpdated(application.userId, {
      applicationId: updatedApplication.id,
      status: updatedApplication.status,
      reviewedAt: updatedApplication.reviewedAt,
      rejectionReason: updatedApplication.rejectionReason,
    });

    return updatedApplication;
  }

  private parsePage(value?: number) {
    const page = Number(value) || 1;
    return page > 0 ? page : 1;
  }

  private parseLimit(value?: number) {
    const limit = Number(value) || 20;
    return Math.min(Math.max(limit, 1), 100);
  }

  private createSyntheticApplicationView(user: UserEntity) {
    const syntheticSubmission = {
      documentType: null,
      maskedDocumentNumber: null,
      hasCv: !!user.profile?.cvUrl,
      hasKyc: false,
    };

    return {
      id: null,
      status: user.isVerified ? StaffApplicationStatus.APPROVED : StaffApplicationStatus.PENDING,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      reviewer: null,
      submissionSummary: {
        ...syntheticSubmission,
        submittedAt: user.createdAt,
        reviewedAt: null,
        rejectionReason: null,
      },
      manualKyc: null,
      cv: {
        originalFilename: null,
        mimeType: null,
        size: null,
        hasFile: syntheticSubmission.hasCv,
      },
      user: this.mapUser(user),
    };
  }

  private mapApplication(
    application: StaffApplicationEntity,
    options: {
      redactSensitive?: boolean;
      includeAdminSnapshot?: boolean;
    } = {},
  ) {
    const submissionSummary = {
      submittedAt: application.createdAt,
      documentType: application.documentType,
      maskedDocumentNumber: this.maskDocumentNumber(application.documentNumber),
      hasCv: !!application.cvStorageKey,
      hasKyc: this.hasKycAssets(application),
      reviewedAt: application.reviewedAt,
      rejectionReason: application.rejectionReason,
    };

    return {
      id: application.id,
      status: application.status,
      reviewedAt: application.reviewedAt,
      rejectionReason: application.rejectionReason,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      reviewer: application.reviewer
        ? {
            id: application.reviewer.id,
            email: application.reviewer.email,
            fullName: application.reviewer.fullName,
          }
        : null,
      submissionSummary,
      cv: {
        originalFilename: application.cvOriginalFilename,
        mimeType: application.cvMimeType,
        size: application.cvSize,
        hasFile: !!application.cvStorageKey,
      },
      manualKyc: options.includeAdminSnapshot
        ? {
            fullNameOnDocument: application.fullNameOnDocument,
            documentType: application.documentType,
            documentNumber: options.redactSensitive
              ? this.maskDocumentNumber(application.documentNumber)
              : application.documentNumber,
            dateOfBirth: application.dateOfBirth,
            address: application.address,
          }
        : null,
      user: application.user ? this.mapUser(application.user) : null,
    };
  }

  private mapUser(user: UserEntity) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      isEmailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  private hasKycAssets(application: StaffApplicationEntity) {
    return !!(
      application.idCardFrontStorageKey &&
      application.idCardBackStorageKey &&
      application.selfieStorageKey
    );
  }

  private maskDocumentNumber(documentNumber: string | null | undefined) {
    if (!documentNumber) {
      return null;
    }

    const trimmed = documentNumber.trim();
    if (!trimmed) {
      return null;
    }

    const lastVisibleCount = Math.min(4, trimmed.length);
    const visibleSuffix = trimmed.slice(-lastVisibleCount);
    const maskedPrefix = '*'.repeat(Math.max(trimmed.length - lastVisibleCount, 2));
    return `${maskedPrefix}${visibleSuffix}`;
  }

  private async getCvSignedUrl(storageKey: string | null): Promise<string | null> {
    if (!storageKey) {
      return null;
    }

    const { data, error } = await supabaseClient.storage.from('cvs').createSignedUrl(storageKey, 3600);

    if (error) {
      const { data: publicUrlData } = supabaseClient.storage.from('cvs').getPublicUrl(storageKey);
      return publicUrlData.publicUrl || null;
    }

    return data?.signedUrl || null;
  }

  private async getWatermarkedImageDataUrl(
    storageKey: string | null,
    watermarkOptions: Parameters<typeof downloadWithWatermark>[1],
  ): Promise<string | null> {
    if (!storageKey) {
      return null;
    }

    const buffer = await downloadWithWatermark(storageKey, watermarkOptions);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  private async sendApprovalNotificationEmail(application: StaffApplicationEntity): Promise<void> {
    const email = application.user?.email?.trim();
    if (!email) {
      this.logger.warn(
        `Skip staff approval email because recipient email is missing (${JSON.stringify({
          applicationId: application.id,
          userId: application.userId,
        })})`,
      );
      return;
    }

    const fullName = application.user?.fullName?.trim();
    const greeting = fullName ? `Hello ${fullName},` : 'Hello,';
    const platformBaseUrl = (
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      'https://localhost:5173'
    ).replace(/\/+$/, '');
    const signInUrl = `${platformBaseUrl}/login`;
    const body = `${greeting}<br/><br/>Your staff application has been approved. You can now sign in and continue using the platform with your staff account.<br/><br/>Sign in here: <a href="${signInUrl}" target="_blank" rel="noopener noreferrer">${signInUrl}</a>`;

    try {
      await this.emailService.sendPlatformNotification({
        email,
        subject: 'Your staff application has been approved',
        title: 'Staff application approved',
        body,
      });

      this.logger.log(
        `Staff approval email sent (${JSON.stringify({
          applicationId: application.id,
          userId: application.userId,
          email,
        })})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send staff approval email (${JSON.stringify({
          applicationId: application.id,
          userId: application.userId,
          email,
          error: message,
        })})`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
