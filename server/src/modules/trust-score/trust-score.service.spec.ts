import { Test, TestingModule } from '@nestjs/testing';
import { TrustScoreService } from './trust-score.service';

describe('TrustScoreService', () => {
  let service: TrustScoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustScoreService],
    }).compile();

    service = module.get<TrustScoreService>(TrustScoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
