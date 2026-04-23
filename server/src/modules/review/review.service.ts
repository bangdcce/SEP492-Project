import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuditLogEntity,
  MilestoneEntity,
  MilestoneStatus,
  ProjectEntity,
  ReportEntity,
  ReportStatus,
  ReviewEntity,
  UserEntity,
  UserRole,
} from 'src/database/entities';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  REVIEW_EVENTS,
  type ReviewMutationCommittedEvent,
  type ReviewMutationTrigger,
} from './events/review.events';

// Type for audit log review data
interface AuditLogReviewData {
  rating?: number;
  comment?: string;
}

// Type for raw report query result
interface PendingReportRaw {
  reviewId: string;
  reportCount: string;
}

type ModerationAction =
  | 'OPEN_REVIEW_MODERATION'
  | 'TAKE_REVIEW_MODERATION'
  | 'RELEASE_REVIEW_MODERATION'
  | 'REASSIGN_REVIEW_MODERATION';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(ReviewEntity)
    private reviewRepo: Repository<ReviewEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(MilestoneEntity)
    private milestoneRepo: Repository<MilestoneEntity>,
    @InjectRepository(AuditLogEntity)
    private auditLogRepo: Repository<AuditLogEntity>,
    @InjectRepository(ReportEntity)
    private reportRepo: Repository<ReportEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,

    // Inject trực tiếp TrustScoreService (hoặc dùng Event Emitter nếu muốn decouple mạnh hơn)
    private auditLogsService: AuditLogsService,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto, reqInfo: RequestContext) {
    const { projectId, targetUserId, rating, comment } = dto;

    // 1. Validation Logic: Kiểm tra dự án
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['client', 'freelancer', 'broker'],
    });

    if (!project) throw new NotFoundException('Project not found');

    await this.assertFinalMilestonePaid(projectId);

    // 2. Security Logic : Kiểm tra quyền thành viên
    // Client, Freelancer, Broker của dự án đó mới được review

    // Lọc bềEnull/undefined (freelancerId có thềEnull nếu chưa assign)
    const validMembers = [project.clientId, project.freelancerId, project.brokerId].filter(Boolean);
    if (!validMembers.includes(reviewerId)) {
      throw new ForbiddenException('You are not a member of this project.');
    }

    // Người được đánh giá cũng phải là thành viên dự án
    if (!validMembers.includes(targetUserId)) {
      throw new BadRequestException('The reviewed user is not a member of this project.');
    }

    // Không được tự review chính mình
    if (reviewerId === targetUserId) {
      throw new BadRequestException('You cannot review yourself.');
    }

    // Kiểm tra xem đã review chưa (Mỗi người chềEreview 1 lần cho 1 dự án/đối tượng)
    const existingReview = await this.reviewRepo.findOne({
      where: { projectId, reviewerId, targetUserId },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this user in this project.');
    }

    // 3. Business Logic: Tính trọng sềE(Weight)
    // Dự án càng to, tiếng nói càng có trọng lượng
    let weight = 1.0;
    const budget = Number(project.totalBudget);

    if (budget >= 50000000)
      weight = 2.0; // > 50tr: Trọng sềEx2
    else if (budget >= 10000000)
      weight = 1.5; // > 10tr: Trọng sềEx1.5
    else if (budget < 2000000) weight = 0.8; // < 2tr: Trọng sềEx0.8 (Dự án nhềE

    // 4. Persistence: Lưu review

    const review = this.reviewRepo.create({
      projectId,
      reviewerId,
      targetUserId,
      rating,
      comment,
      weight,
    });
    const savedReview = await this.dataSource.transaction(async (manager) => {
      const reviewRepository = manager.getRepository(ReviewEntity);
      const auditRepository = manager.getRepository(AuditLogEntity);

      try {
        const persistedReview = await reviewRepository.save(review);

        await this.auditLogsService.logOrThrow(
          {
            actorId: reviewerId,
            action: 'CREATE_REVIEW',
            entityType: 'Review',
            entityId: String(persistedReview.id),
            newData: this.serializeReviewForAudit(persistedReview),
            req: reqInfo,
            source: 'SERVER',
            eventCategory: 'DB_CHANGE',
            eventName: 'review-created',
          },
          auditRepository,
        );

        return persistedReview;
      } catch (error) {
        this.rethrowDuplicateReviewError(error);
        throw error;
      }
    });

    // 5. Trigger Calculation: Tính lại điểm cho Target User
    // Chạy async (không await) đềEphản hồi nhanh cho Frontend
    this.emitReviewMutationCommittedEvent(
      this.buildReviewMutationEvent(savedReview.id, targetUserId, 'created', reviewerId),
    );

    // 6. Audit Log: Ghi lại hành động

    // Audit log persisted inside the transaction above.
    return savedReview;
  }

  private async assertFinalMilestonePaid(projectId: string): Promise<void> {
    const milestones = await this.milestoneRepo.find({
      where: { projectId },
      order: {
        sortOrder: 'ASC',
        dueDate: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (milestones.length === 0) {
      throw new BadRequestException(
        'You can only review after the final milestone is accepted and paid.',
      );
    }

    const finalMilestone = milestones[milestones.length - 1];
    if (finalMilestone.status !== MilestoneStatus.PAID) {
      throw new BadRequestException(
        'You can only review after the final milestone is accepted and paid.',
      );
    }
  }

  async update(
    reviewerId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    reqInfo: RequestContext,
  ) {
    // 1. Lấy review cũ
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });

    if (!review) throw new NotFoundException('Review not found');

    if (review.reviewerId !== reviewerId) {
      throw new ForbiddenException('You do not have permission to edit this review.');
    }

    // 3. LOGIC QUAN TRỌNG: Kiểm tra thời hạn (Ví dụ: 3 ngày = 72h)
    const ONE_HOUR = 60 * 60 * 1000;
    const now = new Date().getTime();
    const createdTime = review.createdAt.getTime();
    const diffHours = (now - createdTime) / ONE_HOUR;

    if (diffHours > 72) {
      throw new BadRequestException('The 3-day edit window has expired for this review.');
    }
    // --- QUAN TRỌNG: SAO CHÉP DỮ LIềE CŨ ĐềEGHI LOG ---
    // Vì lát nữa ta sẽ sửa trực tiếp object 'review', nên phải clone ra một bản 'oldData' trước
    // Dùng Spread Operator {...} đềEcopy nông (Shallow Copy) giá trềE
    const oldData = { ...review };
    // 4. Cập nhật dữ liệu
    // ChềEcho sửa Rating và Comment, KHÔNG cho sửa ProjectId hay TargetUser
    let hasChange = false;

    if (dto.rating !== undefined) {
      review.rating = dto.rating;
      hasChange = true;
    }
    if (dto.comment !== undefined) {
      review.comment = dto.comment;
      hasChange = true;
    }

    // Nếu không có gì thay đổi thì trả vềEluôn, đỡ tốn query DB
    if (!hasChange) return review;

    const updatedReview = await this.dataSource.transaction(async (manager) => {
      const reviewRepository = manager.getRepository(ReviewEntity);
      const auditRepository = manager.getRepository(AuditLogEntity);
      const persistedReview = await reviewRepository.save(review);

      await this.auditLogsService.logOrThrow(
        {
          actorId: reviewerId,
          action: 'UPDATE_REVIEW',
          entityType: 'Review',
          entityId: review.id,
          oldData: this.serializeReviewForAudit(oldData),
          newData: this.serializeReviewForAudit(persistedReview),
          req: reqInfo,
          source: 'SERVER',
          eventCategory: 'DB_CHANGE',
          eventName: 'review-updated',
        },
        auditRepository,
      );

      return persistedReview;
    });

    // 5. TÍNH LẠI ĐIềE (Bắt buộc)
    // Vì rating thay đổi nên điểm uy tín của người kia cũng thay đổi theo
    this.emitReviewMutationCommittedEvent(
      this.buildReviewMutationEvent(
        updatedReview.id,
        updatedReview.targetUserId,
        'updated',
        reviewerId,
      ),
    );

    // 6. Ghi Audit Log
    // Audit log persisted inside the transaction above.
    /*
      action: 'UPDATE_REVIEW',
      entityType: 'Review',
      entityId: review.id,
      oldData: oldData, // Dữ liệu trước khi sửa
      newData: updatedReview as unknown as Record<string, unknown>,
      req: reqInfo, // Truyền req từ controller vào nếu có
    });
    */

    return updatedReview;
  }

  async findByTargetUser(targetUserId: string) {
    const reviews = await this.reviewRepo.find({
      where: { targetUserId },
      relations: ['reviewer', 'project'], // String, không phải biến
      order: { createdAt: 'DESC' }, // Mới nhất lên trước
    });

    return reviews;
  }

  async getEditHistory(reviewId: string) {
    // First check if review exists
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['reviewer'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Query audit logs directly for this review's edit history
    const logs = await this.auditLogRepo.find({
      where: {
        entityType: 'Review',
        entityId: reviewId,
        action: 'UPDATE_REVIEW',
      },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    // Build history entries from audit logs
    const historyFromLogs = logs.map((log, index) => {
      const afterData = log.afterData as AuditLogReviewData | null;
      const beforeData = log.beforeData as AuditLogReviewData | null;
      return {
        id: log.id,
        reviewId: reviewId,
        version: logs.length - index + 1, // Latest = highest version
        rating: afterData?.rating,
        comment: afterData?.comment,
        editedAt: log.createdAt.toISOString(),
        editedBy: {
          id: log.actor?.id || 'unknown',
          fullName: log.actor?.fullName || 'Unknown',
        },
        changesSummary: {
          ratingChanged: beforeData?.rating !== afterData?.rating,
          commentChanged: beforeData?.comment !== afterData?.comment,
        },
      };
    });

    // Add original version (from review.createdAt) - no changesSummary for original
    const originalEntry = {
      id: `${reviewId}-original`,
      reviewId: reviewId,
      version: 1,
      rating: review.rating,
      comment: review.comment,
      editedAt: review.createdAt.toISOString(),
      editedBy: {
        id: review.reviewer?.id || 'unknown',
        fullName: review.reviewer?.fullName || 'Unknown',
      },
      changesSummary: {
        ratingChanged: false,
        commentChanged: false,
      },
    };

    return [...historyFromLogs, originalEntry];
  }

  private calculateReviewWeight(budget: number) {
    if (budget >= 50000000) {
      return 2.0;
    }
    if (budget >= 10000000) {
      return 1.5;
    }
    if (budget < 2000000) {
      return 0.8;
    }
    return 1.0;
  }

  private createDuplicateReviewException() {
    return new BadRequestException('You have already reviewed this user in this project.');
  }

  private rethrowDuplicateReviewError(error: unknown) {
    if (
      error instanceof QueryFailedError &&
      typeof (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        'string' &&
      (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        '23505'
    ) {
      throw this.createDuplicateReviewException();
    }
  }

  private buildReviewMutationEvent(
    reviewId: string,
    targetUserId: string,
    trigger: ReviewMutationTrigger,
    triggeredBy: string,
  ): ReviewMutationCommittedEvent {
    return {
      reviewId,
      targetUserId,
      trigger,
      triggeredBy,
    };
  }

  private emitReviewMutationCommittedEvent(payload: ReviewMutationCommittedEvent) {
    void this.eventEmitter.emitAsync(REVIEW_EVENTS.MUTATED, payload).catch((error: unknown) => {
      this.logger.error(
        `Failed to emit review mutation event for review ${payload.reviewId}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  private serializeReviewForAudit(review: Partial<ReviewEntity> & Record<string, unknown>) {
    return {
      id: review.id ?? null,
      projectId: review.projectId ?? null,
      reviewerId: review.reviewerId ?? null,
      targetUserId: review.targetUserId ?? null,
      rating: review.rating ?? null,
      comment: review.comment ?? null,
      weight: review.weight ?? null,
      deletedAt:
        review.deletedAt instanceof Date
          ? review.deletedAt.toISOString()
          : (review.deletedAt ?? null),
      deletedBy: review.deletedBy ?? null,
      deleteReason: review.deleteReason ?? null,
      createdAt:
        review.createdAt instanceof Date
          ? review.createdAt.toISOString()
          : (review.createdAt ?? null),
      updatedAt:
        review.updatedAt instanceof Date
          ? review.updatedAt.toISOString()
          : (review.updatedAt ?? null),
      ...('restoreReason' in review ? { restoreReason: review.restoreReason ?? null } : {}),
    };
  }

  private toBoundedPositiveInt(value: unknown, fallback: number, max: number): number {
    const parsed =
      typeof value === 'number'
        ? Math.trunc(value)
        : typeof value === 'string'
          ? Number.parseInt(value, 10)
          : Number.NaN;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(parsed, max);
  }

  async softDeleteWithinTransaction(
    manager: EntityManager,
    reviewId: string,
    adminId: string,
    reason: string,
    prefetchedReview?: ReviewEntity,
  ): Promise<ReviewEntity> {
    const reviewRepository = manager.getRepository(ReviewEntity);
    const auditRepository = manager.getRepository(AuditLogEntity);

    const review =
      prefetchedReview ||
      (await reviewRepository.findOne({
        where: { id: reviewId },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      }));

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.deletedAt) {
      throw new BadRequestException('Review is already deleted');
    }

    const oldData = { ...review };
    review.deletedBy = adminId;
    review.deleteReason = reason;

    const persistedReview = await reviewRepository.softRemove(review);

    await this.auditLogsService.logOrThrow(
      {
        action: 'DELETE_REVIEW',
        entityType: 'Review',
        entityId: reviewId,
        actorId: adminId,
        oldData: this.serializeReviewForAudit(oldData),
        newData: this.serializeReviewForAudit(persistedReview),
        source: 'SERVER',
        eventCategory: 'DB_CHANGE',
        eventName: 'review-soft-deleted',
      },
      auditRepository,
    );

    return persistedReview;
  }

  async handleSoftDeleteCommitted(
    review: Pick<ReviewEntity, 'id' | 'targetUserId' | 'reviewerId'>,
    adminId: string,
  ): Promise<void> {
    this.emitReviewMutationCommittedEvent(
      this.buildReviewMutationEvent(review.id, review.targetUserId, 'soft_deleted', adminId),
    );

    await this.notifyModerationWatchers({
      actorId: adminId,
      reviewId: review.id,
      title: 'Review moderated',
      body: `A review was soft deleted by an administrator.`,
    });

    await this.notifyReviewOwner({
      actorId: adminId,
      ownerId: review.reviewerId,
      reviewId: review.id,
      title: 'Your review was removed',
      body:
        'An administrator removed one of your reviews after moderation. If you think this is incorrect, submit an appeal request from your account.',
    });
  }

  private summarizeUser(user?: UserEntity | null) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
  }

  private buildModerationHistorySummary(review: ReviewEntity) {
    const items: Array<{
      id: string;
      action: string;
      reason?: string | null;
      performedAt: Date;
      performedBy: ReturnType<ReviewService['summarizeUser']>;
    }> = [];

    if (review.deletedAt) {
      items.push({
        id: `${review.id}:soft-delete`,
        action: 'SOFT_DELETE',
        reason: review.deleteReason,
        performedAt: review.deletedAt,
        performedBy: this.summarizeUser(review.deletedByUser),
      });
    }

    if (review.lastAssignedAt) {
      items.push({
        id: `${review.id}:assignment`,
        action: review.currentAssigneeId ? 'ASSIGNED' : 'RELEASED',
        reason: null,
        performedAt: review.lastAssignedAt,
        performedBy: this.summarizeUser(review.lastAssignedByUser),
      });
    }

    return items.sort(
      (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
    );
  }

  private async getPendingReportInfoMap(reviewIds: string[]) {
    const normalizedIds = Array.from(new Set(reviewIds.filter(Boolean)));
    if (normalizedIds.length === 0) {
      return new Map<
        string,
        {
          reportCount: number;
          reasons: string[];
          lastReportedAt: Date | null;
          reportedBy: Array<{ id?: string; fullName?: string }>;
        }
      >();
    }

    const reports = await this.reportRepo.find({
      where: {
        reviewId: In(normalizedIds),
        status: ReportStatus.PENDING,
      },
      relations: ['reporter'],
      order: { createdAt: 'DESC' },
    });

    const result = new Map<
      string,
      {
        reportCount: number;
        reasons: string[];
        lastReportedAt: Date | null;
        reportedBy: Array<{ id?: string; fullName?: string }>;
      }
    >();

    for (const report of reports) {
      const current = result.get(report.reviewId) ?? {
        reportCount: 0,
        reasons: [],
        lastReportedAt: null,
        reportedBy: [],
      };
      current.reportCount += 1;
      if (!current.reasons.includes(report.reason)) {
        current.reasons.push(report.reason);
      }
      if (!current.lastReportedAt) {
        current.lastReportedAt = report.createdAt;
      }
      current.reportedBy.push({
        id: report.reporter?.id,
        fullName: report.reporter?.fullName,
      });
      result.set(report.reviewId, current);
    }

    return result;
  }

  private mapReviewForModeration(
    review: ReviewEntity,
    reportInfo?: {
      reportCount: number;
      reasons: string[];
      lastReportedAt: Date | null;
      reportedBy: Array<{ id?: string; fullName?: string }>;
    },
  ) {
    return {
      ...review,
      reportInfo:
        reportInfo && reportInfo.reportCount > 0
          ? {
              reportCount: reportInfo.reportCount,
              reasons: reportInfo.reasons,
              lastReportedAt: reportInfo.lastReportedAt,
              reportedBy: reportInfo.reportedBy,
            }
          : undefined,
      openedBy: this.summarizeUser(review.openedByUser),
      currentAssignee: this.summarizeUser(review.currentAssigneeUser),
      lastAssignedBy: this.summarizeUser(review.lastAssignedByUser),
      lastAssignedAt: review.lastAssignedAt,
      assignmentVersion: review.assignmentVersion ?? 0,
      lockStatus: {
        isOpened: Boolean(review.openedById),
        isAssigned: Boolean(review.currentAssigneeId),
        openedById: review.openedById,
        currentAssigneeId: review.currentAssigneeId,
      },
      moderationHistorySummary: this.buildModerationHistorySummary(review),
    };
  }

  private async listModerationWatcherIds(excludeUserIds: string[] = []) {
    const admins = await this.userRepo.find({
      where: {
        role: UserRole.ADMIN,
      },
      select: ['id'],
    });

    const excluded = new Set(excludeUserIds.filter(Boolean));
    return admins.map((admin) => admin.id).filter((adminId) => adminId && !excluded.has(adminId));
  }

  private async notifyModerationWatchers(params: {
    actorId: string;
    reviewId: string;
    title: string;
    body: string;
  }) {
    const watcherIds = await this.listModerationWatcherIds([params.actorId]);
    if (watcherIds.length === 0) {
      return;
    }

    await this.notificationsService.createMany(
      watcherIds.map((userId) => ({
        userId,
        title: params.title,
        body: params.body,
        relatedType: 'Review',
        relatedId: params.reviewId,
      })),
    );
  }

  private async notifyReviewOwner(params: {
    actorId: string;
    ownerId?: string | null;
    reviewId: string;
    title: string;
    body: string;
  }) {
    if (!params.ownerId || params.ownerId === params.actorId) {
      return;
    }

    await this.notificationsService.create({
      userId: params.ownerId,
      title: params.title,
      body: params.body,
      relatedType: 'Review',
      relatedId: params.reviewId,
    });
  }

  private async loadReviewForModeration(reviewId: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: [
        'reviewer',
        'reviewer.profile',
        'project',
        'targetUser',
        'deletedByUser',
        'openedByUser',
        'currentAssigneeUser',
        'lastAssignedByUser',
      ],
      withDeleted: true,
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  private async mutateModerationQueue(params: {
    reviewId: string;
    actorId: string;
    assignmentVersion: number;
    action: ModerationAction;
    assigneeId?: string | null;
    reason?: string | null;
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reviewRepo = queryRunner.manager.getRepository(ReviewEntity);
      const review = await reviewRepo
        .createQueryBuilder('review')
        .withDeleted()
        .setLock('pessimistic_write')
        .where('review.id = :reviewId', { reviewId: params.reviewId })
        .getOne();

      if (!review) {
        throw new NotFoundException('Review not found');
      }

      if ((review.assignmentVersion ?? 0) !== params.assignmentVersion) {
        throw new ConflictException('This moderation record changed. Refresh and try again.');
      }

      const nextVersion = (review.assignmentVersion ?? 0) + 1;
      const now = new Date();

      if (params.action === 'OPEN_REVIEW_MODERATION' && !review.openedById) {
        review.openedById = params.actorId;
      }

      if (params.action === 'TAKE_REVIEW_MODERATION') {
        review.currentAssigneeId = params.actorId;
        review.lastAssignedById = params.actorId;
        review.lastAssignedAt = now;
      }

      if (params.action === 'RELEASE_REVIEW_MODERATION') {
        review.currentAssigneeId = null;
        review.lastAssignedById = params.actorId;
        review.lastAssignedAt = now;
      }

      if (params.action === 'REASSIGN_REVIEW_MODERATION') {
        if (!params.assigneeId) {
          throw new BadRequestException('assigneeId is required for reassign.');
        }
        review.currentAssigneeId = params.assigneeId;
        review.lastAssignedById = params.actorId;
        review.lastAssignedAt = now;
      }

      review.assignmentVersion = nextVersion;
      await reviewRepo.save(review);
      await queryRunner.commitTransaction();

      await this.auditLogsService.log({
        actorId: params.actorId,
        action: params.action,
        entityType: 'Review',
        entityId: params.reviewId,
        newData: {
          action: params.action,
          assigneeId: review.currentAssigneeId,
          openedById: review.openedById,
          assignmentVersion: review.assignmentVersion,
          reason: params.reason ?? null,
        },
      });

      await this.notifyModerationWatchers({
        actorId: params.actorId,
        reviewId: params.reviewId,
        title: 'Review moderation queue updated',
        body: `A moderation case ownership changed for review ${params.reviewId}.`,
      });

      const hydrated = await this.loadReviewForModeration(params.reviewId);
      const reportInfoMap = await this.getPendingReportInfoMap([params.reviewId]);
      return this.mapReviewForModeration(hydrated, reportInfoMap.get(params.reviewId));
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Admin soft delete một review vi phạm
   * Tự động tính lại TrustScore của người được review
   */
  async softDelete(reviewId: string, adminId: string, reason: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const deletedReview = await this.dataSource.transaction((manager) =>
      this.softDeleteWithinTransaction(manager, reviewId, adminId, reason, review),
    );

    await this.handleSoftDeleteCommitted(deletedReview, adminId);

    return { message: 'Review deleted successfully' };
  }

  /**
   * Admin restore một review đã bềEsoft delete
   * Tự động tính lại TrustScore của người được review
   */
  async restore(reviewId: string, adminId: string, reason: string) {
    // Tìm review đã bềExóa (withDeleted đềElấy cả soft-deleted records)
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      withDeleted: true,
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (!review.deletedAt) {
      throw new BadRequestException('Review is not deleted');
    }

    // Lưu data cũ cho audit log
    const oldData = { ...review };

    // Restore: clear soft delete fields
    review.deletedAt = null;
    review.deletedBy = null;
    review.deleteReason = null;

    const restoredReview = await this.dataSource.transaction(async (manager) => {
      const reviewRepository = manager.getRepository(ReviewEntity);
      const auditRepository = manager.getRepository(AuditLogEntity);
      const persistedReview = await reviewRepository.save(review);

      await this.auditLogsService.logOrThrow(
        {
          action: 'RESTORE_REVIEW',
          entityType: 'Review',
          entityId: reviewId,
          actorId: adminId,
          oldData: this.serializeReviewForAudit(oldData),
          newData: this.serializeReviewForAudit({
            ...persistedReview,
            restoreReason: reason,
          }),
          source: 'SERVER',
          eventCategory: 'DB_CHANGE',
          eventName: 'review-restored',
        },
        auditRepository,
      );

      return persistedReview;
    });

    // QUAN TRỌNG: Tính lại Trust Score cho người được review
    this.emitReviewMutationCommittedEvent(
      this.buildReviewMutationEvent(
        restoredReview.id,
        restoredReview.targetUserId,
        'restored',
        adminId,
      ),
    );

    // Audit log
    // Audit log persisted inside the transaction above.

    await this.notifyModerationWatchers({
      actorId: adminId,
      reviewId,
      title: 'Review restored',
      body: `A review was restored by an administrator.`,
    });

    await this.notifyReviewOwner({
      actorId: adminId,
      ownerId: restoredReview.reviewerId,
      reviewId,
      title: 'Your review was restored',
      body: 'An administrator restored your review after moderation.',
    });

    return { message: 'Review restored successfully', review: restoredReview };
  }

  /**
   * Admin dismiss report cho một review (đánh dấu report là không hợp lềE
   * Cập nhật tất cả pending reports của review này thành REJECTED
   */
  async dismissReport(reviewId: string, adminId: string, reason?: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Update all pending reports for this review to REJECTED
    await this.reportRepo.update(
      { reviewId, status: ReportStatus.PENDING },
      {
        status: ReportStatus.REJECTED,
        resolvedBy: adminId,
        adminNote: reason || 'Report dismissed by admin',
        resolvedAt: new Date(),
      },
    );

    // Audit log
    await this.auditLogsService.log({
      action: 'DISMISS_REPORT',
      entityType: 'Review',
      entityId: reviewId,
      actorId: adminId,
      newData: { dismissReason: reason },
    });

    await this.notifyModerationWatchers({
      actorId: adminId,
      reviewId,
      title: 'Review report dismissed',
      body: `Pending reports were dismissed for a review moderation case.`,
    });

    return { message: 'Report dismissed successfully' };
  }

  /**
   * Admin get flagged reviews (reviews có pending reports)
   * Trả vềEdanh sách reviews có ít nhất 1 report đang pending
   */
  async getFlaggedReviews() {
    const pendingReports = await this.reportRepo
      .createQueryBuilder('report')
      .select('report.reviewId', 'reviewId')
      .addSelect('COUNT(*)', 'reportCount')
      .where('report.status = :status', { status: ReportStatus.PENDING })
      .groupBy('report.reviewId')
      .getRawMany<PendingReportRaw>();

    if (pendingReports.length === 0) {
      return [];
    }

    const reviewIds = pendingReports.map((row) => row.reviewId);
    const reviews = await this.reviewRepo.find({
      where: reviewIds.map((id) => ({ id })),
      relations: [
        'reviewer',
        'reviewer.profile',
        'project',
        'targetUser',
        'deletedByUser',
        'openedByUser',
        'currentAssigneeUser',
        'lastAssignedByUser',
      ],
      order: { createdAt: 'DESC' },
      withDeleted: true,
    });

    const reportInfoMap = await this.getPendingReportInfoMap(reviewIds);
    return reviews.map((review) =>
      this.mapReviewForModeration(review, reportInfoMap.get(review.id)),
    );
  }

  async getReviewsForModeration(filters?: { status?: string; page?: number; limit?: number }) {
    const page = this.toBoundedPositiveInt(filters?.page, 1, 10_000);
    const limit = this.toBoundedPositiveInt(filters?.limit, 50, 100);

    const queryBuilder = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('reviewer.profile', 'reviewerProfile')
      .leftJoinAndSelect('review.project', 'project')
      .leftJoinAndSelect('review.targetUser', 'targetUser')
      .leftJoinAndSelect('review.deletedByUser', 'deletedByUser')
      .leftJoinAndSelect('review.openedByUser', 'openedByUser')
      .leftJoinAndSelect('review.currentAssigneeUser', 'currentAssigneeUser')
      .leftJoinAndSelect('review.lastAssignedByUser', 'lastAssignedByUser')
      .withDeleted();

    if (filters?.status === 'SOFT_DELETED') {
      queryBuilder.andWhere('review.deletedAt IS NOT NULL');
    } else if (filters?.status === 'ACTIVE') {
      queryBuilder.andWhere('review.deletedAt IS NULL');
    } else if (filters?.status === 'FLAGGED') {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM reports report
          WHERE report.reviewId = review.id
            AND report.status = :pendingReportStatus
        )`,
        { pendingReportStatus: ReportStatus.PENDING },
      );
    }

    queryBuilder.orderBy('review.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit).take(limit);

    const reviews = await queryBuilder.getMany();
    const reportInfoMap = await this.getPendingReportInfoMap(reviews.map((review) => review.id));
    return reviews.map((review) =>
      this.mapReviewForModeration(review, reportInfoMap.get(review.id)),
    );
  }

  async openModerationCase(reviewId: string, adminId: string, assignmentVersion: number) {
    return this.mutateModerationQueue({
      reviewId,
      actorId: adminId,
      assignmentVersion,
      action: 'OPEN_REVIEW_MODERATION',
    });
  }

  async takeModerationCase(reviewId: string, adminId: string, assignmentVersion: number) {
    return this.mutateModerationQueue({
      reviewId,
      actorId: adminId,
      assignmentVersion,
      action: 'TAKE_REVIEW_MODERATION',
    });
  }

  async releaseModerationCase(reviewId: string, adminId: string, assignmentVersion: number) {
    return this.mutateModerationQueue({
      reviewId,
      actorId: adminId,
      assignmentVersion,
      action: 'RELEASE_REVIEW_MODERATION',
    });
  }

  async reassignModerationCase(
    reviewId: string,
    adminId: string,
    assigneeId: string,
    assignmentVersion: number,
    reason?: string,
  ) {
    return this.mutateModerationQueue({
      reviewId,
      actorId: adminId,
      assigneeId,
      assignmentVersion,
      action: 'REASSIGN_REVIEW_MODERATION',
      reason,
    });
  }

  /**
   * [DEV ONLY] Get all reviews without any filters for testing
   */
  async getAllReviewsForTest() {
    return this.reviewRepo.find({
      relations: [
        'reviewer',
        'reviewer.profile',
        'project',
        'targetUser',
        'deletedByUser',
        'openedByUser',
        'currentAssigneeUser',
        'lastAssignedByUser',
      ],
      withDeleted: true,
      order: { createdAt: 'DESC' },
    });
  }
}
