import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ProjectEntity,
  ReviewEntity,
  UserEntity,
  UserStatus,
} from 'src/database/entities';
import { Repository } from 'typeorm';
import { ProfileEntity } from '../../database/entities/profile.entity';

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
  viewerRoleInProject: null;
  client: { id: string; fullName: string } | null;
  broker: { id: string; fullName: string } | null;
  freelancer: { id: string; fullName: string } | null;
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

  async getTrustProfile(userId: string) {
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

    const [reviews, projectHistory] = await Promise.all([
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
    ]);

    return {
      user: this.mapUser(user, user.profile ?? null),
      reviews: reviews.map((review) => this.mapReview(review)),
      projectHistory: projectHistory.map((project) => this.mapProjectHistory(project, userId)),
    };
  }

  private mapUser(user: UserEntity, profile: ProfileEntity | null): TrustProfileUserResponse {
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
      createdAt: user.createdAt?.toISOString(),
    };
  }

  private mapReview(review: ReviewEntity): TrustProfileReviewResponse {
    const reviewer = review.reviewer as (UserEntity & { profile?: ProfileEntity | null }) | null;
    const reviewerProfile = reviewer?.profile ?? null;
    const project = review.project as (ProjectEntity & { categories?: Array<{ name?: string | null }> }) | null;

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
  ): TrustProfileProjectHistoryResponse {
    return {
      projectId: project.id,
      title: project.title,
      status: project.status,
      totalBudget: Number(project.totalBudget ?? 0),
      completedAt:
        (project.endDate ?? project.updatedAt ?? project.createdAt).toISOString(),
      targetRoleInProject: this.resolveTargetRoleInProject(project, targetUserId),
      viewerRoleInProject: null,
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

  private resolveTargetRoleInProject(project: ProjectEntity, targetUserId: string): string {
    if (project.clientId === targetUserId) {
      return 'CLIENT';
    }

    if (project.brokerId === targetUserId) {
      return 'BROKER';
    }

    if (project.freelancerId === targetUserId) {
      return 'FREELANCER';
    }

    return 'UNKNOWN';
  }
}
