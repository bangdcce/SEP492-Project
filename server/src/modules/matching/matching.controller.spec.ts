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

  it('includes industry answers in quick-match request terms for broker matching', async () => {
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
    matchingService.findMatches.mockResolvedValue([]);

    await controller.findMatches('request-2', 'BROKER', 'false', '10');

    expect(matchingService.findMatches).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-2',
        requiredTechStack: expect.arrayContaining(['React', 'NestJS', 'FinTech']),
        excludeUserIds: ['broker-1'],
      }),
      {
        role: 'BROKER',
        enableAi: false,
        topN: 10,
      },
    );
  });
});
