import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReportEntity, ReportStatus, ReviewEntity } from 'src/database/entities';
import { Repository } from 'typeorm';
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
  ) {}

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
      throw new BadRequestException('Bạn không thể report review của chính mình');
    }

    // 3. Kiểm tra đã report review này chưa
    const existingReport = await this.reportRepo.findOne({
      where: { reporterId, reviewId: dto.reviewId },
    });

    if (existingReport) {
      throw new BadRequestException('Bạn đã report review này rồi');
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
    const [reports, total] = await this.reportRepo.findAndCount({
      where: { status: ReportStatus.PENDING },
      relations: ['reporter', 'review', 'review.reviewer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin resolve một report
   */
  async resolve(reportId: string, dto: ResolveReportDto, adminId: string) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['review'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report này đã được xử lý');
    }

    // Cập nhật report
    report.status = dto.status;
    report.resolvedBy = adminId;
    report.adminNote = dto.adminNote || '';
    report.resolvedAt = new Date();

    // Nếu RESOLVED và yêu cầu xóa review
    if (dto.status === ReportStatus.RESOLVED && dto.deleteReview) {
      await this.reviewService.softDelete(
        report.reviewId,
        adminId,
        `Report #${reportId}: ${dto.adminNote || 'Vi phạm quy tắc cộng đồng'}`,
      );
    }

    return this.reportRepo.save(report);
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
