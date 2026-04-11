import { Test, TestingModule } from '@nestjs/testing';
import { TrustScoreController } from './trust-score.controller';
import { TrustScoreService } from './trust-score.service';

describe('TrustScoreController', () => {
  let controller: TrustScoreController;
  let trustScoreService: {
    calculateTrustScore: jest.Mock;
    getScoreHistory: jest.Mock;
  };

  beforeEach(async () => {
    trustScoreService = {
      calculateTrustScore: jest.fn(),
      getScoreHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrustScoreController],
      providers: [
        {
          provide: TrustScoreService,
          useValue: trustScoreService,
        },
      ],
    }).compile();

    controller = module.get<TrustScoreController>(TrustScoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates score calculation to the trust score service', async () => {
    trustScoreService.calculateTrustScore.mockResolvedValue({
      userId: 'user-1',
      oldScore: 2.5,
      newScore: 4.1,
    });

    await expect(controller.calculateScore('user-1')).resolves.toEqual(
      expect.objectContaining({
        userId: 'user-1',
        newScore: 4.1,
      }),
    );
    expect(trustScoreService.calculateTrustScore).toHaveBeenCalledWith('user-1');
  });

  it('delegates score history lookup with parsed limit', async () => {
    trustScoreService.getScoreHistory.mockResolvedValue([{ id: 'history-1' }]);

    await expect(controller.getHistory('user-1', '5')).resolves.toEqual([{ id: 'history-1' }]);
    expect(trustScoreService.getScoreHistory).toHaveBeenCalledWith('user-1', 5);
  });
});
