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

  describe('classifyAll', () => {
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

    it('should assign PERFECT_MATCH for high scores and verified KYC', () => {
      const candidates = [{ ...baseCandidate }];
      const results = service.classifyAll(candidates);

      expect(results[0].classificationLabel).toBe(ClassificationLabel.PERFECT_MATCH);
      // Math: (90 * 0.4) + (80 * 0.2) + (100 * 0.4) = 36 + 16 + 40 = 92
      expect(results[0].matchScore).toBe(92);
    });

    it('should assign HIGH_RISK if user has lost disputes, regardless of score', () => {
      const candidates = [{ ...baseCandidate, disputesLost: 1 }];
      const results = service.classifyAll(candidates);

      expect(results[0].classificationLabel).toBe(ClassificationLabel.HIGH_RISK);
      expect(results[0].matchScore).toBe(92); // Score is still high, but label overrides
    });

    it('should NOT assign HIGH_RISK to a brand new user (0 trust points, 0 projects)', () => {
      const newCandidate = {
        ...baseCandidate,
        trustScore: 0, // Never done a project
        totalProjectsFinished: 0,
        kycStatus: 'UNVERIFIED' as const,
        aiRelevanceScore: 90,
        tagOverlapScore: 90,
      };
      const results = service.classifyAll([newCandidate]);

      // Not HIGH_RISK because they have 0 projects (unproven, not proven bad)
      // They have high relevance (90) but trust < 2.5 (it's 0), so POTENTIAL
      expect(results[0].classificationLabel).toBe(ClassificationLabel.POTENTIAL);
    });

    it('should assign HIGH_RISK to an experienced user with terrible trust score', () => {
      const badCandidate = {
        ...baseCandidate,
        trustScore: 1.0, // Has done projects, but score is awful
        totalProjectsFinished: 5,
        aiRelevanceScore: 95,
        tagOverlapScore: 95,
      };
      const results = service.classifyAll([badCandidate]);

      expect(results[0].classificationLabel).toBe(ClassificationLabel.HIGH_RISK);
    });
    
    it('should assign POTENTIAL to high relevance but low trust score user', () => {
      const potentialCandidate = {
        ...baseCandidate,
        trustScore: 2.0, // Low trust, but not terrible enough for HIGH_RISK (< 1.5)
        totalProjectsFinished: 2,
        aiRelevanceScore: 88,
        tagOverlapScore: 85,
      };
      
      const results = service.classifyAll([potentialCandidate]);
      expect(results[0].classificationLabel).toBe(ClassificationLabel.POTENTIAL);
    });
    
    it('should assign NORMAL to average candidates', () => {
      const averageCandidate = {
        ...baseCandidate,
        trustScore: 3.5,
        aiRelevanceScore: 60,
        tagOverlapScore: 60,
        kycStatus: 'UNVERIFIED' as const,
      };
      
      const results = service.classifyAll([averageCandidate]);
      expect(results[0].classificationLabel).toBe(ClassificationLabel.NORMAL);
      // 60*0.4 + 60*0.2 + 70*0.4 = 24 + 12 + 28 = 64
      expect(results[0].matchScore).toBe(64);
    });

    it('should sort results by matchScore descending', () => {
      const c1 = { ...baseCandidate, userId: '1', aiRelevanceScore: 50 }; // low score
      const c2 = { ...baseCandidate, userId: '2', aiRelevanceScore: 95 }; // highest score
      const c3 = { ...baseCandidate, userId: '3', aiRelevanceScore: 80 }; // middle score

      const results = service.classifyAll([c1, c2, c3]);

      expect(results[0].userId).toBe('2');
      expect(results[1].userId).toBe('3');
      expect(results[2].userId).toBe('1');
    });
  });
});
