import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { HardFilterService } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';
import { AiRankerService } from './ai-ranker.service';
import { ClassifierService } from './classifier.service';
import { ClassificationLabel, EligibleCandidate, MatchingInput, ScoredCandidate, MatchResult } from './interfaces/match.interfaces';

describe('MatchingService', () => {
  let service: MatchingService;
  let hardFilterService: jest.Mocked<HardFilterService>;
  let tagScorerService: jest.Mocked<TagScorerService>;
  let aiRankerService: jest.Mocked<AiRankerService>;
  let classifierService: jest.Mocked<ClassifierService>;

  beforeEach(async () => {
    // Create mocks for all sub-services
    const mockHardFilterService = {
      filterEligibleCandidates: jest.fn(),
    };
    const mockTagScorerService = {
      scoreAll: jest.fn(),
    };
    const mockAiRankerService = {
      rankBatch: jest.fn(),
    };
    const mockClassifierService = {
      classifyAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: HardFilterService, useValue: mockHardFilterService },
        { provide: TagScorerService, useValue: mockTagScorerService },
        { provide: AiRankerService, useValue: mockAiRankerService },
        { provide: ClassifierService, useValue: mockClassifierService },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    hardFilterService = module.get(HardFilterService);
    tagScorerService = module.get(TagScorerService);
    aiRankerService = module.get(AiRankerService);
    classifierService = module.get(ClassifierService);
  });

  const input: MatchingInput = {
    requestId: 'req-1',
    specDescription: 'Need a React expert',
    requiredTechStack: ['React'],
  };

  it('should return empty array if hard filter finds no eligible candidates', async () => {
    hardFilterService.filterEligibleCandidates.mockResolvedValue([]);

    const result = await service.findMatches(input);

    expect(result).toEqual([]);
    expect(hardFilterService.filterEligibleCandidates).toHaveBeenCalledWith('req-1', 'FREELANCER', expect.any(Object));
    expect(tagScorerService.scoreAll).not.toHaveBeenCalled();
  });

  it('should bypass AI layer if enableAi is false', async () => {
    const mockEligible: EligibleCandidate[] = [
      { userId: '1', fullName: 'User 1' } as any,
    ];
    const mockScored: ScoredCandidate[] = [
      { ...mockEligible[0], tagOverlapScore: 80, matchedSkills: [] },
    ];
    const mockResults: MatchResult[] = [
      { userId: '1', matchScore: 80, classificationLabel: ClassificationLabel.NORMAL } as any,
    ];

    hardFilterService.filterEligibleCandidates.mockResolvedValue(mockEligible);
    tagScorerService.scoreAll.mockReturnValue(mockScored);
    classifierService.classifyAll.mockReturnValue(mockResults);

    const result = await service.findMatches(input, { enableAi: false });

    expect(result).toEqual(mockResults);
    expect(aiRankerService.rankBatch).not.toHaveBeenCalled();
    // Verify that the candidates passed to classifyAll have aiRelevanceScore explicitly set to null
    expect(classifierService.classifyAll).toHaveBeenCalledWith([{ ...mockScored[0], aiRelevanceScore: null }]);
  });

  it('should call AI layer for top N candidates when enableAi is true', async () => {
    const mockEligible: EligibleCandidate[] = [
      { userId: '1' } as any,
      { userId: '2' } as any,
    ];
    const mockScored: ScoredCandidate[] = [
      { userId: '1', tagOverlapScore: 90, matchedSkills: [] } as any,
      { userId: '2', tagOverlapScore: 80, matchedSkills: [] } as any,
    ];
    
    // AI enhances user 1
    const mockAiRanked: ScoredCandidate[] = [
      { ...mockScored[0], aiRelevanceScore: 95, reasoning: 'AI reason' } as any,
    ];

    hardFilterService.filterEligibleCandidates.mockResolvedValue(mockEligible);
    tagScorerService.scoreAll.mockReturnValue(mockScored);
    aiRankerService.rankBatch.mockResolvedValue(mockAiRanked);
    
    // We expect classifyAll to receive the AI-enhanced top candidate and the untouched rest
    classifierService.classifyAll.mockImplementation((candidates) => {
      expect(candidates.length).toBe(2);
      expect(candidates[0].aiRelevanceScore).toBe(95);
      expect(candidates[1].aiRelevanceScore).toBeUndefined(); // Was not in Top 1
      return [] as any;
    });

    await service.findMatches(input, { enableAi: true, topN: 1 });

    expect(aiRankerService.rankBatch).toHaveBeenCalledWith(input, [mockScored[0]]);
    expect(classifierService.classifyAll).toHaveBeenCalled();
  });
});
