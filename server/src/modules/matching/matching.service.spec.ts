import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MatchingService, MatchingInput } from './matching.service';
import { HardFilterService } from './hard-filter.service';
import { TagScorerService } from './tag-scorer.service';
import { AiRankerService } from './ai-ranker.service';
import { ClassifierService, ClassifiedResult } from './classifier.service';

describe('MatchingService', () => {
  let service: MatchingService;
  let hardFilterService: jest.Mocked<HardFilterService>;
  let tagScorerService: jest.Mocked<TagScorerService>;
  let aiRankerService: jest.Mocked<AiRankerService>;
  let classifierService: jest.Mocked<ClassifierService>;

  const input: MatchingInput = {
    requestId: 'req-1',
    specDescription: 'Need a fintech-focused React expert',
    requiredTechStack: ['React', 'FinTech'],
  };

  beforeEach(async () => {
    const mockHardFilterService = {
      filter: jest.fn(),
    };
    const mockTagScorerService = {
      score: jest.fn(),
    };
    const mockAiRankerService = {
      rank: jest.fn(),
    };
    const mockClassifierService = {
      classify: jest.fn(),
    };
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'MATCHING_AI_ENABLED') return 'true';
        if (key === 'MATCHING_AI_TOP_N') return '5';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: HardFilterService, useValue: mockHardFilterService },
        { provide: TagScorerService, useValue: mockTagScorerService },
        { provide: AiRankerService, useValue: mockAiRankerService },
        { provide: ClassifierService, useValue: mockClassifierService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
    hardFilterService = module.get(HardFilterService);
    tagScorerService = module.get(TagScorerService);
    aiRankerService = module.get(AiRankerService);
    classifierService = module.get(ClassifierService);
  });

  it('returns empty results when hard filter finds no candidates', async () => {
    hardFilterService.filter.mockResolvedValue([]);

    const results = await service.findMatches(input, {
      role: 'FREELANCER',
      enableAi: false,
      topN: 5,
    });

    expect(results).toEqual([]);
    expect(hardFilterService.filter).toHaveBeenCalledWith(
      { requestId: 'req-1', excludeUserIds: undefined },
      { role: 'FREELANCER' },
    );
    expect(tagScorerService.score).not.toHaveBeenCalled();
  });

  it('bypasses AI and classifies the full deterministic pool when AI is disabled', async () => {
    const eligible = [
      {
        candidateId: 'candidate-1',
        fullName: 'Candidate 1',
        skills: [],
        rawProfileSkills: [],
        domains: [],
        bio: '',
        trustScore: 4.5,
        completedProjects: 3,
        candidateProfile: {},
      },
    ];
    const tagged = [
      {
        ...eligible[0],
        tagOverlapScore: 82,
        matchedSkills: ['ReactJS'],
      },
    ];
    const classified: ClassifiedResult[] = [
      {
        ...(tagged[0] as any),
        aiRelevanceScore: null,
        reasoning: 'AI analysis was not enabled for this search.',
        normalizedTrust: 90,
        matchScore: 84.4,
        classificationLabel: 'NORMAL',
      },
    ];

    hardFilterService.filter.mockResolvedValue(eligible as any);
    tagScorerService.score.mockReturnValue(tagged as any);
    classifierService.classify.mockReturnValue(classified);

    const results = await service.findMatches(input, {
      role: 'BROKER',
      enableAi: false,
      topN: 5,
    });

    expect(aiRankerService.rank).not.toHaveBeenCalled();
    expect(classifierService.classify).toHaveBeenCalledWith(
      [
        {
          ...tagged[0],
          aiRelevanceScore: null,
          reasoning: 'AI analysis was not enabled for this search.',
        },
      ],
      false,
    );
    expect(results).toEqual(classified);
  });

  it('uses a wider AI shortlist than the final topN and slices after classification', async () => {
    const eligible = Array.from({ length: 12 }, (_, index) => ({
      candidateId: `candidate-${index + 1}`,
      fullName: `Candidate ${index + 1}`,
      skills: [],
      rawProfileSkills: [],
      domains: [],
      bio: '',
      trustScore: 5 - index * 0.1,
      completedProjects: 12 - index,
      candidateProfile: {},
    }));
    const tagged = eligible.map((candidate, index) => ({
      ...candidate,
      tagOverlapScore: 100 - index,
      matchedSkills: [`signal-${index + 1}`],
    }));
    const aiRanked = tagged.slice(0, 10).map((candidate, index) => ({
      ...candidate,
      aiRelevanceScore: 90 - index,
      reasoning: `AI reasoning ${index + 1}`,
    }));
    const classified = aiRanked.map((candidate, index) => ({
      ...(candidate as any),
      normalizedTrust: 80,
      matchScore: 95 - index,
      classificationLabel: 'POTENTIAL' as const,
    }));

    hardFilterService.filter.mockResolvedValue(eligible as any);
    tagScorerService.score.mockReturnValue(tagged as any);
    aiRankerService.rank.mockResolvedValue(aiRanked as any);
    classifierService.classify.mockReturnValue(classified as any);

    const results = await service.findMatches(input, {
      role: 'FREELANCER',
      enableAi: true,
      topN: 2,
    });

    expect(aiRankerService.rank).toHaveBeenCalledWith(
      {
        specDescription: input.specDescription,
        requiredTechStack: input.requiredTechStack,
        budgetRange: undefined,
        estimatedDuration: undefined,
      },
      expect.arrayContaining(tagged.slice(0, 10)),
    );
    expect((aiRankerService.rank.mock.calls[0]?.[1] || []).length).toBe(10);
    expect(results).toHaveLength(2);
    expect(results[0].matchScore).toBe(95);
    expect(results[1].matchScore).toBe(94);
  });
});
