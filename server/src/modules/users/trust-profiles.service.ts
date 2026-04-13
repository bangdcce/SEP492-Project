import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ProjectEntity,
  ProjectStatus,
  ReviewEntity,
  UserEntity,
  UserStatus,
} from 'src/database/entities';
import { In, Repository } from 'typeorm';
import { ProfileEntity } from '../../database/entities/profile.entity';

const REVIEWABLE_PROJECT_STATUSES = [ProjectStatus.COMPLETED, ProjectStatus.PAID];

type TrustProfileUserResponse = {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  isEmailVerified: boolean;
  currentTrustScore: number;
  badge: string;
  stats: {
    finished: number;
    disputes: number;
    score: number;
  };
  role?: string;
  bio?: string;
  skills?: string[];
  cvUrl?: string;
  linkedinUrl?: string;
  portfolioLinks?: Array<{
    title?: string;
    url: string;
  }>;
  createdAt?: string;
};

type TrustProfileReviewResponse = {
  id: string;
  rating: number;
  comment: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    bio?: string;
    badge?: string;
    currentTrustScore?: number;
    stats?: {
      finished: number;
      disputes: number;
      score: number;
    };
    email?: string;
    joinedDate?: string;
  };
  project: {
    id: string;
    title: string;
    totalBudget: number;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
  };
};

type TrustProfileProjectHistoryResponse = {
  projectId: string;
  title: string;
  status: string;
  totalBudget: number;
  completedAt: string;
  targetRoleInProject: string;
  viewerRoleInProject: string | null;
  client: { id: string; fullName: string } | null;
  broker: { id: string; fullName: string } | null;
  freelancer: { id: string; fullName: string } | null;
};

type TrustProfileReviewEligibilityReason =
  | 'ELIGIBLE'
  | 'SELF_PROFILE'
  | 'VIEWER_NOT_AVAILABLE'
  | 'NO_SHARED_COMPLETED_PROJECT'
  | 'ALREADY_REVIEWED_ALL_SHARED_PROJECTS';

type TrustProfileReviewCandidateProject = {
  projectId: string;
  title: string;
  status: string;
  completedAt: string;
  targetRoleInProject: string;
  viewerRoleInProject: string | null;
};

type TrustProfileReviewEligibilityResponse = {
  canCreateReview: boolean;
  reason: TrustProfileReviewEligibilityReason;
  pendingReviewCount: number;
  nextProject: TrustProfileReviewCandidateProject | null;
  pendingProjects: TrustProfileReviewCandidateProject[];
};

