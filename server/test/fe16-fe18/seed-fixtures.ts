import { DataSource, Repository } from 'typeorm';
import {
  NotificationEntity,
  ProfileEntity,
  ProjectEntity,
  ProjectStatus,
  ReviewEntity,
  TrustScoreHistoryEntity,
  UserEntity,
  UserRole,
  UserStatus,
} from '../../src/database/entities';

const repo = <T>(dataSource: DataSource, entity: new () => T): Repository<T> =>
  dataSource.getRepository(entity);

let counter = 0;

const nextSuffix = (): number => {
  counter += 1;
  return counter;
};

export const resetFeatureTables = async (dataSource: DataSource): Promise<void> => {
  await dataSource.query(
    'TRUNCATE TABLE notifications, trust_score_history, reviews, profiles, projects, users RESTART IDENTITY CASCADE',
  );
};

export const seedUser = async (
  dataSource: DataSource,
  overrides: Partial<UserEntity> = {},
): Promise<UserEntity> => {
  const index = nextSuffix();
  const entity = repo(dataSource, UserEntity).create({
    email: overrides.email ?? `user${index}@example.com`,
    passwordHash: overrides.passwordHash ?? 'hashed-password',
    fullName: overrides.fullName ?? `Test User ${index}`,
    role: overrides.role ?? UserRole.CLIENT,
    phoneNumber: overrides.phoneNumber ?? `0900000${index}`.slice(0, 10),
    timeZone: overrides.timeZone ?? 'Asia/Saigon',
    isVerified: overrides.isVerified ?? false,
    totalProjectsFinished: overrides.totalProjectsFinished ?? 0,
    totalProjectsCancelled: overrides.totalProjectsCancelled ?? 0,
    totalDisputesLost: overrides.totalDisputesLost ?? 0,
    totalLateProjects: overrides.totalLateProjects ?? 0,
    currentTrustScore: overrides.currentTrustScore ?? 2.5,
    emailVerifiedAt: overrides.emailVerifiedAt ?? new Date('2026-03-01T09:00:00.000Z'),
    termsAcceptedAt: overrides.termsAcceptedAt ?? new Date('2026-03-01T09:00:00.000Z'),
    privacyAcceptedAt: overrides.privacyAcceptedAt ?? new Date('2026-03-01T09:00:00.000Z'),
    registrationIp: overrides.registrationIp ?? '127.0.0.1',
    registrationUserAgent: overrides.registrationUserAgent ?? 'jest',
    status: overrides.status ?? UserStatus.ACTIVE,
    isBanned: overrides.isBanned ?? false,
    ...overrides,
  });

  return repo(dataSource, UserEntity).save(entity);
};

export const seedProfile = async (
  dataSource: DataSource,
  userId: string,
  overrides: Partial<ProfileEntity> = {},
): Promise<ProfileEntity> => {
  const entity = repo(dataSource, ProfileEntity).create({
    userId,
    avatarUrl: overrides.avatarUrl ?? 'https://example.com/avatar.png',
    bio: overrides.bio ?? 'Integration profile bio',
    companyName: overrides.companyName ?? 'InterDev Labs',
    skills: overrides.skills ?? ['TypeScript', 'Testing'],
    portfolioLinks: overrides.portfolioLinks ?? [],
    linkedinUrl: overrides.linkedinUrl ?? null,
    cvUrl: overrides.cvUrl ?? null,
    bankInfo: overrides.bankInfo ?? null,
    ...overrides,
  });

  return repo(dataSource, ProfileEntity).save(entity);
};

export const seedProject = async (
  dataSource: DataSource,
  overrides: Partial<ProjectEntity>,
): Promise<ProjectEntity> => {
  const entity = repo(dataSource, ProjectEntity).create({
    requestId: overrides.requestId ?? null,
    clientId: overrides.clientId!,
    brokerId: overrides.brokerId!,
    freelancerId: overrides.freelancerId ?? null,
    staffId: overrides.staffId ?? null,
    staffInviteStatus: overrides.staffInviteStatus ?? null,
    title: overrides.title ?? 'Integration Project',
    description: overrides.description ?? 'Project used for integration evidence',
    totalBudget: overrides.totalBudget ?? 500,
    currency: overrides.currency ?? 'USD',
    pricingModel: overrides.pricingModel ?? null,
    startDate: overrides.startDate ?? new Date('2026-03-01T09:00:00.000Z'),
    endDate: overrides.endDate ?? new Date('2026-03-05T09:00:00.000Z'),
    status: overrides.status ?? ProjectStatus.COMPLETED,
    ...overrides,
  });

  return repo(dataSource, ProjectEntity).save(entity);
};

export const seedReview = async (
  dataSource: DataSource,
  overrides: Partial<ReviewEntity>,
): Promise<ReviewEntity> => {
  const entity = repo(dataSource, ReviewEntity).create({
    projectId: overrides.projectId!,
    reviewerId: overrides.reviewerId!,
    targetUserId: overrides.targetUserId!,
    rating: overrides.rating ?? 5,
    comment: overrides.comment ?? 'Integration review comment',
    weight: overrides.weight ?? 1,
    deletedAt: overrides.deletedAt ?? null,
    deletedBy: overrides.deletedBy ?? null,
    deleteReason: overrides.deleteReason ?? null,
    openedById: overrides.openedById ?? null,
    currentAssigneeId: overrides.currentAssigneeId ?? null,
    lastAssignedById: overrides.lastAssignedById ?? null,
    lastAssignedAt: overrides.lastAssignedAt ?? null,
    assignmentVersion: overrides.assignmentVersion ?? 0,
    ...overrides,
  });

  return repo(dataSource, ReviewEntity).save(entity);
};

export const seedNotification = async (
  dataSource: DataSource,
  overrides: Partial<NotificationEntity>,
): Promise<NotificationEntity> => {
  const entity = repo(dataSource, NotificationEntity).create({
    userId: overrides.userId!,
    title: overrides.title ?? 'Integration notification',
    body: overrides.body ?? 'Integration notification body',
    isRead: overrides.isRead ?? false,
    readAt: overrides.readAt ?? null,
    relatedType: overrides.relatedType ?? null,
    relatedId: overrides.relatedId ?? null,
    ...overrides,
  });

  return repo(dataSource, NotificationEntity).save(entity);
};

export const seedTrustScoreHistory = async (
  dataSource: DataSource,
  overrides: Partial<TrustScoreHistoryEntity>,
): Promise<TrustScoreHistoryEntity> => {
  const entity = repo(dataSource, TrustScoreHistoryEntity).create({
    userId: overrides.userId!,
    ratingScore: overrides.ratingScore ?? 4.5,
    behaviorScore: overrides.behaviorScore ?? 4.2,
    disputeScore: overrides.disputeScore ?? 4.8,
    verificationScore: overrides.verificationScore ?? 5,
    totalScore: overrides.totalScore ?? 4.6,
    ...overrides,
  });

  return repo(dataSource, TrustScoreHistoryEntity).save(entity);
};
