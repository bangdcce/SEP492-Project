import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { ReviewEntity, TrustScoreHistoryEntity, UserEntity } from 'src/database/entities';
import { TrustScoreService } from './trust-score.service';

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((payload) => payload),
});

describe('TrustScoreService', () => {
  let service: TrustScoreService;
  const userRepo = repoMock();
  const reviewRepo = repoMock();
  const historyRepo = repoMock();

  beforeEach(async () => {
    Object.values({ userRepo, reviewRepo, historyRepo }).forEach((repo) => {
      Object.values(repo).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          (fn as jest.Mock).mockReset();
        }
      });
    });
    historyRepo.create.mockImplementation((payload) => payload);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustScoreService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(ReviewEntity), useValue: reviewRepo },
        { provide: getRepositoryToken(TrustScoreHistoryEntity), useValue: historyRepo },
      ],
    }).compile();

    service = module.get<TrustScoreService>(TrustScoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('recalculates trust score using only active reviews', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      currentTrustScore: 2.5,
      totalProjectsFinished: 3,
      totalProjectsCancelled: 0,
      totalDisputesLost: 0,
      totalLateProjects: 0,
      isVerified: true,
    });
    reviewRepo.find.mockResolvedValue([
      { id: 'review-1', rating: 5, weight: 1.5 },
      { id: 'review-2', rating: 4, weight: 1.0 },
    ]);
    userRepo.save.mockImplementation(async (user) => user);
    historyRepo.save.mockImplementation(async (entry) => entry);

    const result = await service.calculateTrustScore('user-1');

    expect(reviewRepo.find).toHaveBeenCalledWith({
      where: {
        targetUserId: 'user-1',
        deletedAt: IsNull(),
      },
      select: ['id', 'rating', 'weight'],
    });
    expect(userRepo.save).toHaveBeenCalled();
    expect(historyRepo.save).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        oldScore: 2.5,
      }),
    );
  });

  it('handles committed review mutation events by recalculating trust score', async () => {
    const calculateSpy = jest
      .spyOn(service, 'calculateTrustScore')
      .mockResolvedValue(null);

    await service.handleReviewMutationCommitted({
      reviewId: 'review-9',
      targetUserId: 'target-9',
      trigger: 'created',
      triggeredBy: 'reviewer-9',
    });

    expect(calculateSpy).toHaveBeenCalledWith('target-9');
  });
});
