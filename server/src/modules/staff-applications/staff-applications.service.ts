import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StaffApplicationEntity,
  StaffApplicationStatus,
} from '../../database/entities/staff-application.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ListStaffApplicationsDto, RejectStaffApplicationDto } from './dto';
import { StaffApplicationsGateway } from './staff-applications.gateway';

@Injectable()
export class StaffApplicationsService {
  constructor(
    @InjectRepository(StaffApplicationEntity)
    private readonly staffApplicationRepository: Repository<StaffApplicationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly staffApplicationsGateway: StaffApplicationsGateway,
  ) {}

  async getMyApplication(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        'staffApplication',
        'staffApplication.reviewer',
        'userSkills',
        'userSkills.skill',
        'userSkillDomains',
        'userSkillDomains.domain',
      ],
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

    return this.mapApplication(user.staffApplication, true);
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
      .leftJoinAndSelect('application.reviewer', 'reviewer');

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
      items: applications.map((application) => this.mapApplication(application)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getApplicationById(id: string) {
    const application = await this.staffApplicationRepository.findOne({
      where: { id },
      relations: [
        'user',
        'reviewer',
        'user.userSkills',
        'user.userSkills.skill',
        'user.userSkillDomains',
        'user.userSkillDomains.domain',
      ],
    });

    if (!application) {
      throw new NotFoundException('Staff application not found');
    }

    return this.mapApplication(application, true);
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
    return {
      id: null,
      status: user.isVerified
        ? StaffApplicationStatus.APPROVED
        : StaffApplicationStatus.PENDING,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      reviewer: null,
      user: this.mapUser(user, true),
    };
  }

  private mapApplication(application: StaffApplicationEntity, includeTaxonomy = false) {
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
      user: application.user ? this.mapUser(application.user, includeTaxonomy) : null,
    };
  }

  private mapUser(user: UserEntity, includeTaxonomy = false) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      isEmailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
      ...(includeTaxonomy
        ? {
            domains: (user.userSkillDomains || [])
              .map((item) => item.domain)
              .filter(Boolean)
              .map((domain) => ({
                id: domain.id,
                name: domain.name,
                slug: domain.slug,
              })),
            skills: (user.userSkills || [])
              .map((item) => item.skill)
              .filter(Boolean)
              .map((skill) => ({
                id: skill.id,
                name: skill.name,
                slug: skill.slug,
                category: skill.category,
              })),
          }
        : {}),
    };
  }
}