@Injectable()
export class TrustProfilesService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ReviewEntity)
    private readonly reviewRepo: Repository<ReviewEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  async getTrustProfile(userId: string, viewerUserId?: string | null) {
    const user = await this.userRepo.findOne({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
      },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [reviews, projectHistory, reviewEligibility] = await Promise.all([
      this.reviewRepo.find({
        where: { targetUserId: userId },
        relations: ['reviewer', 'reviewer.profile', 'project', 'project.categories'],
        order: { createdAt: 'DESC' },
      }),
      this.projectRepo.find({
        where: [{ clientId: userId }, { brokerId: userId }, { freelancerId: userId }],
        relations: ['client', 'broker', 'freelancer'],
        order: { updatedAt: 'DESC' },
        take: 25,
      }),
      this.computeReviewEligibility(userId, viewerUserId),
    ]);

    return {
      user: this.mapUser(user, user.profile ?? null),
      reviews: reviews.map((review) => this.mapReview(review)),
      projectHistory: projectHistory.map((project) =>
        this.mapProjectHistory(project, userId, viewerUserId),
      ),
      reviewEligibility,
    };
  }

  private async computeReviewEligibility(
    targetUserId: string,
    viewerUserId?: string | null,
  ): Promise<TrustProfileReviewEligibilityResponse> {
    if (!viewerUserId) {
      return {
        canCreateReview: false,
        reason: 'VIEWER_NOT_AVAILABLE',
        pendingReviewCount: 0,
        nextProject: null,
        pendingProjects: [],
      };
    }

    if (viewerUserId === targetUserId) {
      return {
        canCreateReview: false,
        reason: 'SELF_PROFILE',
        pendingReviewCount: 0,
        nextProject: null,
        pendingProjects: [],
      };
    }

    const sharedProjects = await this.projectRepo
      .createQueryBuilder('project')
      .where('project.status IN (:...statuses)', {
        statuses: REVIEWABLE_PROJECT_STATUSES,
      })
      .andWhere(
        '(project.clientId = :viewerUserId OR project.brokerId = :viewerUserId OR project.freelancerId = :viewerUserId)',
        {
          viewerUserId,
        },
      )
      .andWhere(
        '(project.clientId = :targetUserId OR project.brokerId = :targetUserId OR project.freelancerId = :targetUserId)',
        {
          targetUserId,
        },
      )
      .orderBy('COALESCE(project.endDate, project.updatedAt, project.createdAt)', 'DESC')
      .getMany();

    if (sharedProjects.length === 0) {
      return {
        canCreateReview: false,
        reason: 'NO_SHARED_COMPLETED_PROJECT',
        pendingReviewCount: 0,
        nextProject: null,
        pendingProjects: [],
      };
    }

    const sharedProjectIds = sharedProjects.map((project) => project.id);
    const existingReviews = await this.reviewRepo.find({
      where: {
        reviewerId: viewerUserId,
        targetUserId,
        projectId: In(sharedProjectIds),
      },
      select: ['projectId'],
    });
    const reviewedProjectIds = new Set(existingReviews.map((review) => review.projectId));

    const pendingProjects: TrustProfileReviewCandidateProject[] = sharedProjects
      .filter((project) => !reviewedProjectIds.has(project.id))
      .map((project) => ({
        projectId: project.id,
        title: project.title,
        status: project.status,
        completedAt: (project.endDate ?? project.updatedAt ?? project.createdAt).toISOString(),
        targetRoleInProject: this.resolveUserRoleInProject(project, targetUserId),
        viewerRoleInProject: this.resolveUserRoleInProject(project, viewerUserId),
      }));

    if (pendingProjects.length === 0) {
      return {
        canCreateReview: false,
        reason: 'ALREADY_REVIEWED_ALL_SHARED_PROJECTS',
        pendingReviewCount: 0,
        nextProject: null,
        pendingProjects: [],
      };
    }

    return {
      canCreateReview: true,
      reason: 'ELIGIBLE',
      pendingReviewCount: pendingProjects.length,
      nextProject: pendingProjects[0],
      pendingProjects,
    };
  }

  private mapUser(user: UserEntity, profile: ProfileEntity | null): TrustProfileUserResponse {
    const normalizedRole = String(user.role ?? '').toUpperCase();
    const canExposeProfessionalLinks =
      normalizedRole === 'FREELANCER' || normalizedRole === 'BROKER';

    const cvUrl = profile?.cvUrl?.trim() || undefined;
    const linkedinUrl = profile?.linkedinUrl?.trim() || undefined;
    const portfolioLinks = Array.isArray(profile?.portfolioLinks)
      ? profile.portfolioLinks
          .map((item) => ({
            title: item?.title?.trim() || undefined,
            url: item?.url?.trim() || '',
          }))
          .filter((item) => item.url.length > 0)
      : [];

    return {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: profile?.avatarUrl ?? null,
      isVerified: Boolean(user.isVerified),
      isEmailVerified: Boolean(user.emailVerifiedAt),
      currentTrustScore: Number(user.currentTrustScore ?? 0),
      badge: user.badge,
      stats: {
        finished: user.stats.finished,
        disputes: user.stats.disputes,
        score: Number(user.stats.score ?? 0),
      },
      role: user.role,
      bio: profile?.bio ?? undefined,
      skills: Array.isArray(profile?.skills) ? profile.skills : [],
      cvUrl: canExposeProfessionalLinks ? cvUrl : undefined,
      linkedinUrl: canExposeProfessionalLinks ? linkedinUrl : undefined,
      portfolioLinks: canExposeProfessionalLinks ? portfolioLinks : [],
      createdAt: user.createdAt?.toISOString(),
    };
  }

  private mapReview(review: ReviewEntity): TrustProfileReviewResponse {
    const reviewer = review.reviewer as (UserEntity & { profile?: ProfileEntity | null }) | null;
    const reviewerProfile = reviewer?.profile ?? null;
    const project = review.project as
      | (ProjectEntity & { categories?: Array<{ name?: string | null }> })
      | null;

    return {
      id: review.id,
      rating: Number(review.rating ?? 0),
      comment: review.comment ?? '',
      weight: Number(review.weight ?? 0),
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      reviewer: {
        id: reviewer?.id ?? '',
        fullName: reviewer?.fullName ?? 'Unknown reviewer',
        avatarUrl: reviewerProfile?.avatarUrl ?? null,
        bio: reviewerProfile?.bio ?? undefined,
        badge: reviewer?.badge,
        currentTrustScore:
          reviewer && reviewer.currentTrustScore != null
            ? Number(reviewer.currentTrustScore)
            : undefined,
        stats: reviewer
          ? {
              finished: reviewer.stats.finished,
              disputes: reviewer.stats.disputes,
              score: Number(reviewer.stats.score ?? 0),
            }
          : undefined,
        email: reviewer?.email ?? undefined,
        joinedDate: reviewer?.createdAt?.toISOString(),
      },
      project: {
        id: project?.id ?? review.projectId,
        title: project?.title ?? 'Project',
        totalBudget: Number(project?.totalBudget ?? 0),
        description: project?.description ?? undefined,
        startDate: project?.startDate?.toISOString(),
        endDate: project?.endDate?.toISOString(),
        status: project?.status,
        category: project?.categories?.[0]?.name ?? undefined,
      },
    };
  }

  private mapProjectHistory(
    project: ProjectEntity,
    targetUserId: string,
    viewerUserId?: string | null,
  ): TrustProfileProjectHistoryResponse {
    return {
      projectId: project.id,
      title: project.title,
      status: project.status,
      totalBudget: Number(project.totalBudget ?? 0),
      completedAt: (project.endDate ?? project.updatedAt ?? project.createdAt).toISOString(),
      targetRoleInProject: this.resolveUserRoleInProject(project, targetUserId),
      viewerRoleInProject: viewerUserId
        ? this.resolveUserRoleInProject(project, viewerUserId)
        : null,
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
      freelancer: project.freelancer
        ? {
            id: project.freelancer.id,
            fullName: project.freelancer.fullName,
          }
        : null,
    };
  }

  private resolveUserRoleInProject(project: ProjectEntity, userId: string): string {
    if (project.clientId === userId) {
      return 'CLIENT';
    }

    if (project.brokerId === userId) {
      return 'BROKER';
    }

    if (project.freelancerId === userId) {
      return 'FREELANCER';
    }

    return 'UNKNOWN';
  }
}
