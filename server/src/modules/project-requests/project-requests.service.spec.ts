import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

import {
  BrokerProposalEntity,
  ProposalStatus,
} from '../../database/entities/broker-proposal.entity';
import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { QuotaAction } from '../../database/entities/quota-usage-log.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ContractsService } from '../contracts/contracts.service';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestChatService } from '../request-chat/request-chat.service';
import { QuotaService } from '../subscriptions/quota.service';
import { ProjectRequestsService } from './project-requests.service';
import { ProjectSpecStatus, SpecPhase } from '../../database/entities/project-spec.entity';

const createRepoMock = () => ({
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeRequest = (
  overrides: Partial<ProjectRequestEntity> = {},
): ProjectRequestEntity =>
  ({
    id: 'req-1',
    clientId: 'client-1',
    title: 'Marketplace request',
    description: 'Build a platform for brokers and freelancers.',
    budgetRange: '$5,000 - $10,000',
    intendedTimeline: '8 weeks',
    techPreferences: 'NestJS, React',
    status: RequestStatus.DRAFT,
    brokerId: null,
    answers: [],
    brokerProposals: [],
    proposals: [],
    specs: [],
    attachments: [],
    createdAt: new Date('2026-03-19T00:00:00.000Z'),
    updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    ...overrides,
  }) as ProjectRequestEntity;

describe('ProjectRequestsService - merged marketplace flow', () => {
  let service: ProjectRequestsService;
  let requestRepo: ReturnType<typeof createRepoMock>;
  let answerRepo: ReturnType<typeof createRepoMock>;
  let brokerProposalRepo: ReturnType<typeof createRepoMock>;
  let freelancerProposalRepo: ReturnType<typeof createRepoMock>;
  let projectRepo: ReturnType<typeof createRepoMock>;
  let contractRepo: ReturnType<typeof createRepoMock>;
  let auditLogsService: {
    logCreate: jest.Mock;
    logUpdate: jest.Mock;
    logDelete: jest.Mock;
  };
  let matchingService: { findMatches: jest.Mock };
  let quotaService: { checkQuota: jest.Mock; incrementUsage: jest.Mock };
  let notificationsService: { createMany: jest.Mock };
  let contractsService: { initializeContract: jest.Mock };
  let requestChatService: { createSystemMessage: jest.Mock; assertRequestReadAccess: jest.Mock; assertRequestWriteAccess: jest.Mock };
  let projectHistoryQueryBuilder: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    requestRepo = createRepoMock();
    answerRepo = createRepoMock();
    brokerProposalRepo = createRepoMock();
    freelancerProposalRepo = createRepoMock();
    projectRepo = createRepoMock();
    contractRepo = createRepoMock();
    auditLogsService = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };
    matchingService = {
      findMatches: jest.fn(),
    };
    quotaService = {
      checkQuota: jest.fn().mockResolvedValue(undefined),
      incrementUsage: jest.fn().mockResolvedValue(undefined),
    };
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    contractsService = {
      initializeContract: jest.fn().mockResolvedValue(undefined),
    };
    requestChatService = {
      createSystemMessage: jest.fn().mockResolvedValue(undefined),
      assertRequestReadAccess: jest.fn().mockResolvedValue(undefined),
      assertRequestWriteAccess: jest.fn().mockResolvedValue(undefined),
    };
    projectHistoryQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    projectRepo.createQueryBuilder.mockReturnValue(projectHistoryQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectRequestsService,
        {
          provide: getRepositoryToken(ProjectRequestEntity),
          useValue: requestRepo,
        },
        {
          provide: getRepositoryToken(ProjectRequestAnswerEntity),
          useValue: answerRepo,
        },
        {
          provide: getRepositoryToken(BrokerProposalEntity),
          useValue: brokerProposalRepo,
        },
        {
          provide: getRepositoryToken(ProjectRequestProposalEntity),
          useValue: freelancerProposalRepo,
        },
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: projectRepo,
        },
        {
          provide: getRepositoryToken(ContractEntity),
          useValue: contractRepo,
        },
        {
          provide: AuditLogsService,
          useValue: auditLogsService,
        },
        {
          provide: MatchingService,
          useValue: matchingService,
        },
        {
          provide: QuotaService,
          useValue: quotaService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: ContractsService,
          useValue: contractsService,
        },
        {
          provide: RequestChatService,
          useValue: requestChatService,
        },
      ],
    }).compile();

    service = module.get(ProjectRequestsService);
    brokerProposalRepo.count.mockResolvedValue(0);
    projectRepo.findOne.mockResolvedValue(null);
    contractRepo.findOne.mockResolvedValue(null);
    brokerProposalRepo.find.mockResolvedValue([]);
    freelancerProposalRepo.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('UC14-CRT-01 creates a new marketplace request in PUBLIC_DRAFT when isDraft is false', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const dto = {
        title: 'Marketplace request',
        description: 'Post this request to the broker marketplace',
        budgetRange: '$5,000 - $10,000',
        intendedTimeline: '8 weeks',
        techPreferences: 'NestJS, React',
        isDraft: false,
        answers: [
          { questionId: 'q-1', valueText: 'Marketplace' },
          { questionId: 'q-2', valueText: 'React' },
        ],
      };
      const createdRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });
      const hydratedRequest = {
        ...createdRequest,
        answers: dto.answers,
      };

      requestRepo.create.mockReturnValue(createdRequest);
      requestRepo.save.mockResolvedValue(createdRequest);
      requestRepo.findOne.mockResolvedValue(hydratedRequest);
      answerRepo.create.mockImplementation((value) => value);
      answerRepo.save.mockResolvedValue(dto.answers);

      const result = await service.create('client-1', dto as any, {} as any);

      expect(quotaService.checkQuota).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.CREATE_REQUEST,
      );
      expect(requestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          status: RequestStatus.PUBLIC_DRAFT,
        }),
      );
      expect(answerRepo.create).toHaveBeenCalledTimes(2);
      expect(auditLogsService.logCreate).toHaveBeenCalled();
      expect(quotaService.incrementUsage).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.CREATE_REQUEST,
        { requestId: createdRequest.id },
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Create Request Successful: PUBLIC_DRAFT',
      );
      expect(result).toEqual(hydratedRequest);
    });

    it('UC14-CRT-02 creates a draft request in DRAFT when isDraft is true', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const dto = {
        title: 'Draft request',
        description: 'Save for later',
        budgetRange: '$5,000 - $10,000',
        intendedTimeline: '8 weeks',
        techPreferences: 'NestJS, React',
        isDraft: true,
        answers: [],
      };
      const createdRequest = makeRequest({ status: RequestStatus.DRAFT, title: dto.title });

      requestRepo.create.mockReturnValue(createdRequest);
      requestRepo.save.mockResolvedValue(createdRequest);
      requestRepo.findOne.mockResolvedValue(createdRequest);

      const result = await service.create('client-1', dto as any, {} as any);

      expect(requestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetRange: '$5,000 - $10,000',
          intendedTimeline: '8 weeks',
          techPreferences: 'NestJS, React',
          status: RequestStatus.DRAFT,
        }),
      );
      expect(answerRepo.create).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Create Request Successful: DRAFT');
      expect(result).toEqual(createdRequest);
    });

    it('UC14-CRT-03 normalizes attachment metadata and ignores blank attachment rows during request creation', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const dto = {
        title: 'Attachment request',
        description: 'Include uploaded reference files',
        budgetRange: '$5,000 - $10,000',
        intendedTimeline: '8 weeks',
        techPreferences: 'NestJS, React',
        isDraft: false,
        attachments: [
          {
            filename: ' brief.pdf ',
            url: ' /uploads/brief.pdf ',
            mimetype: ' application/pdf ',
            size: 2048,
            category: 'requirements',
          },
          {
            filename: ' image.png ',
            url: ' /uploads/image.png ',
            mimetype: ' image/png ',
          },
          {
            filename: '',
            url: '/uploads/ignored.pdf',
          },
        ],
        answers: [],
      };
      const createdRequest = makeRequest({
        status: RequestStatus.PUBLIC_DRAFT,
        title: dto.title,
      });

      requestRepo.create.mockReturnValue(createdRequest);
      requestRepo.save.mockResolvedValue(createdRequest);
      requestRepo.findOne.mockResolvedValue(createdRequest);

      await service.create('client-1', dto as any, {} as any);

      expect(requestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetRange: '$5,000 - $10,000',
          intendedTimeline: '8 weeks',
          techPreferences: 'NestJS, React',
          status: RequestStatus.PUBLIC_DRAFT,
          attachments: [
            {
              filename: 'brief.pdf',
              url: '/uploads/brief.pdf',
              mimetype: 'application/pdf',
              size: 2048,
              category: 'requirements',
            },
            {
              filename: 'image.png',
              url: '/uploads/image.png',
              mimetype: 'image/png',
              size: null,
              category: 'attachment',
            },
          ],
        }),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Create Request Successful: PUBLIC_DRAFT',
      );
    });

    it('UC14-CRT-04 stops request creation when quota validation rejects the submission', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      quotaService.checkQuota.mockRejectedValueOnce(new BadRequestException('Quota exceeded'));

      await expect(
        service.create(
          'client-1',
          {
            title: 'Blocked request',
            description: 'This should not be saved',
            budgetRange: '$5,000 - $10,000',
            intendedTimeline: '8 weeks',
            techPreferences: 'NestJS, React',
            isDraft: false,
            answers: [],
          } as any,
          {} as any,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(requestRepo.create).not.toHaveBeenCalled();
      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(answerRepo.create).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Create Request Failed: Quota exceeded',
      );
    });

    it('UC14-CRT-05 returns the created request when audit logging fails and logs the failure message', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const dto = {
        title: 'Audit fallback request',
        description: 'Keep creating the request even if audit logging is down',
        budgetRange: '$5,000 - $10,000',
        intendedTimeline: '8 weeks',
        techPreferences: 'NestJS, React',
        isDraft: false,
        answers: [],
      };
      const createdRequest = makeRequest({
        status: RequestStatus.PUBLIC_DRAFT,
        title: dto.title,
        description: dto.description,
      });
      const auditFailure = new Error('audit service unavailable');

      requestRepo.create.mockReturnValue(createdRequest);
      requestRepo.save.mockResolvedValue(createdRequest);
      requestRepo.findOne.mockResolvedValue(createdRequest);
      auditLogsService.logCreate.mockRejectedValueOnce(auditFailure);

      const result = await service.create('client-1', dto as any, {} as any);

      expect(result).toEqual(createdRequest);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Create Request Audit Log Failed');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Create Request Successful: PUBLIC_DRAFT',
      );
      expect(quotaService.incrementUsage).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.CREATE_REQUEST,
        { requestId: createdRequest.id },
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith([
        {
          userId: 'client-1',
          title: 'Project request created',
          body: `Request "${createdRequest.title}" has been created and is now being tracked.`,
          relatedType: 'ProjectRequest',
          relatedId: createdRequest.id,
        },
      ]);
    });
  });

  describe('findAllByClient', () => {
    it('returns the current client request list with the expected query shape', async () => {
      const listedRequests = [
        makeRequest({
          id: 'req-2',
          clientId: 'client-1',
          title: 'Second request',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
        }),
        makeRequest({
          id: 'req-1',
          clientId: 'client-1',
          title: 'First request',
          createdAt: new Date('2026-03-19T00:00:00.000Z'),
        }),
      ];

      requestRepo.find.mockResolvedValue(listedRequests);

      const result = await service.findAllByClient('client-1');

      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        relations: ['answers', 'answers.question', 'answers.option'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(listedRequests);
    });
  });

  describe('findOne - client request access', () => {
    it('returns request detail for the owning client without masking client contact data', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.PUBLIC_DRAFT,
          clientId: 'client-1',
          client: {
            id: 'client-1',
            fullName: 'Client Owner',
            email: 'client@example.com',
            phoneNumber: '0123456789',
          } as any,
        }),
      );

      const result = await service.findOne(
        'req-1',
        { id: 'client-1', role: UserRole.CLIENT } as UserEntity,
      );

      expect(result.id).toBe('req-1');
      expect(result.client?.email).toBe('client@example.com');
      expect((result.client as any)?.phoneNumber).toBe('0123456789');
    });

    it('rejects request detail when a client tries to view another client request', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          clientId: 'client-2',
        }),
      );

      await expect(
        service.findOne('req-1', { id: 'client-1', role: UserRole.CLIENT } as UserEntity),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects request detail when the request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('req-404', { id: 'client-1', role: UserRole.CLIENT } as UserEntity),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMatches', () => {
    it('checks AI-match quota, forwards broker matching input, and records the candidate count', async () => {
      const request = makeRequest({
        id: 'req-match-1',
        description: 'Need a fintech broker who knows React and NestJS.',
        techPreferences: 'React, NestJS, FinTech',
      });
      const matches = [
        {
          userId: 'broker-1',
          fullName: 'Broker One',
          matchScore: 91,
        },
      ];

      requestRepo.findOne.mockResolvedValue(request);
      matchingService.findMatches.mockResolvedValue(matches);

      const result = await service.findMatches('req-match-1', 'client-1');

      expect(quotaService.checkQuota).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.AI_MATCH_SEARCH,
      );
      expect(matchingService.findMatches).toHaveBeenCalledWith(
        {
          requestId: 'req-match-1',
          specDescription: 'Need a fintech broker who knows React and NestJS.',
          requiredTechStack: ['React', 'NestJS', 'FinTech'],
          budgetRange: '$5,000 - $10,000',
          estimatedDuration: '8 weeks',
        },
        { role: 'BROKER' },
      );
      expect(quotaService.incrementUsage).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.AI_MATCH_SEARCH,
        {
          requestId: 'req-match-1',
          candidatesFound: 1,
        },
      );
      expect(result).toEqual(matches);
    });

    it('allows broker matching lookup without quota tracking when no caller id is provided', async () => {
      const request = makeRequest({
        id: 'req-match-2',
        description: 'Need help with a marketplace launch.',
        techPreferences: '',
      });

      requestRepo.findOne.mockResolvedValue(request);
      matchingService.findMatches.mockResolvedValue([]);

      const result = await service.findMatches('req-match-2');

      expect(quotaService.checkQuota).not.toHaveBeenCalled();
      expect(matchingService.findMatches).toHaveBeenCalledWith(
        {
          requestId: 'req-match-2',
          specDescription: 'Need help with a marketplace launch.',
          requiredTechStack: [],
          budgetRange: '$5,000 - $10,000',
          estimatedDuration: '8 weeks',
        },
        { role: 'BROKER' },
      );
      expect(quotaService.incrementUsage).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates editable fields, attachments, wizard progress, and answers for the owning client', async () => {
      const existingRequest = makeRequest({
        clientId: 'client-1',
        title: 'Old request title',
        description: 'Old description',
        wizardProgressStep: 1,
      });
      const updatedRequest = makeRequest({
        clientId: 'client-1',
        title: 'Updated request title',
        description: 'Updated description',
        budgetRange: '$10,000 - $15,000',
        intendedTimeline: '12 weeks',
        techPreferences: 'NestJS, Vue',
        attachments: [
          {
            filename: 'brief.pdf',
            url: 'https://files.example.com/brief.pdf',
            mimetype: 'application/pdf',
            size: 2048,
            category: 'requirements',
          },
        ] as any,
        wizardProgressStep: 3,
      });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);
      jest.spyOn(service, 'findOne').mockResolvedValue(updatedRequest as any);
      requestRepo.save.mockImplementation(async (value) => value);
      answerRepo.create.mockImplementation((value) => value);
      answerRepo.save.mockResolvedValue([
        { requestId: 'req-1', questionId: 'q-1', valueText: 'Updated answer' },
      ]);

      const result = await service.update(
        'req-1',
        {
          title: 'Updated request title',
          description: 'Updated description',
          budgetRange: '$10,000 - $15,000',
          intendedTimeline: '12 weeks',
          techPreferences: 'NestJS, Vue',
          attachments: [
            {
              filename: '  brief.pdf  ',
              url: ' https://files.example.com/brief.pdf ',
              mimetype: ' application/pdf ',
              size: 2048,
              category: 'requirements',
            },
          ],
          wizardProgressStep: 3,
          answers: [{ questionId: 'q-1', valueText: 'Updated answer' }],
        } as any,
        { id: 'client-1', role: UserRole.CLIENT } as UserEntity,
      );

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated request title',
          description: 'Updated description',
          budgetRange: '$10,000 - $15,000',
          intendedTimeline: '12 weeks',
          techPreferences: 'NestJS, Vue',
          wizardProgressStep: 3,
          attachments: [
            expect.objectContaining({
              filename: 'brief.pdf',
              url: 'https://files.example.com/brief.pdf',
              mimetype: 'application/pdf',
              size: 2048,
              category: 'requirements',
            }),
          ],
        }),
      );
      expect(answerRepo.delete).toHaveBeenCalledWith({ requestId: 'req-1' });
      expect(answerRepo.create).toHaveBeenCalledWith({
        requestId: 'req-1',
        questionId: 'q-1',
        optionId: undefined,
        valueText: 'Updated answer',
      });
      expect(result).toEqual(updatedRequest);
    });

    it('rejects request editing from a different client owner', async () => {
      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(
        makeRequest({
          clientId: 'client-1',
        }),
      );

      await expect(
        service.update(
          'req-1',
          { title: 'Unauthorized edit' } as any,
          { id: 'client-2', role: UserRole.CLIENT } as UserEntity,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(requestRepo.save).not.toHaveBeenCalled();
    });

    it('switches PUBLIC_DRAFT to PRIVATE_DRAFT and rejects pending broker proposals', async () => {
      const existingRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });
      const updatedRequest = makeRequest({ status: RequestStatus.PRIVATE_DRAFT });
      const pendingProposals = [
        { id: 'bp-1', brokerId: 'broker-1', status: ProposalStatus.PENDING },
        { id: 'bp-2', brokerId: 'broker-2', status: ProposalStatus.PENDING },
      ];

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);
      jest.spyOn(service, 'findOne').mockResolvedValue(updatedRequest as any);
      requestRepo.save.mockResolvedValue(updatedRequest);
      brokerProposalRepo.find.mockResolvedValue(pendingProposals);
      brokerProposalRepo.save.mockResolvedValue(undefined);

      const result = await service.update(
        'req-1',
        { status: RequestStatus.PRIVATE_DRAFT } as any,
        { id: 'client-1', role: UserRole.CLIENT } as UserEntity,
      );

      expect(brokerProposalRepo.find).toHaveBeenCalledWith({
        where: { requestId: 'req-1', status: ProposalStatus.PENDING },
      });
      expect(brokerProposalRepo.save).toHaveBeenCalledTimes(2);
      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.PRIVATE_DRAFT }),
      );
      expect(result).toEqual(updatedRequest);
    });

    it('switches PRIVATE_DRAFT to PUBLIC_DRAFT without rejecting proposals', async () => {
      const existingRequest = makeRequest({ status: RequestStatus.PRIVATE_DRAFT });
      const updatedRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);
      jest.spyOn(service, 'findOne').mockResolvedValue(updatedRequest as any);
      requestRepo.save.mockResolvedValue(updatedRequest);

      const result = await service.update(
        'req-1',
        { status: RequestStatus.PUBLIC_DRAFT } as any,
        { id: 'client-1', role: UserRole.CLIENT } as UserEntity,
      );

      expect(brokerProposalRepo.find).not.toHaveBeenCalled();
      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.PUBLIC_DRAFT }),
      );
      expect(result).toEqual(updatedRequest);
    });
  });

  describe('publish', () => {
    it('publishes a client-owned draft request to PUBLIC_DRAFT', async () => {
      const draftRequest = makeRequest({ status: RequestStatus.DRAFT });
      const publishedRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });

      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(draftRequest as any)
        .mockResolvedValueOnce(publishedRequest as any);
      requestRepo.save.mockResolvedValue(publishedRequest);

      const result = await service.publish('req-1', 'client-1', {} as any);

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.PUBLIC_DRAFT }),
      );
      expect(auditLogsService.logUpdate).toHaveBeenCalledWith(
        'ProjectRequest',
        'req-1',
        { status: RequestStatus.DRAFT },
        { status: RequestStatus.PUBLIC_DRAFT },
        expect.anything(),
      );
      expect(result).toEqual(publishedRequest);
    });

    it('publishes a client-owned private draft request to PUBLIC_DRAFT', async () => {
      const privateDraftRequest = makeRequest({ status: RequestStatus.PRIVATE_DRAFT });
      const publishedRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });

      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(privateDraftRequest as any)
        .mockResolvedValueOnce(publishedRequest as any);
      requestRepo.save.mockResolvedValue(publishedRequest);

      const result = await service.publish('req-1', 'client-1', {} as any);

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: RequestStatus.PUBLIC_DRAFT }),
      );
      expect(auditLogsService.logUpdate).toHaveBeenCalledWith(
        'ProjectRequest',
        'req-1',
        { status: RequestStatus.PRIVATE_DRAFT },
        { status: RequestStatus.PUBLIC_DRAFT },
        expect.anything(),
      );
      expect(result).toEqual(publishedRequest);
    });

    it('returns the request unchanged when it is already PUBLIC_DRAFT', async () => {
      const publicRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });

      jest.spyOn(service, 'findOne').mockResolvedValue(publicRequest as any);

      const result = await service.publish('req-1', 'client-1', {} as any);

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(auditLogsService.logUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(publicRequest);
    });

    it('rejects publish from a non-publishable status', async () => {
      const assignedRequest = makeRequest({
        status: RequestStatus.BROKER_ASSIGNED,
        brokerId: 'broker-1',
      });

      jest.spyOn(service, 'findOne').mockResolvedValue(assignedRequest as any);

      await expect(service.publish('req-1', 'client-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
    });

    it('rejects publish when a broker is already assigned even if the request is still in a draft status', async () => {
      const assignedPrivateDraft = makeRequest({
        status: RequestStatus.PRIVATE_DRAFT,
        brokerId: 'broker-1',
      });

      jest.spyOn(service, 'findOne').mockResolvedValue(assignedPrivateDraft as any);

      await expect(service.publish('req-1', 'client-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('inviteBroker', () => {
    it('creates an INVITED broker proposal, records invite quota usage, and notifies the broker', async () => {
      const request = makeRequest({
        id: 'req-invite-1',
        brokerId: null,
        title: 'Marketplace request',
      });
      const createdProposal = {
        id: 'bp-1',
        requestId: 'req-invite-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        coverLetter: 'Please review this request.',
      };

      requestRepo.findOne.mockResolvedValue(request);
      brokerProposalRepo.findOne.mockResolvedValue(null);
      brokerProposalRepo.create.mockReturnValue(createdProposal);
      brokerProposalRepo.save.mockResolvedValue(createdProposal);

      const result = await service.inviteBroker(
        'req-invite-1',
        'broker-1',
        'Please review this request.',
        'client-1',
      );

      expect(quotaService.checkQuota).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.INVITE_BROKER,
        'req-invite-1',
      );
      expect(brokerProposalRepo.create).toHaveBeenCalledWith({
        requestId: 'req-invite-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        coverLetter: 'Please review this request.',
      });
      expect(quotaService.incrementUsage).toHaveBeenCalledWith(
        'client-1',
        QuotaAction.INVITE_BROKER,
        {
          entityId: 'req-invite-1',
          brokerId: 'broker-1',
        },
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'broker-1',
            title: 'New broker invitation',
            relatedId: 'req-invite-1',
          }),
        ]),
      );
      expect(result).toEqual(createdProposal);
    });

    it('rejects inviting a broker when the request already has an assigned broker', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          id: 'req-invite-2',
          brokerId: 'broker-existing',
        }),
      );

      await expect(
        service.inviteBroker('req-invite-2', 'broker-1', 'Please join this project.', 'client-1'),
      ).rejects.toThrow('Request already has a broker assigned');

      expect(brokerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(brokerProposalRepo.save).not.toHaveBeenCalled();
    });

    it('rejects inviting a broker who already has an INVITED proposal', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          id: 'req-invite-3',
          brokerId: null,
        }),
      );
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'proposal-existing',
        requestId: 'req-invite-3',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
      });

      await expect(
        service.inviteBroker('req-invite-3', 'broker-1', 'Reminder invite.', 'client-1'),
      ).rejects.toThrow('Broker already invited');

      expect(brokerProposalRepo.save).not.toHaveBeenCalled();
    });

    it('rejects inviting a broker who has already applied to the request', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          id: 'req-invite-4',
          brokerId: null,
        }),
      );
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'proposal-pending',
        requestId: 'req-invite-4',
        brokerId: 'broker-1',
        status: ProposalStatus.PENDING,
      });

      await expect(
        service.inviteBroker('req-invite-4', 'broker-1', 'Please join this request.', 'client-1'),
      ).rejects.toThrow('Broker has already applied');

      expect(brokerProposalRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('applyToRequest', () => {
    it('creates a pending broker proposal for a PUBLIC_DRAFT request and tracks quota usage', async () => {
      const request = makeRequest({ status: RequestStatus.PUBLIC_DRAFT, brokerId: null });
      const createdProposal = {
        id: 'proposal-1',
        requestId: 'req-1',
        brokerId: 'broker-1',
        coverLetter: 'I can help with this request.',
        status: ProposalStatus.PENDING,
      };

      requestRepo.findOne.mockResolvedValue(request);
      brokerProposalRepo.findOne.mockResolvedValue(null);
      brokerProposalRepo.create.mockReturnValue(createdProposal);
      brokerProposalRepo.save.mockResolvedValue(createdProposal);

      const result = await service.applyToRequest(
        'req-1',
        'broker-1',
        'I can help with this request.',
      );

      expect(quotaService.checkQuota).toHaveBeenCalledWith(
        'broker-1',
        QuotaAction.APPLY_TO_REQUEST,
      );
      expect(brokerProposalRepo.create).toHaveBeenCalledWith({
        requestId: 'req-1',
        brokerId: 'broker-1',
        coverLetter: 'I can help with this request.',
        status: ProposalStatus.PENDING,
      });
      expect(quotaService.incrementUsage).toHaveBeenCalledWith(
        'broker-1',
        QuotaAction.APPLY_TO_REQUEST,
        { requestId: 'req-1' },
      );
      expect(result).toEqual(createdProposal);
    });

    it('rejects duplicate broker applications for the same request', async () => {
      const request = makeRequest({ status: RequestStatus.PUBLIC_DRAFT, brokerId: null });

      requestRepo.findOne.mockResolvedValue(request);
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'proposal-existing',
        requestId: 'req-1',
        brokerId: 'broker-1',
      });

      await expect(
        service.applyToRequest('req-1', 'broker-1', 'duplicate'),
      ).rejects.toThrow(BadRequestException);

      expect(quotaService.checkQuota).not.toHaveBeenCalled();
      expect(brokerProposalRepo.create).not.toHaveBeenCalled();
    });

    it('rejects applications when the request is not public', async () => {
      const privateRequest = makeRequest({ status: RequestStatus.PRIVATE_DRAFT });

      requestRepo.findOne.mockResolvedValue(privateRequest);

      await expect(
        service.applyToRequest('req-1', 'broker-1', 'not public'),
      ).rejects.toThrow(BadRequestException);

      expect(brokerProposalRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects applications when the request does not exist', async () => {
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyToRequest('req-404', 'broker-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptBroker', () => {
    it('assigns the selected broker, marks the request BROKER_ASSIGNED, and rejects the other pending proposals', async () => {
      const existingRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });
      const finalRequest = makeRequest({
        status: RequestStatus.BROKER_ASSIGNED,
        brokerId: 'broker-1',
      });
      const otherPendingProposals = [
        { id: 'bp-1', brokerId: 'broker-1', status: ProposalStatus.PENDING },
        { id: 'bp-2', brokerId: 'broker-2', status: ProposalStatus.PENDING },
      ];

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);
      jest.spyOn(service, 'findOne').mockResolvedValue(finalRequest as any);
      requestRepo.save.mockResolvedValue(finalRequest);
      brokerProposalRepo.update.mockResolvedValue(undefined);
      brokerProposalRepo.find.mockResolvedValue(otherPendingProposals);
      brokerProposalRepo.save.mockResolvedValue(undefined);

      const result = await service.acceptBroker('req-1', 'broker-1', 'client-1');

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          brokerId: 'broker-1',
          status: RequestStatus.BROKER_ASSIGNED,
        }),
      );
      expect(brokerProposalRepo.update).toHaveBeenCalledWith(
        { requestId: 'req-1', brokerId: 'broker-1' },
        { status: ProposalStatus.ACCEPTED },
      );
      expect(brokerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          brokerId: 'broker-2',
          status: ProposalStatus.REJECTED,
        }),
      );
      expect(result).toEqual(finalRequest);
    });

    it('rejects broker acceptance from an invalid request state', async () => {
      const completedRequest = makeRequest({ status: RequestStatus.COMPLETED });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(completedRequest);

      await expect(service.acceptBroker('req-1', 'broker-1', 'client-1')).rejects.toThrow(
        'Request is not in a valid state to accept a broker',
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(brokerProposalRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('respondToInvitation - broker', () => {
    it('assigns the invited broker and advances the request to broker assigned when they accept', async () => {
      const request = makeRequest({
        status: RequestStatus.PRIVATE_DRAFT,
        brokerId: null,
      });
      const proposal = {
        id: 'invite-1',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        request,
      };
      const competingProposal = {
        id: 'invite-2',
        requestId: 'req-1',
        brokerId: 'broker-2',
        status: ProposalStatus.INVITED,
      };

      brokerProposalRepo.findOne.mockResolvedValue(proposal);
      brokerProposalRepo.find.mockResolvedValue([proposal, competingProposal]);
      brokerProposalRepo.save.mockImplementation(async (value) => value);
      requestRepo.save.mockImplementation(async (value) => value);

      const result = await service.respondToInvitation(
        'invite-1',
        'broker-1',
        UserRole.BROKER,
        'ACCEPTED',
      );

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          brokerId: 'broker-1',
          status: RequestStatus.BROKER_ASSIGNED,
        }),
      );
      expect(brokerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invite-2',
          status: ProposalStatus.REJECTED,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'invite-1',
          status: ProposalStatus.ACCEPTED,
        }),
      );
    });

    it('rejects accepting an invitation when another broker is already assigned', async () => {
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'invite-1',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        request: makeRequest({
          status: RequestStatus.BROKER_ASSIGNED,
          brokerId: 'broker-2',
        }),
      });

      await expect(
        service.respondToInvitation('invite-1', 'broker-1', UserRole.BROKER, 'ACCEPTED'),
      ).rejects.toThrow(BadRequestException);

      expect(requestRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('freelancer invite approval gate', () => {
    const approvedClientSpec = {
      id: 'client-spec-1',
      title: 'Client Spec',
      status: ProjectSpecStatus.CLIENT_APPROVED,
      specPhase: SpecPhase.CLIENT_SPEC,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    };

    it('creates a pending-client-approval freelancer proposal and records the broker id', async () => {
      const request = makeRequest({
        status: RequestStatus.SPEC_APPROVED,
        brokerId: 'broker-1',
        specs: [approvedClientSpec as any],
      });
      const createdProposal = {
        id: 'fp-1',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        coverLetter: 'Strong frontend portfolio.',
        status: 'PENDING_CLIENT_APPROVAL',
      };

      requestRepo.findOne.mockResolvedValue(request);
      freelancerProposalRepo.findOne.mockResolvedValue(null);
      freelancerProposalRepo.create.mockReturnValue(createdProposal);
      freelancerProposalRepo.save.mockResolvedValue(createdProposal);

      const result = await service.inviteFreelancer(
        'req-1',
        'freelancer-1',
        'Strong frontend portfolio.',
        { id: 'broker-1', role: UserRole.BROKER } as UserEntity,
      );

      expect(freelancerProposalRepo.create).toHaveBeenCalledWith({
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'PENDING_CLIENT_APPROVAL',
        coverLetter: 'Strong frontend portfolio.',
      });
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'client-1',
            title: 'Broker recommended a freelancer',
            relatedId: 'req-1',
          }),
        ]),
      );
      expect(result).toEqual(createdProposal);
    });

    it('approves a freelancer recommendation and makes it visible to the freelancer', async () => {
      const request = makeRequest({
        status: RequestStatus.SPEC_APPROVED,
        brokerId: 'broker-1',
      });
      const proposal = {
        id: 'fp-approve',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'PENDING_CLIENT_APPROVAL',
      };

      requestRepo.findOne.mockResolvedValue(request);
      freelancerProposalRepo.findOne.mockResolvedValue(proposal);
      freelancerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.approveFreelancerInvite('req-1', 'fp-approve', 'client-1');

      expect(freelancerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'fp-approve',
          status: 'INVITED',
        }),
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'freelancer-1',
            title: 'You were invited to a project',
          }),
          expect.objectContaining({
            userId: 'broker-1',
            title: 'Client approved your freelancer recommendation',
          }),
        ]),
      );
      expect(result).toEqual(expect.objectContaining({ status: 'INVITED' }));
    });

    it('rejects freelancer recommendation approval from a non-owner client', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );

      await expect(
        service.approveFreelancerInvite('req-1', 'fp-approve', 'client-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(freelancerProposalRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects approving a freelancer recommendation from a non-pending status', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'fp-approve',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'INVITED',
      });

      await expect(
        service.approveFreelancerInvite('req-1', 'fp-approve', 'client-1'),
      ).rejects.toThrow(BadRequestException);

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a freelancer recommendation and notifies the broker', async () => {
      const request = makeRequest({
        status: RequestStatus.SPEC_APPROVED,
        brokerId: 'broker-1',
      });
      const proposal = {
        id: 'fp-reject',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'PENDING_CLIENT_APPROVAL',
      };

      requestRepo.findOne.mockResolvedValue(request);
      freelancerProposalRepo.findOne.mockResolvedValue(proposal);
      freelancerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.rejectFreelancerInvite('req-1', 'fp-reject', 'client-1');

      expect(freelancerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'fp-reject',
          status: 'REJECTED',
        }),
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'broker-1',
            title: 'Client rejected your freelancer recommendation',
          }),
        ]),
      );
      expect(result).toEqual(expect.objectContaining({ status: 'REJECTED' }));
    });

    it('rejects freelancer recommendation rejection from a non-owner client', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );

      await expect(
        service.rejectFreelancerInvite('req-1', 'fp-reject', 'client-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(freelancerProposalRepo.findOne).not.toHaveBeenCalled();
    });

    it('does not let freelancers respond before the client approves the recommendation', async () => {
      const request = makeRequest({
        status: RequestStatus.SPEC_APPROVED,
        brokerId: 'broker-1',
      });

      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'fp-pending-review',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        status: 'PENDING_CLIENT_APPROVAL',
        request,
      });

      await expect(
        service.respondToInvitation(
          'fp-pending-review',
          'freelancer-1',
          UserRole.FREELANCER,
          'ACCEPTED',
        ),
      ).rejects.toThrow('Cannot respond to invitation with status: PENDING_CLIENT_APPROVAL');

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('broker marketplace access', () => {
    const brokerUser = { id: 'broker-1', role: UserRole.BROKER } as UserEntity;

    it('shows marketplace detail to a broker but masks client contact and hides other broker applications', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.PUBLIC_DRAFT,
          client: {
            id: 'client-1',
            fullName: 'Client Owner',
            email: 'client@example.com',
            phoneNumber: '0123456789',
          } as any,
          brokerProposals: [
            {
              id: 'proposal-me',
              brokerId: 'broker-1',
              status: ProposalStatus.PENDING,
              coverLetter: 'I can help.',
              broker: {
                id: 'broker-1',
                fullName: 'Broker Me',
                email: 'me@example.com',
              },
            },
            {
              id: 'proposal-other',
              brokerId: 'broker-2',
              status: ProposalStatus.PENDING,
              coverLetter: 'Pick me instead.',
              broker: {
                id: 'broker-2',
                fullName: 'Broker Other',
                email: 'other@example.com',
              },
            },
          ] as any,
        }),
      );

      const result = await service.findOne('req-1', brokerUser);

      expect(result.client?.email).toBe('********');
      expect((result.client as any)?.phoneNumber).toBe('********');
      expect(result.viewerPermissions?.canApplyAsBroker).toBe(true);
      expect(result.viewerPermissions?.canViewSpecs).toBe(false);
      expect(result.brokerApplicationSummary?.total).toBe(1);
      expect(result.brokerApplicationSummary?.items).toEqual([
        expect.objectContaining({ brokerId: 'broker-1' }),
      ]);
    });

    it('blocks a broker from viewing a request assigned to another broker', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.BROKER_ASSIGNED,
          brokerId: 'broker-2',
        }),
      );

      await expect(service.findOne('req-1', brokerUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignBroker', () => {
    it('rejects broker self-assignment and requires client selection instead', async () => {
      await expect(service.assignBroker('req-1', 'broker-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteRequest', () => {
    it('deletes a draft request owned by the caller', async () => {
      const request = makeRequest({
        id: 'req-delete',
        clientId: 'client-1',
        status: RequestStatus.PUBLIC_DRAFT,
      });

      requestRepo.findOne.mockResolvedValue(request);
      freelancerProposalRepo.findOne.mockResolvedValue(null);

      const result = await service.deleteRequest('req-delete', 'client-1', {} as any);

      expect(answerRepo.delete).toHaveBeenCalledWith({ requestId: 'req-delete' });
      expect(brokerProposalRepo.delete).toHaveBeenCalledWith({ requestId: 'req-delete' });
      expect(freelancerProposalRepo.delete).toHaveBeenCalledWith({ requestId: 'req-delete' });
      expect(requestRepo.remove).toHaveBeenCalledWith(request);
      expect(auditLogsService.logDelete).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Request deleted successfully' });
    });

    it('rejects deleting another client request', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ id: 'req-delete', clientId: 'client-a' }),
      );

      await expect(service.deleteRequest('req-delete', 'client-b')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects deletion after a broker has been assigned', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          id: 'req-delete',
          clientId: 'client-1',
          brokerId: 'broker-1',
          status: RequestStatus.BROKER_ASSIGNED,
        }),
      );

      await expect(service.deleteRequest('req-delete', 'client-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects deletion when an accepted freelancer exists', async () => {
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ id: 'req-delete', clientId: 'client-1' }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'proposal-accepted',
        status: 'ACCEPTED',
      });

      await expect(service.deleteRequest('req-delete', 'client-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
