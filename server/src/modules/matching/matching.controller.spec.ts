import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

describe('MatchingController', () => {
  let controller: MatchingController;
  let matchingService: jest.Mocked<MatchingService>;
  let requestRepo: { findOne: jest.Mock };
  let brokerProposalRepo: { find: jest.Mock };
  let freelancerProposalRepo: { find: jest.Mock };

  beforeEach(() => {
    matchingService = {
      findMatches: jest.fn(),
    } as unknown as jest.Mocked<MatchingService>;

    requestRepo = {
      findOne: jest.fn(),
    };
    brokerProposalRepo = {
      find: jest.fn(),
    };
    freelancerProposalRepo = {
      find: jest.fn(),
    };

    controller = new MatchingController(
      matchingService,
      requestRepo as any,
      brokerProposalRepo as any,
      freelancerProposalRepo as any,
    );
  });

  it('does not include industry answers in quick-match request terms for freelancer matching', async () => {
    requestRepo.findOne.mockResolvedValue({
      id: 'request-1',
      description: 'Need a payment platform',
      techPreferences: 'React, NestJS',
      budgetRange: '10k-20k',
      intendedTimeline: '3 months',
      answers: [
        {
          valueText: 'FinTech',
          question: { code: 'INDUSTRY' },
          option: null,
        },
      ],
    });
    freelancerProposalRepo.find.mockResolvedValue([{ freelancerId: 'freelancer-1' }]);
    matchingService.findMatches.mockResolvedValue([]);

    await controller.findMatches('request-1', 'FREELANCER', 'false', '10');

    expect(matchingService.findMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-1',
        requiredTechStack: ['React', 'NestJS'], // FinTech is excluded
        excludeUserIds: ['freelancer-1'],
      }),
      {
        role: 'FREELANCER',
        enableAi: false,
        topN: 10,
      },
    );
  });

  it('returns broker matches with partner detail payload and includes industry answers for broker matching', async () => {
    requestRepo.findOne.mockResolvedValue({
      id: 'request-2',
      description: 'Need a payment platform',
      techPreferences: 'React, NestJS',
      budgetRange: '10k-20k',
      intendedTimeline: '3 months',
      answers: [
        {
          valueText: 'FinTech',
          question: { code: 'INDUSTRY' },
          option: null,
        },
      ],
    });
    brokerProposalRepo.find.mockResolvedValue([{ brokerId: 'broker-1' }]);
    matchingService.findMatches.mockResolvedValue([
      {
        userId: 'broker-2',
        fullName: 'Broker Two',
        matchScore: 91,
        tagOverlapScore: 88,
        aiRelevanceScore: 93,
        normalizedTrust: 84,
        classificationLabel: 'POTENTIAL',
        reasoning: 'Strong fintech marketplace experience.',
        matchedSkills: ['React', 'NestJS', 'FinTech'],
        candidateProfile: {
          companyName: 'Broker Studio',
          bio: 'Delivered fintech discovery projects.',
          portfolioLinks: ['https://portfolio.example/broker-2'],
          domains: ['FinTech'],
        },
      },
    ] as any);

    const result = await controller.findMatches('request-2', 'BROKER', 'true', '5');

    expect(result).toEqual([
      expect.objectContaining({
        userId: 'broker-2',
        fullName: 'Broker Two',
        candidateProfile: expect.objectContaining({
          companyName: 'Broker Studio',
          domains: ['FinTech'],
        }),
      }),
    ]);
    expect(matchingService.findMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-2',
        requiredTechStack: expect.arrayContaining(['React', 'NestJS', 'FinTech']),
        excludeUserIds: ['broker-1'],
      }),
      {
        role: 'BROKER',
        enableAi: true,
        topN: 5,
      },
    );
  });

  it('returns an empty partner list when the request does not exist', async () => {
    requestRepo.findOne.mockResolvedValue(null);

    const result = await controller.findMatches('request-404');

    expect(result).toEqual([]);
    expect(brokerProposalRepo.find).not.toHaveBeenCalled();
    expect(freelancerProposalRepo.find).not.toHaveBeenCalled();
    expect(matchingService.findMatches).not.toHaveBeenCalled();
  });
});
