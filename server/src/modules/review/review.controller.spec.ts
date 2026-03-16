import { Test, TestingModule } from '@nestjs/testing';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

describe('ReviewController', () => {
  let controller: ReviewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        {
          provide: ReviewService,
          useValue: {
            getReviewsForModeration: jest.fn(),
            getAllReviewsForTest: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
            dismissReport: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findByTargetUser: jest.fn(),
            getEditHistory: jest.fn(),
            getFlaggedReviews: jest.fn(),
            openModerationCase: jest.fn(),
            takeModerationCase: jest.fn(),
            releaseModerationCase: jest.fn(),
            reassignModerationCase: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ReviewController>(ReviewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
