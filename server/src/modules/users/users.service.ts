import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { KycVerificationEntity } from '../../database/entities/kyc-verification.entity';
import { ProfileEntity } from '../../database/entities/profile.entity';
import { UserSkillEntity } from '../../database/entities/user-skill.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import {
  ProjectRequestCommercialFeature,
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import {
  BanUserDto,
  UnbanUserDto,
  ResetUserPasswordDto,
  UserFilterDto,
} from './dto/admin-user.dto';
import * as bcrypt from 'bcryptjs';
import { getSignedUrl } from '../../common/utils/supabase-storage.util';
import { EmailService } from '../auth/email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(KycVerificationEntity)
    private kycRepo: Repository<KycVerificationEntity>,
    @InjectRepository(ProfileEntity)
    private profileRepo: Repository<ProfileEntity>,
    @InjectRepository(UserSkillEntity)
    private userSkillRepo: Repository<UserSkillEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(ProjectRequestEntity)
    private projectRequestRepo: Repository<ProjectRequestEntity>,
    @InjectRepository(ProjectRequestProposalEntity)
    private projectRequestProposalRepo: Repository<ProjectRequestProposalEntity>,
    private readonly emailService: EmailService,
  ) {}

  private async sendBanStatusEmail(input: {
    user: UserEntity;
    reason: string;
    type: 'BAN' | 'UNBAN';
  }): Promise<void> {
    const reason = `${input.reason || ''}`.trim() || 'No reason was provided by the administrator.';
    const fullName = input.user.fullName?.trim() || 'User';
    const subject =
      input.type === 'BAN'
        ? 'InterDev account access has been restricted'
        : 'InterDev account access has been restored';
    const title =
      input.type === 'BAN' ? 'Your account was banned' : 'Your account was unbanned';
    const body =
      input.type === 'BAN'
        ? `Hello ${fullName}, your InterDev account has been banned. Reason: ${reason}`
        : `Hello ${fullName}, your InterDev account has been unbanned. Reason: ${reason}`;

    try {
      await this.emailService.sendPlatformNotification({
        email: input.user.email,
        subject,
        title,
        body,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send ${input.type} notification email to ${input.user.email}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private parseSkillFilter(input?: string | string[]): string[] {
    const values = Array.isArray(input) ? input : `${input || ''}`.split(',');
    return Array.from(
      new Set(
        values
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  private buildRequestMatchText(request: ProjectRequestEntity): string {
    const agreedFeatures =
      request.commercialBaseline?.agreedClientFeatures ??
      request.commercialBaseline?.clientFeatures ??
      [];
    const featureText = (agreedFeatures || [])
      .map((feature) => `${feature?.title || ''} ${feature?.description || ''}`)
      .join(' ');

    return [
      request.title,
      request.description,
      request.techPreferences,
      request.requestScopeBaseline?.productTypeLabel,
      request.requestScopeBaseline?.productTypeCode,
      request.requestScopeBaseline?.projectGoalSummary,
      featureText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private getCommercialFeatures(request: ProjectRequestEntity): ProjectRequestCommercialFeature[] {
    return (
      request.commercialBaseline?.agreedClientFeatures ??
      request.commercialBaseline?.clientFeatures ??
      []
    );
  }

  private computeProfileCompleteness(input: {
    user: UserEntity;
    profile: ProfileEntity | null;
    skillNames: string[];
  }) {
    const checklist = [
      { label: 'Phone number', done: Boolean(input.user.phoneNumber?.trim()) },
      { label: 'Verified email', done: Boolean(input.user.isVerified) },
      { label: 'Avatar', done: Boolean(input.profile?.avatarUrl?.trim()) },
      { label: 'Professional bio', done: Boolean(input.profile?.bio?.trim()) },
      { label: 'Skills', done: input.skillNames.length > 0 },
      {
        label: 'Portfolio or CV',
        done: Boolean(
          (input.profile?.portfolioLinks?.length ?? 0) > 0 || input.profile?.cvUrl?.trim(),
        ),
      },
      { label: 'LinkedIn', done: Boolean(input.profile?.linkedinUrl?.trim()) },
    ];

    const completed = checklist.filter((item) => item.done).length;
    const percentage = Math.round((completed / checklist.length) * 100);

    return {
      percentage,
      isComplete: completed === checklist.length,
      missingFields: checklist.filter((item) => !item.done).map((item) => item.label),
    };
  }

  private async getFreelancerSkillNames(
    userId: string,
    profile: ProfileEntity | null,
  ): Promise<string[]> {
    const userSkills = await this.userSkillRepo.find({
      where: { userId },
      relations: ['skill'],
      order: { completedProjectsCount: 'DESC', updatedAt: 'DESC' },
    });

    return Array.from(
      new Set(
        [
          ...(profile?.skills ?? []),
          ...userSkills.map((userSkill) => userSkill.skill?.name).filter(Boolean),
        ]
          .map((value) => `${value}`.trim())
          .filter(Boolean),
      ),
    );
  }

  /**
   * Get all users with filters (Admin only)
   */
  async getAllUsers(filters: UserFilterDto) {
    const { role, search, isBanned, page = 1, limit = 20 } = filters;

    const queryBuilder = this.userRepo.createQueryBuilder('user');

    // Filter by role
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    // Search by email or fullName
    if (search) {
      queryBuilder.andWhere('(user.email ILIKE :search OR user.fullName ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    // Filter by ban status
    if (isBanned !== undefined) {
      queryBuilder.andWhere('user.isBanned = :isBanned', { isBanned });
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by newest first
    queryBuilder.orderBy('user.createdAt', 'DESC');

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user detail by ID (Admin only)
   */
  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const latestKyc = await this.kycRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const kycInfo = latestKyc
      ? {
          id: latestKyc.id,
          status: latestKyc.status,
          rejectionReason: latestKyc.rejectionReason,
          createdAt: latestKyc.createdAt,
          reviewedAt: latestKyc.reviewedAt,
          documentFrontUrl: await getSignedUrl(latestKyc.documentFrontUrl, 3600),
          documentBackUrl: await getSignedUrl(latestKyc.documentBackUrl, 3600),
        }
      : { status: 'NOT_STARTED' };

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phoneNumber: user.phoneNumber,
      isVerified: user.isVerified,
      isBanned: user.isBanned,
      banReason: user.banReason,
      bannedAt: user.bannedAt,
      currentTrustScore: user.currentTrustScore,
      totalProjectsFinished: user.totalProjectsFinished,
      totalDisputesLost: user.totalDisputesLost,
      createdAt: user.createdAt,
      kyc: kycInfo,
    };
  }

  /**
   * Ban user (Admin only)
   */
  async banUser(userId: string, adminId: string, dto: BanUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    // Update user status
    user.isBanned = true;
    user.banReason = dto.reason;
    user.bannedAt = new Date();
    user.bannedBy = adminId;

    await this.userRepo.save(user);
    await this.sendBanStatusEmail({
      user,
      reason: dto.reason,
      type: 'BAN',
    });

    return {
      message: 'User banned successfully',
      user,
    };
  }

  /**
   * Unban user (Admin only)
   */
  async unbanUser(userId: string, adminId: string, dto: UnbanUserDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    // Update user status
    user.isBanned = false;
    user.banReason = null as any;
    user.bannedAt = null as any;
    user.bannedBy = null as any;

    await this.userRepo.save(user);
    await this.sendBanStatusEmail({
      user,
      reason: dto.reason,
      type: 'UNBAN',
    });

    return {
      message: 'User unbanned successfully',
      user,
    };
  }

  /**
   * Reset user password (Admin only)
   */
  async resetUserPassword(userId: string, adminId: string, dto: ResetUserPasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update password
    user.passwordHash = hashedPassword;
    await this.userRepo.save(user);

    // TODO: Send email notification if sendEmail = true

    return {
      message: 'Password reset successfully',
      email: user.email,
    };
  }

  /**
   * Get user statistics for admin dashboard
   */
  async getUserStatistics() {
    const total = await this.userRepo.count();
    const banned = await this.userRepo.count({ where: { isBanned: true } });
    const verified = await this.userRepo.count({ where: { isVerified: true } });

    const byRole = await this.userRepo
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    return {
      total,
      banned,
      verified,
      byRole: byRole.reduce((acc, item) => {
        acc[item.role] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }

  async getFreelancerDashboard(
    currentUser: UserEntity,
    filters: { search?: string; skills?: string | string[] },
  ) {
    if (currentUser.role !== UserRole.FREELANCER) {
      throw new ForbiddenException('Freelancer dashboard is only available for freelancer accounts.');
    }

    const user = await this.userRepo.findOne({
      where: { id: currentUser.id },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile =
      (user.profile as ProfileEntity | null | undefined) ??
      (await this.profileRepo.findOne({ where: { userId: user.id } }));
    const skillNames = await this.getFreelancerSkillNames(user.id, profile ?? null);
    const normalizedSearch = `${filters.search || ''}`.trim().toLowerCase();
    const skillFilter = this.parseSkillFilter(filters.skills);

    const activeProjectStatuses = [
      ProjectStatus.INITIALIZING,
      ProjectStatus.PLANNING,
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.TESTING,
      ProjectStatus.DISPUTED,
    ];
    const completedProjectStatuses = [ProjectStatus.COMPLETED, ProjectStatus.PAID];

    const [
      activeProjectsCount,
      completedProjectsCount,
      activeProjects,
      pendingInvitations,
      completedBudgetRaw,
      currentMonthBudgetRaw,
      recentRequests,
    ] = await Promise.all([
      this.projectRepo.count({
        where: { freelancerId: user.id, status: In(activeProjectStatuses) },
      }),
      this.projectRepo.count({
        where: { freelancerId: user.id, status: In(completedProjectStatuses) },
      }),
      this.projectRepo.find({
        where: { freelancerId: user.id, status: In(activeProjectStatuses) },
        relations: ['client', 'broker'],
        order: { updatedAt: 'DESC' },
        take: 10,
      }),
      this.projectRequestProposalRepo.find({
        where: { freelancerId: user.id, status: In(['INVITED', 'PENDING']) },
        relations: ['request', 'request.client', 'request.broker'],
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.projectRepo
        .createQueryBuilder('project')
        .select('COALESCE(SUM(project.totalBudget), 0)', 'total')
        .where('project.freelancerId = :userId', { userId: user.id })
        .andWhere('project.status IN (:...statuses)', { statuses: completedProjectStatuses })
        .getRawOne(),
      this.projectRepo
        .createQueryBuilder('project')
        .select('COALESCE(SUM(project.totalBudget), 0)', 'total')
        .where('project.freelancerId = :userId', { userId: user.id })
        .andWhere('project.status IN (:...statuses)', { statuses: completedProjectStatuses })
        .andWhere("DATE_TRUNC('month', project.updatedAt) = DATE_TRUNC('month', CURRENT_DATE)")
        .getRawOne(),
      this.projectRequestRepo.find({
        where: { status: In([RequestStatus.SPEC_APPROVED, RequestStatus.HIRING]) },
        relations: ['client', 'broker', 'proposals'],
        order: { createdAt: 'DESC' },
        take: 60,
      }),
    ]);

    const recommendedJobs = recentRequests
      .filter((request) => {
        const hasAcceptedFreelancer = (request.proposals || []).some(
          (proposal) => `${proposal.status || ''}`.trim().toUpperCase() === 'ACCEPTED',
        );
        if (hasAcceptedFreelancer) {
          return false;
        }

        const ownProposal = (request.proposals || []).find(
          (proposal) => proposal.freelancerId === user.id,
        );
        if (ownProposal) {
          return false;
        }

        const haystack = this.buildRequestMatchText(request);
        const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
        const matchesSkills =
          skillFilter.length === 0 || skillFilter.some((skill) => haystack.includes(skill));

        return matchesSearch && matchesSkills;
      })
      .map((request) => {
        const haystack = this.buildRequestMatchText(request);
        const matchedSkills = skillNames.filter((skill) =>
          haystack.includes(skill.toLowerCase()),
        );
        const features = this.getCommercialFeatures(request);
        const agreedBudget =
          request.commercialBaseline?.agreedBudget ?? request.commercialBaseline?.estimatedBudget;

        return {
          id: request.id,
          title: request.title,
          description: request.description,
          productType:
            request.requestScopeBaseline?.productTypeLabel ??
            request.requestScopeBaseline?.productTypeCode ??
            null,
          projectGoalSummary: request.requestScopeBaseline?.projectGoalSummary ?? null,
          requestedDeadline:
            request.requestScopeBaseline?.requestedDeadline ?? request.requestedDeadline ?? null,
          budgetAmount: agreedBudget ?? null,
          budgetLabel: request.budgetRange ?? null,
          featureCount: features.length,
          matchedSkills: matchedSkills.slice(0, 6),
          matchingScore: matchedSkills.length,
          createdAt: request.createdAt,
          client: request.client
            ? {
                id: request.client.id,
                fullName: request.client.fullName,
                currentTrustScore: Number(request.client.currentTrustScore ?? 0),
                totalProjectsFinished: Number(request.client.totalProjectsFinished ?? 0),
              }
            : null,
        };
      })
      .sort((left, right) => {
        if (right.matchingScore !== left.matchingScore) {
          return right.matchingScore - left.matchingScore;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      })
      .slice(0, 20);

    return {
      filters: {
        search: normalizedSearch || null,
        skills: skillFilter,
        availableSkills: skillNames,
      },
      stats: {
        activeProjects: activeProjectsCount,
        completedProjects: completedProjectsCount,
        pendingInvitations: pendingInvitations.length,
        totalEarnings: Number(completedBudgetRaw?.total ?? 0),
        currentMonthEarnings: Number(currentMonthBudgetRaw?.total ?? 0),
      },
      profileCompleteness: this.computeProfileCompleteness({
        user,
        profile: profile ?? null,
        skillNames,
      }),
      activeProjects: activeProjects.map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        totalBudget: Number(project.totalBudget ?? 0),
        currency: project.currency ?? 'USD',
        updatedAt: project.updatedAt,
        client: project.client
          ? {
              id: project.client.id,
              fullName: project.client.fullName,
            }
          : null,
        broker: project.broker
          ? {
              id: project.broker.id,
              fullName: project.broker.fullName,
            }
          : null,
      })),
      pendingInvitations: pendingInvitations.map((proposal) => ({
        id: proposal.id,
        status: proposal.status,
        createdAt: proposal.createdAt,
        request: proposal.request
          ? {
              id: proposal.request.id,
              title: proposal.request.title,
              requestedDeadline:
                proposal.request.requestScopeBaseline?.requestedDeadline ??
                proposal.request.requestedDeadline ??
                null,
              budgetLabel: proposal.request.budgetRange ?? null,
              clientName: proposal.request.client?.fullName ?? null,
              brokerName: proposal.request.broker?.fullName ?? null,
            }
          : null,
      })),
      recommendedJobs,
    };
  }
}
