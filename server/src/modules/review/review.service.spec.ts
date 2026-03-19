import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  AuditLogEntity,
  ProjectEntity,
  ReportEntity,
  ReviewEntity,
  UserEntity,
} from 'src/database/entities';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrustScoreService } from '../trust-score/trust-score.service';
import { ReviewService } from './review.service';

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
  let auditLogsService: { log: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };

  const reviewRepo = repoMock();
  const projectRepo = repoMock();
  const auditLogRepo = repoMock();
  const reportRepo = repoMock();
  const userRepo = repoMock();
  const transactionReviewRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: getRepositoryToken(ReviewEntity), useValue: reviewRepo },
        { provide: getRepositoryToken(ProjectEntity), useValue: projectRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: auditLogRepo },
        { provide: getRepositoryToken(ReportEntity), useValue: reportRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        {
          provide: TrustScoreService,
          useValue: {
            calculateTrustScore: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
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
          },
        },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    auditLogsService = module.get(AuditLogsService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
  ])('rejects stale assignmentVersion for $label', async ({ invoke }) => {
    seedModerationMutation({ assignmentVersion: 2 });

    await expect(invoke()).rejects.toThrow(ConflictException);

    expect(transactionReviewRepo.save).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(auditLogsService.log).not.toHaveBeenCalled();
  });
});
