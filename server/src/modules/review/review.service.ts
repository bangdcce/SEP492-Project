import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuditLogEntity,
  ProjectEntity,
  ProjectStatus,
  ReportEntity,
  ReportStatus,
  ReviewEntity,
} from 'src/database/entities';
import { Repository } from 'typeorm';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { AuditLogsService, RequestContext } from '../audit-logs/audit-logs.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

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

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(ReviewEntity)
    private reviewRepo: Repository<ReviewEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(AuditLogEntity)
    private auditLogRepo: Repository<AuditLogEntity>,
    @InjectRepository(ReportEntity)
    private reportRepo: Repository<ReportEntity>,

    // Inject trực tiếp TrustScoreService (hoặc dùng Event Emitter nếu muốn decouple mạnh hơn)
    private trustScoreService: TrustScoreService,
    private auditLogsService: AuditLogsService,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto, reqInfo: RequestContext) {
    const { projectId, targetUserId, rating, comment } = dto;

    // 1. Validation Logic: Kiểm tra dự án
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['client', 'freelancer', 'broker'],
    });

    if (!project) throw new NotFoundException('Project not found');

    // Chỉ dự án đã Hoàn Thành mới được review (để tránh blackmailing)

    if (project.status !== ProjectStatus.COMPLETED) {
      throw new BadRequestException('Chỉ có thể dánh giá khi dự án đã hoàn thành (COMPLETE).');
    }

    // 2. Security Logic : Kiểm tra quyền thành viên
    // Client, Freelancer, Broker của dự án đó mới được review

    // Lọc bỏ null/undefined (freelancerId có thể null nếu chưa assign)
    const validMembers = [project.clientId, project.freelancerId, project.brokerId].filter(Boolean);
    if (!validMembers.includes(reviewerId)) {
      throw new ForbiddenException('Bạn không phải thành viên dự án này.');
    }

    // Người được đánh giá cũng phải là thành viên dự án
    if (!validMembers.includes(targetUserId)) {
      throw new BadRequestException('Người được đánh giá không phải thành viên dự án này.');
    }

    // Không được tự review chính mình
    if (reviewerId === targetUserId) {
      throw new BadRequestException('Không thể tự đánh giá bản thân.');
    }

    // Kiểm tra xem đã review chưa (Mỗi người chỉ review 1 lần cho 1 dự án/đối tượng)
    const existingReview = await this.reviewRepo.findOne({
      where: { projectId, reviewerId, targetUserId },
    });

    if (existingReview) {
      throw new BadRequestException('Bạn đã đánh giá người dùng này trong dự án này rồi.');
    }

    // 3. Business Logic: Tính trọng số (Weight)
    // Dự án càng to, tiếng nói càng có trọng lượng
    let weight = 1.0;
    const budget = Number(project.totalBudget);

    if (budget >= 50000000)
      weight = 2.0; // > 50tr: Trọng số x2
    else if (budget >= 10000000)
      weight = 1.5; // > 10tr: Trọng số x1.5
    else if (budget < 2000000) weight = 0.8; // < 2tr: Trọng số x0.8 (Dự án nhỏ)

    // 4. Persistence: Lưu review

    const review = this.reviewRepo.create({
      projectId,
      reviewerId,
      targetUserId,
      rating,
      comment,
      weight,
    });
    const savedReview = await this.reviewRepo.save(review);

    // 5. Trigger Calculation: Tính lại điểm cho Target User
    // Chạy async (không await) để phản hồi nhanh cho Frontend
    this.trustScoreService.calculateTrustScore(targetUserId).catch((err) => {
      console.error('Lỗi tính TrustScore', err);
    });

    // 6. Audit Log: Ghi lại hành động

    await this.auditLogsService.log({
      actorId: reviewerId,
      action: 'CREATE_REVIEW',
      entityType: 'Review',
      entityId: String(savedReview.id),
      newData: savedReview as unknown as Record<string, unknown>,
      req: reqInfo,
    });
    return savedReview;
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
      throw new ForbiddenException('Bạn không có quyền sửa đánh giá này.');
    }

    // 3. LOGIC QUAN TRỌNG: Kiểm tra thời hạn (Ví dụ: 3 ngày = 72h)
    const ONE_HOUR = 60 * 60 * 1000;
    const now = new Date().getTime();
    const createdTime = review.createdAt.getTime();
    const diffHours = (now - createdTime) / ONE_HOUR;

    if (diffHours > 72) {
      throw new BadRequestException('Đã quá thời hạn 3 ngày, bạn không thể sửa đánh giá nữa.');
    }
    // --- QUAN TRỌNG: SAO CHÉP DỮ LIỆU CŨ ĐỂ GHI LOG ---
    // Vì lát nữa ta sẽ sửa trực tiếp object 'review', nên phải clone ra một bản 'oldData' trước
    // Dùng Spread Operator {...} để copy nông (Shallow Copy) giá trị
    const oldData = { ...review };
    // 4. Cập nhật dữ liệu
    // Chỉ cho sửa Rating và Comment, KHÔNG cho sửa ProjectId hay TargetUser
    let hasChange = false;

    if (dto.rating !== undefined) {
      review.rating = dto.rating;
      hasChange = true;
    }
    if (dto.comment !== undefined) {
      review.comment = dto.comment;
      hasChange = true;
    }

    // Nếu không có gì thay đổi thì trả về luôn, đỡ tốn query DB
    if (!hasChange) return review;

    const updatedReview = await this.reviewRepo.save(review);

    // 5. TÍNH LẠI ĐIỂM (Bắt buộc)
    // Vì rating thay đổi nên điểm uy tín của người kia cũng thay đổi theo
    this.trustScoreService
      .calculateTrustScore(review.targetUserId)
      .catch((err) => console.error(err));

    // 6. Ghi Audit Log
    await this.auditLogsService.log({
      actorId: reviewerId,
      action: 'UPDATE_REVIEW',
      entityType: 'Review',
      entityId: review.id,
      oldData: oldData, // Dữ liệu trước khi sửa
      newData: updatedReview as unknown as Record<string, unknown>,
      req: reqInfo, // Truyền req từ controller vào nếu có
    });

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

    // Lưu data cũ cho audit log
    const oldData = { ...review };

    // Cập nhật soft delete fields
    review.deletedBy = adminId;
    review.deleteReason = reason;

    // TypeORM softRemove sẽ tự động set deletedAt
    await this.reviewRepo.softRemove(review);

    // QUAN TRỌNG: Tính lại Trust Score cho người được review
    this.trustScoreService.calculateTrustScore(review.targetUserId).catch((err) => {
      this.logger.error('Error recalculating trust score after delete', err);
    });

    // Audit log
    await this.auditLogsService.log({
      action: 'DELETE_REVIEW',
      entityType: 'Review',
      entityId: reviewId,
      actorId: adminId,
      oldData: oldData,
      newData: undefined,
    });

    return { message: 'Review deleted successfully' };
  }

  /**
   * Admin restore một review đã bị soft delete
   * Tự động tính lại TrustScore của người được review
   */
  async restore(reviewId: string, adminId: string, reason: string) {
    // Tìm review đã bị xóa (withDeleted để lấy cả soft-deleted records)
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

    await this.reviewRepo.save(review);

    // QUAN TRỌNG: Tính lại Trust Score cho người được review
    this.trustScoreService.calculateTrustScore(review.targetUserId).catch((err) => {
      this.logger.error('Error recalculating trust score after restore', err);
    });

    // Audit log
    await this.auditLogsService.log({
      action: 'RESTORE_REVIEW',
      entityType: 'Review',
      entityId: reviewId,
      actorId: adminId,
      oldData: oldData,
      newData: { ...review, restoreReason: reason },
    });

    return { message: 'Review restored successfully', review };
  }

  /**
   * Admin dismiss report cho một review (đánh dấu report là không hợp lệ)
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

    return { message: 'Report dismissed successfully' };
  }

  /**
   * Admin get flagged reviews (reviews có pending reports)
   * Trả về danh sách reviews có ít nhất 1 report đang pending
   */
  async getFlaggedReviews() {
    // Lấy tất cả reviewIds có pending reports
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

    const reviewIds = pendingReports.map((r) => r.reviewId);

    // Lấy chi tiết reviews
    const reviews = await this.reviewRepo.find({
      where: reviewIds.map((id) => ({ id })),
      relations: ['reviewer', 'project', 'targetUser'],
      order: { createdAt: 'DESC' },
    });

    // Attach report info to each review
    const reviewsWithReportInfo = await Promise.all(
      reviews.map(async (review) => {
        const reports = await this.reportRepo.find({
          where: { reviewId: review.id, status: ReportStatus.PENDING },
          relations: ['reporter'],
          order: { createdAt: 'DESC' },
        });

        return {
          ...review,
          reportInfo: {
            reportCount: reports.length,
            reasons: [...new Set(reports.map((r) => r.reason))],
            lastReportedAt: reports[0]?.createdAt,
            reportedBy: reports.map((r) => ({
              id: r.reporter?.id,
              fullName: r.reporter?.fullName,
            })),
          },
        };
      }),
    );

    return reviewsWithReportInfo;
  }

  /**
   * Admin get all reviews for moderation
   * Enhanced: Now includes report info for flagged reviews
   */
  async getReviewsForModeration(filters?: { status?: string; page?: number; limit?: number }) {
    const queryBuilder = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('reviewer.profile', 'reviewerProfile')
      .leftJoinAndSelect('review.project', 'project')
      .leftJoinAndSelect('review.targetUser', 'targetUser')
      .withDeleted(); // Include soft-deleted records

    if (filters?.status === 'SOFT_DELETED') {
      queryBuilder.andWhere('review.deletedAt IS NOT NULL');
    } else if (filters?.status === 'ACTIVE') {
      queryBuilder.andWhere('review.deletedAt IS NULL');
    }

    queryBuilder.orderBy('review.createdAt', 'DESC');

    if (filters?.page && filters?.limit) {
      queryBuilder.skip((filters.page - 1) * filters.limit).take(filters.limit);
    }

    const reviews = await queryBuilder.getMany();

    // Enhance with report info
    const reviewsWithReportInfo = await Promise.all(
      reviews.map(async (review) => {
        const pendingReports = await this.reportRepo.find({
          where: { reviewId: review.id, status: ReportStatus.PENDING },
          relations: ['reporter'],
          order: { createdAt: 'DESC' },
        });

        if (pendingReports.length > 0) {
          return {
            ...review,
            reportInfo: {
              reportCount: pendingReports.length,
              reasons: [...new Set(pendingReports.map((r) => r.reason))],
              lastReportedAt: pendingReports[0]?.createdAt,
              reportedBy: pendingReports.map((r) => ({
                id: r.reporter?.id,
                fullName: r.reporter?.fullName,
              })),
            },
          };
        }

        return review;
      }),
    );

    return reviewsWithReportInfo;
  }

  /**
   * [DEV ONLY] Get all reviews without any filters for testing
   */
  async getAllReviewsForTest() {
    return this.reviewRepo.find({
      relations: ['reviewer', 'reviewer.profile', 'project', 'targetUser'],
      withDeleted: true,
      order: { createdAt: 'DESC' },
    });
  }
}
