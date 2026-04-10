import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReportEntity, ReportStatus, ReviewEntity } from 'src/database/entities';
import { DataSource, Repository } from 'typeorm';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReviewService } from '../review/review.service';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ReportEntity)
    private reportRepo: Repository<ReportEntity>,
    @InjectRepository(ReviewEntity)
    private reviewRepo: Repository<ReviewEntity>,
    private reviewService: ReviewService,
    private dataSource: DataSource,
  ) {}

  private toBoundedPositiveInt(value: number, fallback: number, max: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.min(Math.trunc(value), max);
  }

  /**
   * User tạo report cho một review
   */
  async create(reporterId: string, dto: CreateReportDto) {
    // 1. Kiểm tra review tồn tại
    const review = await this.reviewRepo.findOne({
      where: { id: dto.reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // 2. Không cho report review của chính mình
    if (review.reviewerId === reporterId) {
      throw new BadRequestException('You cannot report your own review.');
    }

    // 3. Kiểm tra đã report review này chưa
    const existingReport = await this.reportRepo.findOne({
      where: { reporterId, reviewId: dto.reviewId },
    });

    if (existingReport) {
      throw new BadRequestException('You have already reported this review.');
    }

    // 4. Tạo report
    const report = this.reportRepo.create({
      reporterId,
      reviewId: dto.reviewId,
      reason: dto.reason,
      description: dto.description,
    });

    return this.reportRepo.save(report);
  }

  /**
   * Admin lấy danh sách reports (PENDING)
   */
  async findPending(page: number = 1, limit: number = 20) {
    const safePage = this.toBoundedPositiveInt(page, 1, 10_000);
    const safeLimit = this.toBoundedPositiveInt(limit, 20, 100);

    const [reports, total] = await this.reportRepo.findAndCount({
      where: { status: ReportStatus.PENDING },
      relations: ['reporter', 'review', 'review.reviewer'],
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data: reports,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Admin resolve một report
   */
  async resolve(reportId: string, dto: ResolveReportDto, adminId: string) {
    let deletedReview: {
      id: string;
      targetUserId: string;
      reviewerId: string;
    } | null = null;

    const resolvedReport = await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const reportRepo = manager.getRepository(ReportEntity);
      const report = await reportRepo
        .createQueryBuilder('report')
        .leftJoinAndSelect('report.review', 'review')
        .setLock('pessimistic_write')
        .where('report.id = :reportId', { reportId })
        .getOne();

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (report.status !== ReportStatus.PENDING) {
        throw new BadRequestException('This report has already been processed.');
      }

      report.status = dto.status;
      report.resolvedBy = adminId;
      report.adminNote = dto.adminNote || '';
      report.resolvedAt = new Date();

      if (dto.status === ReportStatus.RESOLVED && dto.deleteReview) {
        const deleted = await this.reviewService.softDeleteWithinTransaction(
          manager,
          report.reviewId,
          adminId,
          `Report #${reportId}: ${dto.adminNote || 'Community guideline violation'}`,
        );

        deletedReview = {
          id: deleted.id,
          targetUserId: deleted.targetUserId,
          reviewerId: deleted.reviewerId,
        };
      }

      return reportRepo.save(report);
    });

    if (deletedReview) {
      await this.reviewService.handleSoftDeleteCommitted(deletedReview, adminId);
    }

    return resolvedReport;
  }

  /**
   * Lấy thông tin chi tiết một report
   */
  async findOne(reportId: string) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['reporter', 'review', 'review.reviewer', 'resolver'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }
}
