import { Test, TestingModule } from '@nestjs/testing';
import { ClassifierService } from './classifier.service';
import { ClassificationLabel, ScoredCandidate } from './interfaces/match.interfaces';

describe('ClassifierService', () => {
  let service: ClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassifierService],
    }).compile();

    service = module.get<ClassifierService>(ClassifierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('classify', () => {
    const baseCandidate: ScoredCandidate = {
      userId: '1',
      fullName: 'Test User',
      bio: '',
      rawProfileSkills: [],
      skills: [],
      trustScore: 5,
      kycStatus: 'VERIFIED',
      activeProjectCount: 0,
      disputesLost: 0,
      totalProjectsFinished: 10,
      tagOverlapScore: 80,
      matchedSkills: [],
      aiRelevanceScore: 90,
    };

    it('assigns PERFECT_MATCH when AI mode is enabled and both relevance and score are strong', () => {
      const results = service.classify([{ ...baseCandidate }] as any, true);

      expect(results[0].classificationLabel).toBe(ClassificationLabel.PERFECT_MATCH);
      expect(results[0].normalizedTrust).toBe(100);
      expect(results[0].matchScore).toBe(89);
    });

    it('assigns HIGH_RISK when AI mode is enabled and the AI relevance score is too low', () => {
      const results = service.classify(
        [{ ...baseCandidate, aiRelevanceScore: 35, tagOverlapScore: 90 }] as any,
        true,
      );

      expect(results[0].classificationLabel).toBe(ClassificationLabel.HIGH_RISK);
      expect(results[0].matchScore).toBe(64.5);
    });

    it('assigns POTENTIAL when AI mode is enabled and the overall score is good but not perfect', () => {
      const results = service.classify(
        [{ ...baseCandidate, trustScore: 3.5, aiRelevanceScore: 70, tagOverlapScore: 60 }] as any,
        true,
      );

      expect(results[0].classificationLabel).toBe(ClassificationLabel.POTENTIAL);
      expect(results[0].matchScore).toBe(67);
    });

    it('assigns NORMAL when AI mode is disabled and the weighted score stays above the threshold', () => {
      const results = service.classify(
        [{ ...baseCandidate, trustScore: 4, aiRelevanceScore: null, tagOverlapScore: 70 }] as any,
        false,
      );

      expect(results[0].classificationLabel).toBe(ClassificationLabel.NORMAL);
      expect(results[0].matchScore).toBe(73);
    });

    it('assigns HIGH_RISK when AI mode is disabled and the weighted score falls below the threshold', () => {
      const results = service.classify(
        [{ ...baseCandidate, trustScore: 1, aiRelevanceScore: null, tagOverlapScore: 40 }] as any,
        false,
      );

      expect(results[0].classificationLabel).toBe(ClassificationLabel.HIGH_RISK);
      expect(results[0].matchScore).toBe(34);
    });

    it('sorts classified results by matchScore descending', () => {
      const c1 = { ...baseCandidate, userId: '1', aiRelevanceScore: 50, tagOverlapScore: 50 };
      const c2 = { ...baseCandidate, userId: '2', aiRelevanceScore: 95, tagOverlapScore: 80 };
      const c3 = { ...baseCandidate, userId: '3', aiRelevanceScore: 80, tagOverlapScore: 80 };

      const results = service.classify([c1, c2, c3] as any, true);

      expect(results[0].userId).toBe('2');
      expect(results[1].userId).toBe('3');
      expect(results[2].userId).toBe('1');
    });
  });
});
