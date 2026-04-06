import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  AuditLogEntity,
  ProjectEntity,
  ProjectStatus,
  ReportEntity,
  ReviewEntity,
  UserEntity,
} from 'src/database/entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { REVIEW_EVENTS } from './events/review.events';
import { ReviewService } from './review.service';
import { recordEvidence } from '../../../test/fe16-fe18/evidence-recorder';

const repoMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
  softRemove: jest.fn(),
});

describe('ReviewService', () => {
  let service: ReviewService;
  let auditLogsService: { log: jest.Mock; logOrThrow: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock; transaction: jest.Mock };
  let eventEmitter: { emitAsync: jest.Mock };

  const reviewRepo = repoMock();
  const projectRepo = repoMock();
  const auditLogRepo = repoMock();
  const reportRepo = repoMock();
  const userRepo = repoMock();
  const transactionProjectRepo = {
    findOne: jest.fn(),
  };
  const transactionAuditRepo = {
    create: jest.fn().mockImplementation((payload) => payload),
    save: jest.fn().mockImplementation(async (payload) => payload),
  };
  const transactionReviewRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    softRemove: jest.fn(),
  };
  const transactionManager = {
    getRepository: jest.fn(),
  };
  const transactionReviewQueryBuilder = {
    withDeleted: jest.fn(),
    setLock: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(),
  };
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn(),
    },
  };

  const baseReview = {
    id: 'review-1',
    assignmentVersion: 1,
    openedById: null,
    currentAssigneeId: null,
    lastAssignedById: null,
    lastAssignedAt: null,
  };

  const seedModerationMutation = (reviewOverrides?: Partial<typeof baseReview>) => {
    const persistedReview = {
      ...baseReview,
      ...reviewOverrides,
    };

    transactionReviewRepo.findOne.mockResolvedValue(persistedReview);
    transactionReviewRepo.save.mockImplementation(async (review) => review);
    transactionReviewQueryBuilder.withDeleted.mockReturnValue(transactionReviewQueryBuilder);
    transactionReviewQueryBuilder.setLock.mockReturnValue(transactionReviewQueryBuilder);
    transactionReviewQueryBuilder.where.mockReturnValue(transactionReviewQueryBuilder);
    transactionReviewQueryBuilder.getOne.mockResolvedValue(persistedReview);
    transactionReviewRepo.createQueryBuilder.mockReturnValue(transactionReviewQueryBuilder);
    jest
      .spyOn(service as never, 'loadReviewForModeration' as never)
      .mockResolvedValue({ id: persistedReview.id } as never);
    jest
      .spyOn(service as never, 'getPendingReportInfoMap' as never)
      .mockResolvedValue(new Map() as never);
    jest
      .spyOn(service as never, 'mapReviewForModeration' as never)
      .mockImplementation((review) => review as never);
    jest
      .spyOn(service as never, 'notifyModerationWatchers' as never)
      .mockResolvedValue(undefined as never);

    return persistedReview;
  };

  beforeEach(async () => {
    Object.values({
      reviewRepo,
      projectRepo,
      auditLogRepo,
      reportRepo,
      userRepo,
      transactionProjectRepo,
      transactionAuditRepo,
      transactionReviewRepo,
      transactionReviewQueryBuilder,
    }).forEach((repo) => {
      Object.values(repo).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as jest.Mock).mockReset();
        }
      });
    });

    queryRunner.connect.mockReset().mockResolvedValue(undefined);
    queryRunner.startTransaction.mockReset().mockResolvedValue(undefined);
    queryRunner.commitTransaction.mockReset().mockResolvedValue(undefined);
    queryRunner.rollbackTransaction.mockReset().mockResolvedValue(undefined);
    queryRunner.release.mockReset().mockResolvedValue(undefined);
    queryRunner.manager.getRepository.mockReset().mockReturnValue(transactionReviewRepo);
    transactionReviewRepo.softRemove.mockReset().mockImplementation(async (review) => ({
      ...review,
      deletedAt: new Date('2026-03-19T10:00:00.000Z'),
    }));
    transactionProjectRepo.findOne.mockReset();
    transactionAuditRepo.create.mockClear();
    transactionAuditRepo.save.mockClear();
    transactionManager.getRepository.mockReset().mockImplementation((entity) => {
      switch (entity) {
        case ReviewEntity:
          return transactionReviewRepo;
        case ProjectEntity:
          return transactionProjectRepo;
        case AuditLogEntity:
          return transactionAuditRepo;
        case ReportEntity:
          return reportRepo;
        case UserEntity:
          return userRepo;
        default:
          return reviewRepo;
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(ReviewEntity), useValue: reviewRepo },
        { provide: getRepositoryToken(ProjectEntity), useValue: projectRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: auditLogRepo },
        { provide: getRepositoryToken(ReportEntity), useValue: reportRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
            logOrThrow: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emitAsync: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createMany: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
            transaction: jest.fn().mockImplementation(async (callback: (manager: typeof transactionManager) => unknown) =>
              callback(transactionManager),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    auditLogsService = module.get(AuditLogsService);
    dataSource = module.get(DataSource);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a review for PAID projects and emits a post-commit trust score event', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.PAID,
      clientId: 'reviewer-1',
      freelancerId: 'target-1',
      brokerId: null,
      totalBudget: 20000000,
    });
    reviewRepo.findOne.mockResolvedValue(null);
    reviewRepo.create.mockImplementation((payload) => payload);
    transactionReviewRepo.save.mockResolvedValue({
      id: 'review-2',
      projectId: 'project-1',
      reviewerId: 'reviewer-1',
      targetUserId: 'target-1',
      rating: 5,
      comment: 'Great work',
      weight: 1.5,
      createdAt: new Date('2026-03-19T09:00:00.000Z'),
      updatedAt: new Date('2026-03-19T09:00:00.000Z'),
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    });

    const result = await service.create(
      'reviewer-1',
      {
        projectId: 'project-1',
        targetUserId: 'target-1',
        rating: 5,
        comment: 'Great work',
      },
      { requestId: 'req-1', sessionId: 'sess-1' },
    );

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(auditLogsService.logOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_REVIEW',
        entityId: 'review-2',
        eventName: 'review-created',
      }),
      transactionAuditRepo,
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      REVIEW_EVENTS.MUTATED,
      expect.objectContaining({
        reviewId: 'review-2',
        targetUserId: 'target-1',
        trigger: 'created',
        triggeredBy: 'reviewer-1',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'review-2', weight: 1.5 }));
    recordEvidence({
      id: 'FE16-REV-01',
      evidenceRef: 'review.service.spec.ts::creates a review for PAID projects',
      actualResults:
        'ReviewService.create committed the review, called transactional audit logging, and emitted REVIEW_EVENTS.MUTATED with reviewId=review-2 and targetUserId=target-1.',
    });
  });

  it('rejects review creation when project is not completed or paid', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.IN_PROGRESS,
      clientId: 'reviewer-1',
      freelancerId: 'target-1',
      brokerId: null,
      totalBudget: 20000000,
    });

    await expect(
      service.create(
        'reviewer-1',
        {
          projectId: 'project-1',
          targetUserId: 'target-1',
          rating: 5,
          comment: 'Great work',
        },
        {},
      ),
    ).rejects.toThrow('completed or paid project');

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    recordEvidence({
      id: 'FE16-REV-02',
      evidenceRef: 'review.service.spec.ts::rejects ineligible project',
      actualResults:
        'ReviewService.create rejected an IN_PROGRESS project before starting a transaction and did not emit any post-commit trust-score mutation event.',
    });
  });

  it('rolls back review creation when audit logging inside the transaction fails', async () => {
    projectRepo.findOne.mockResolvedValue({
      id: 'project-1',
      status: ProjectStatus.COMPLETED,
      clientId: 'reviewer-1',
      freelancerId: 'target-1',
      brokerId: null,
      totalBudget: 5000000,
    });
    reviewRepo.findOne.mockResolvedValue(null);
    reviewRepo.create.mockImplementation((payload) => payload);
    transactionReviewRepo.save.mockResolvedValue({
      id: 'review-rollback',
      projectId: 'project-1',
      reviewerId: 'reviewer-1',
      targetUserId: 'target-1',
      rating: 4,
      comment: 'Good',
      weight: 1,
      createdAt: new Date('2026-03-19T09:00:00.000Z'),
      updatedAt: new Date('2026-03-19T09:00:00.000Z'),
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    });
    auditLogsService.logOrThrow.mockRejectedValueOnce(new Error('audit failure'));

    await expect(
      service.create(
        'reviewer-1',
        {
          projectId: 'project-1',
          targetUserId: 'target-1',
          rating: 4,
          comment: 'Good',
        },
        {},
      ),
    ).rejects.toThrow('audit failure');

    expect(transactionReviewRepo.save).toHaveBeenCalled();
    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    recordEvidence({
      id: 'FE16-REV-03',
      evidenceRef: 'review.service.spec.ts::rolls back on audit failure',
      actualResults:
        'ReviewService.create surfaced the injected audit failure after the transactional save path and did not emit REVIEW_EVENTS.MUTATED, proving the success path was not committed.',
    });
  });

  it('updates a review and emits a post-commit trust score event', async () => {
    reviewRepo.findOne.mockResolvedValue({
      id: 'review-3',
      reviewerId: 'reviewer-1',
      targetUserId: 'target-1',
      rating: 3,
      comment: 'Old',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    });
    transactionReviewRepo.save.mockImplementation(async (review) => ({
      ...review,
      updatedAt: new Date('2026-03-19T10:00:00.000Z'),
    }));

    const result = await service.update(
      'reviewer-1',
      'review-3',
      { rating: 5, comment: 'Updated' },
      { requestId: 'req-update' },
    );

    expect(auditLogsService.logOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_REVIEW',
        entityId: 'review-3',
        eventName: 'review-updated',
      }),
      transactionAuditRepo,
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      REVIEW_EVENTS.MUTATED,
      expect.objectContaining({
        reviewId: 'review-3',
        targetUserId: 'target-1',
        trigger: 'updated',
      }),
    );
    expect(result).toEqual(expect.objectContaining({ rating: 5, comment: 'Updated' }));
    recordEvidence({
      id: 'FE16-REV-04',
      evidenceRef: 'review.service.spec.ts::updates a review',
      actualResults:
        'ReviewService.update returned the updated rating/comment, wrote UPDATE_REVIEW audit metadata, and emitted REVIEW_EVENTS.MUTATED for review-3.',
    });
  });

  it('soft deletes a review and emits a post-commit trust score event', async () => {
    jest
      .spyOn(service as never, 'notifyModerationWatchers' as never)
      .mockResolvedValue(undefined as never);
    reviewRepo.findOne.mockResolvedValue({
      id: 'review-4',
      targetUserId: 'target-2',
      reviewerId: 'reviewer-2',
      rating: 2,
      comment: 'Bad',
      weight: 1,
      createdAt: new Date('2026-03-10T09:00:00.000Z'),
      updatedAt: new Date('2026-03-10T09:00:00.000Z'),
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    });

    await service.softDelete('review-4', 'admin-1', 'policy');

    expect(auditLogsService.logOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_REVIEW',
        entityId: 'review-4',
        eventName: 'review-soft-deleted',
      }),
      transactionAuditRepo,
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      REVIEW_EVENTS.MUTATED,
      expect.objectContaining({
        reviewId: 'review-4',
        targetUserId: 'target-2',
        trigger: 'soft_deleted',
      }),
    );
  });

  it('restores a review and emits a post-commit trust score event', async () => {
    jest
      .spyOn(service as never, 'notifyModerationWatchers' as never)
      .mockResolvedValue(undefined as never);
    reviewRepo.findOne.mockResolvedValue({
      id: 'review-5',
      targetUserId: 'target-3',
      reviewerId: 'reviewer-3',
      rating: 5,
      comment: 'Excellent',
      weight: 1,
      createdAt: new Date('2026-03-10T09:00:00.000Z'),
      updatedAt: new Date('2026-03-10T09:00:00.000Z'),
      deletedAt: new Date('2026-03-18T09:00:00.000Z'),
      deletedBy: 'admin-old',
      deleteReason: 'policy',
    });
    transactionReviewRepo.save.mockImplementation(async (review) => ({
      ...review,
      updatedAt: new Date('2026-03-19T10:30:00.000Z'),
    }));

    await service.restore('review-5', 'admin-1', 'restored');

    expect(auditLogsService.logOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RESTORE_REVIEW',
        entityId: 'review-5',
        eventName: 'review-restored',
      }),
      transactionAuditRepo,
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      REVIEW_EVENTS.MUTATED,
      expect.objectContaining({
        reviewId: 'review-5',
        targetUserId: 'target-3',
        trigger: 'restored',
      }),
    );
  });

  it('opens a moderation case and records openedBy/version', async () => {
    seedModerationMutation({ assignmentVersion: 2, openedById: null });

    const result = await service.openModerationCase('review-1', 'admin-1', 2);

    expect(dataSource.createQueryRunner).toHaveBeenCalled();
    expect(transactionReviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        openedById: 'admin-1',
        assignmentVersion: 3,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 'review-1' }));
  });

  it('takes a moderation case and assigns current owner', async () => {
    seedModerationMutation({ assignmentVersion: 4 });

    await service.takeModerationCase('review-1', 'admin-1', 4);

    expect(transactionReviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAssigneeId: 'admin-1',
        lastAssignedById: 'admin-1',
        assignmentVersion: 5,
        lastAssignedAt: expect.any(Date),
      }),
    );
  });

  it('releases a moderation case and clears ownership', async () => {
    seedModerationMutation({
      assignmentVersion: 6,
      currentAssigneeId: 'admin-2',
      lastAssignedById: 'admin-2',
    });

    await service.releaseModerationCase('review-1', 'admin-1', 6);

    expect(transactionReviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAssigneeId: null,
        lastAssignedById: 'admin-1',
        assignmentVersion: 7,
        lastAssignedAt: expect.any(Date),
      }),
    );
  });

  it('reassigns a moderation case and records the handoff reason', async () => {
    seedModerationMutation({
      assignmentVersion: 8,
      currentAssigneeId: 'admin-1',
      lastAssignedById: 'admin-1',
    });

    await service.reassignModerationCase('review-1', 'admin-1', 'admin-3', 8, 'handoff');

    expect(transactionReviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAssigneeId: 'admin-3',
        lastAssignedById: 'admin-1',
        assignmentVersion: 9,
        lastAssignedAt: expect.any(Date),
      }),
    );
    expect(auditLogsService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REASSIGN_REVIEW_MODERATION',
        entityId: 'review-1',
        newData: expect.objectContaining({
          assigneeId: 'admin-3',
          reason: 'handoff',
          assignmentVersion: 9,
        }),
      }),
    );
  });

  it.each([
    {
      label: 'open',
      invoke: () => service.openModerationCase('review-1', 'admin-1', 1),
    },
    {
      label: 'take',
      invoke: () => service.takeModerationCase('review-1', 'admin-1', 1),
    },
    {
      label: 'release',
      invoke: () => service.releaseModerationCase('review-1', 'admin-1', 1),
    },
    {
      label: 'reassign',
      invoke: () =>
        service.reassignModerationCase('review-1', 'admin-1', 'admin-2', 1, 'stale-owner'),
    },
  ])('rejects stale assignmentVersion for $label', async ({ label, invoke }) => {
    seedModerationMutation({ assignmentVersion: 2 });

    await expect(invoke()).rejects.toThrow(ConflictException);

    expect(transactionReviewRepo.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(auditLogsService.log).not.toHaveBeenCalled();
    if (label === 'reassign') {
      recordEvidence({
        id: 'FE16-REV-05',
        evidenceRef: 'review.service.spec.ts::rejects stale moderation assignmentVersion',
        actualResults:
          'The moderation mutation with stale assignmentVersion threw ConflictException, skipped the save path, rolled back the query runner transaction, and produced no moderation audit log.',
        note: 'Equivalent stale-version protection also passed for open, take, and release moderation actions.',
      });
    }
  });
});
