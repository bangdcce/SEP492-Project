import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';

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
  let eventEmitter: { emit: jest.Mock };
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
    eventEmitter = {
      emit: jest.fn(),
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
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
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
              storagePath: '/uploads/brief.pdf',
              url: '/uploads/brief.pdf',
              mimetype: 'application/pdf',
              size: 2048,
              category: 'requirements',
            },
            {
              filename: 'image.png',
              storagePath: '/uploads/image.png',
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

  describe('findDraftsByClient', () => {
    it('UC16-DRF-01 returns the current client draft requests in descending order with hydrated attachments', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const latestDraft = makeRequest({
        id: 'req-draft-2',
        clientId: 'client-1',
        title: 'Second draft request',
        status: RequestStatus.DRAFT,
        attachments: [
          {
            filename: 'brief.pdf',
            url: '/uploads/brief.pdf',
            mimetype: 'application/pdf',
            size: 2048,
            category: 'requirements',
          },
        ],
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
      });
      const olderDraft = makeRequest({
        id: 'req-draft-1',
        clientId: 'client-1',
        title: 'First draft request',
        status: RequestStatus.DRAFT,
        attachments: [],
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
      });
      const hydrateAttachmentsSpy = jest
        .spyOn(service as any, 'hydrateAttachments')
        .mockResolvedValueOnce([
          {
            filename: 'brief.pdf',
            url: 'https://files.example.com/brief.pdf',
            mimetype: 'application/pdf',
            size: 2048,
            category: 'requirements',
          },
        ])
        .mockResolvedValueOnce([]);

      requestRepo.find.mockResolvedValue([latestDraft, olderDraft]);

      const result = await service.findDraftsByClient('client-1');

      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { clientId: 'client-1', status: RequestStatus.DRAFT },
        relations: ['answers', 'answers.question', 'answers.option'],
        order: { createdAt: 'DESC' },
      });
      expect(hydrateAttachmentsSpy).toHaveBeenNthCalledWith(
        1,
        latestDraft.attachments,
      );
      expect(hydrateAttachmentsSpy).toHaveBeenNthCalledWith(
        2,
        olderDraft.attachments,
      );
      expect(result).toEqual([
        {
          ...latestDraft,
          attachments: [
            {
              filename: 'brief.pdf',
              url: 'https://files.example.com/brief.pdf',
              mimetype: 'application/pdf',
              size: 2048,
              category: 'requirements',
            },
          ],
        },
        {
          ...olderDraft,
          attachments: [],
        },
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Find My Drafts Successful: 2 draft request(s)',
      );
    });

    it('UC16-DRF-02 returns an empty draft request list when the client has no saved drafts', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const hydrateAttachmentsSpy = jest.spyOn(service as any, 'hydrateAttachments');

      requestRepo.find.mockResolvedValue([]);

      const result = await service.findDraftsByClient('client-1');

      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { clientId: 'client-1', status: RequestStatus.DRAFT },
        relations: ['answers', 'answers.question', 'answers.option'],
        order: { createdAt: 'DESC' },
      });
      expect(hydrateAttachmentsSpy).not.toHaveBeenCalled();
      expect(result).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Find My Drafts Successful: 0 draft request(s)',
      );
    });
  });

  describe('getInvitationsForUser', () => {
    it('UC54-INV-01 returns only broker invitations that are still awaiting a response', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const brokerInvitations = [
        {
          id: 'broker-proposal-1',
          brokerId: 'broker-1',
          status: ProposalStatus.INVITED,
          request: makeRequest({
            id: 'req-1',
            title: 'Invited request',
          }),
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
        },
      ];

      brokerProposalRepo.find.mockResolvedValue(brokerInvitations);

      const result = await service.getInvitationsForUser('broker-1', UserRole.BROKER);

      expect(brokerProposalRepo.find).toHaveBeenCalledWith({
        where: {
          brokerId: 'broker-1',
          status: ProposalStatus.INVITED,
        },
        relations: ['request', 'request.client'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(brokerInvitations);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Get My Invitations Successful: BROKER -> 1 invitation(s)',
      );
    });

    it('UC54-INV-02 returns freelancer invitations in descending order for invited proposals', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const freelancerInvitations = [
        {
          id: 'freelancer-proposal-1',
          freelancerId: 'freelancer-1',
          status: 'INVITED',
          request: makeRequest({
            id: 'req-3',
            title: 'Freelancer invitation request',
          }),
          createdAt: new Date('2026-03-22T00:00:00.000Z'),
        },
      ];

      freelancerProposalRepo.find.mockResolvedValue(freelancerInvitations);

      const result = await service.getInvitationsForUser(
        'freelancer-1',
        UserRole.FREELANCER,
      );

      expect(freelancerProposalRepo.find).toHaveBeenCalledWith({
        where: { freelancerId: 'freelancer-1', status: 'INVITED' },
        relations: ['request', 'request.client'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(freelancerInvitations);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Get My Invitations Successful: FREELANCER -> 1 invitation(s)',
      );
    });

    it('UC54-INV-03 returns an empty invitation list for roles without invitation access', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      const result = await service.getInvitationsForUser('client-1', UserRole.CLIENT);

      expect(brokerProposalRepo.find).not.toHaveBeenCalled();
      expect(freelancerProposalRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Get My Invitations Successful: CLIENT -> 0 invitation(s)',
      );
    });
  });

  describe('getFreelancerRequestAccessList', () => {
    it('UC57-ACC-01 returns freelancer-accessible requests for invited, accepted, and pending proposals', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const accessibleRequests = [
        {
          id: 'access-2',
          freelancerId: 'freelancer-1',
          status: 'ACCEPTED',
          request: makeRequest({
            id: 'req-accepted',
            title: 'Accepted request access',
            broker: { id: 'broker-1', fullName: 'Broker One' } as any,
          }),
          createdAt: new Date('2026-03-23T00:00:00.000Z'),
        },
        {
          id: 'access-1',
          freelancerId: 'freelancer-1',
          status: 'INVITED',
          request: makeRequest({
            id: 'req-invited',
            title: 'Invited request access',
            broker: { id: 'broker-2', fullName: 'Broker Two' } as any,
          }),
          createdAt: new Date('2026-03-22T00:00:00.000Z'),
        },
      ];

      freelancerProposalRepo.find.mockResolvedValue(accessibleRequests);

      const result = await service.getFreelancerRequestAccessList('freelancer-1');

      expect(freelancerProposalRepo.find).toHaveBeenCalledWith({
        where: {
          freelancerId: 'freelancer-1',
          status: In(['INVITED', 'ACCEPTED', 'PENDING']),
        },
        relations: ['request', 'request.client', 'request.broker'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(accessibleRequests);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Get Freelancer Request Access List Successful: 2 request(s)',
      );
    });

    it('UC57-ACC-02 returns an empty request access list when the freelancer has no invited or accepted requests', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');

      freelancerProposalRepo.find.mockResolvedValue([]);

      const result = await service.getFreelancerRequestAccessList('freelancer-1');

      expect(freelancerProposalRepo.find).toHaveBeenCalledWith({
        where: {
          freelancerId: 'freelancer-1',
          status: In(['INVITED', 'ACCEPTED', 'PENDING']),
        },
        relations: ['request', 'request.client', 'request.broker'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Get Freelancer Request Access List Successful: 0 request(s)',
      );
    });
  });

  describe('getFreelancerMarketplaceRequests', () => {
    it('UC16-MKT-01 returns only open phase-3 freelancer marketplace requests and masks client contact', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      requestRepo.find.mockResolvedValue([
        makeRequest({
          id: 'req-open',
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
          client: {
            id: 'client-1',
            fullName: 'Client Owner',
            email: 'client@example.com',
            phoneNumber: '0123456789',
          } as any,
          proposals: [],
        }),
        makeRequest({
          id: 'req-selected',
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
          proposals: [
            {
              id: 'proposal-accepted',
              freelancerId: 'freelancer-1',
              status: 'ACCEPTED',
            },
          ] as any,
        }),
        makeRequest({
          id: 'req-no-broker',
          status: RequestStatus.SPEC_APPROVED,
          brokerId: null,
        }),
      ]);

      const result = await service.getFreelancerMarketplaceRequests();

      expect(requestRepo.find).toHaveBeenCalledWith({
        where: { status: RequestStatus.SPEC_APPROVED },
        relations: ['client', 'broker', 'proposals'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'req-open',
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
        }),
      );
      expect(result[0].client?.email).toBe('********');
      expect((result[0].client as any)?.phoneNumber).toBe('********');
      expect(result[0].proposals).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Get Freelancer Marketplace Requests Successful: 1 request(s)',
      );
    });
  });

  describe('findOne - client request access', () => {
    it('UC17-DET-01 returns request detail for the owning client without masking client contact data', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
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
      expect(consoleLogSpy).toHaveBeenCalledWith('Get Request Detail Successful: "req-1"');
    });

    it('UC17-DET-02 rejects request detail when a client tries to view another client request', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          clientId: 'client-2',
        }),
      );

      await expect(
        service.findOne('req-1', { id: 'client-1', role: UserRole.CLIENT } as UserEntity),
      ).rejects.toThrow(ForbiddenException);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Get Request Detail Failed: Forbidden: You can only view your own requests',
      );
    });

    it('UC17-DET-03 rejects request detail when the request does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('req-404', { id: 'client-1', role: UserRole.CLIENT } as UserEntity),
      ).rejects.toThrow(NotFoundException);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Get Request Detail Failed: Request not found',
      );
    });

    it('UC17-DET-06 returns request detail for an invited freelancer', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.SPEC_APPROVED,
          proposals: [
            {
              id: 'proposal-freelancer-1',
              freelancerId: 'freelancer-1',
              status: 'INVITED',
            },
          ] as any,
        }),
      );

      const result = await service.findOne(
        'req-1',
        { id: 'freelancer-1', role: UserRole.FREELANCER } as UserEntity,
      );

      expect(result.id).toBe('req-1');
      expect(consoleLogSpy).toHaveBeenCalledWith('Get Request Detail Successful: "req-1"');
    });

    it('UC17-DET-07 returns a masked phase-3 marketplace preview for freelancers without an invitation', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
          client: {
            id: 'client-1',
            fullName: 'Client Owner',
            email: 'client@example.com',
            phoneNumber: '0123456789',
          } as any,
          proposals: [],
          specs: [
            {
              id: 'spec-1',
              title: 'Locked client spec',
              status: ProjectSpecStatus.CLIENT_APPROVED,
              specPhase: SpecPhase.CLIENT_SPEC,
            },
          ] as any,
        }),
      );

      const result = await service.findOne(
        'req-1',
        { id: 'freelancer-9', role: UserRole.FREELANCER } as UserEntity,
      );

      expect(result.id).toBe('req-1');
      expect(result.client?.email).toBe('********');
      expect((result.client as any)?.phoneNumber).toBe('********');
      expect(result.viewerPermissions?.canViewSpecs).toBe(false);
      expect(result.specSummary?.clientSpec).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith('Get Request Detail Successful: "req-1"');
    });

    it('UC17-DET-08 rejects request detail when a freelancer has no invitation and the request is outside the freelancer marketplace phase', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.CONTRACT_PENDING,
          brokerId: 'broker-1',
          proposals: [],
        }),
      );

      await expect(
        service.findOne('req-1', { id: 'freelancer-9', role: UserRole.FREELANCER } as UserEntity),
      ).rejects.toThrow(ForbiddenException);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Get Request Detail Failed: Forbidden: You can only view freelancer marketplace requests or requests where you are invited',
      );
    });
  });

  describe('findMatches', () => {
    it('UC28-MAT-03 checks AI-match quota, forwards broker matching input, and records the candidate count when a caller id is provided', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Find Matches Successful: 1 candidate(s) for request "req-match-1"',
      );
    });

    it('UC28-MAT-01 returns broker matches without quota tracking when the endpoint only supplies request id', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const request = makeRequest({
        id: 'req-match-2',
        description: 'Need help with a marketplace launch.',
        techPreferences: '',
      });
      const matches = [
        {
          userId: 'broker-2',
          fullName: 'Broker Two',
          matchScore: 84,
        },
      ];

      requestRepo.findOne.mockResolvedValue(request);
      matchingService.findMatches.mockResolvedValue(matches);

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
      expect(result).toEqual(matches);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Find Matches Successful: 1 candidate(s) for request "req-match-2"',
      );
    });

    it('UC28-MAT-02 returns an empty candidate list when matching service finds no available partners', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const request = makeRequest({
        id: 'req-match-3',
        description: 'Need help with a marketplace launch.',
        techPreferences: 'NestJS',
      });

      requestRepo.findOne.mockResolvedValue(request);
      matchingService.findMatches.mockResolvedValue([]);

      const result = await service.findMatches('req-match-3');

      expect(quotaService.checkQuota).not.toHaveBeenCalled();
      expect(quotaService.incrementUsage).not.toHaveBeenCalled();
      expect(result).toEqual([]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Find Matches Successful: 0 candidate(s) for request "req-match-3"',
      );
    });

    it('UC28-MAT-04 rejects broker matching when the request does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.findMatches('req-match-404')).rejects.toThrow(NotFoundException);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Find Matches Failed: Request not found',
      );
    });
  });

  describe('update', () => {
    it('UC22-UPD-01 updates editable request fields for the owning client and returns the updated request', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Update Request Successful: "req-1" -> "DRAFT"',
      );
    });

    it('UC22-UPD-03 rejects request editing from a different client owner', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Update Request Failed: Forbidden: You cannot update this request',
      );
    });

    it('UC22-UPD-02 switches "PUBLIC_DRAFT" to "PRIVATE_DRAFT" and rejects pending broker proposals', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Update Request Successful: "req-1" -> "PRIVATE_DRAFT"',
      );
    });

    it('UC22-UPD-04 switches "PRIVATE_DRAFT" to "PUBLIC_DRAFT" without rejecting broker proposals', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Update Request Successful: "req-1" -> "PUBLIC_DRAFT"',
      );
    });

    it('UC22-UPD-05 allows an internal admin to update a request they do not own', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const existingRequest = makeRequest({
        clientId: 'client-1',
        title: 'Client owned request',
      });
      const updatedRequest = makeRequest({
        clientId: 'client-1',
        title: 'Admin adjusted request',
      });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);
      jest.spyOn(service, 'findOne').mockResolvedValue(updatedRequest as any);
      requestRepo.save.mockImplementation(async (value) => value);

      const result = await service.update(
        'req-1',
        { title: 'Admin adjusted request' } as any,
        { id: 'admin-1', role: UserRole.ADMIN } as UserEntity,
      );

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Admin adjusted request' }),
      );
      expect(result).toEqual(updatedRequest);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Update Request Successful: "req-1" -> "DRAFT"',
      );
    });

    it('UC22-UPD-06 allows the assigned broker to update the request details', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const existingRequest = makeRequest({
        brokerId: 'broker-1',
        status: RequestStatus.BROKER_ASSIGNED,
        description: 'Old broker-facing summary',
      });
      const updatedRequest = makeRequest({
        brokerId: 'broker-1',
        status: RequestStatus.BROKER_ASSIGNED,
        description: 'Broker updated summary',
      });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);
      jest.spyOn(service, 'findOne').mockResolvedValue(updatedRequest as any);
      requestRepo.save.mockImplementation(async (value) => value);

      const result = await service.update(
        'req-1',
        { description: 'Broker updated summary' } as any,
        { id: 'broker-1', role: UserRole.BROKER } as UserEntity,
      );

      expect(requestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          brokerId: 'broker-1',
          description: 'Broker updated summary',
        }),
      );
      expect(result).toEqual(updatedRequest);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Update Request Successful: "req-1" -> "BROKER_ASSIGNED"',
      );
    });
  });

  describe('publish', () => {
    it('UC15-PUB-01 publishes a client-owned "DRAFT" request to "PUBLIC_DRAFT"', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Publish Request Successful: "req-1" -> "PUBLIC_DRAFT"',
      );
    });

    it('UC15-PUB-02 publishes a client-owned "PRIVATE_DRAFT" request to "PUBLIC_DRAFT"', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Publish Request Successful: "req-1" -> "PUBLIC_DRAFT"',
      );
    });

    it('UC15-PUB-03 returns the request unchanged when it is already "PUBLIC_DRAFT"', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const publicRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });

      jest.spyOn(service, 'findOne').mockResolvedValue(publicRequest as any);

      const result = await service.publish('req-1', 'client-1', {} as any);

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(auditLogsService.logUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(publicRequest);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Publish Request Successful: "req-1" -> "PUBLIC_DRAFT"',
      );
    });

    it('UC15-PUB-04 rejects publish from a non-publishable status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const assignedRequest = makeRequest({
        status: RequestStatus.BROKER_ASSIGNED,
        brokerId: 'broker-1',
      });

      jest.spyOn(service, 'findOne').mockResolvedValue(assignedRequest as any);

      await expect(service.publish('req-1', 'client-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Publish Request Failed: Request cannot be published from status "BROKER_ASSIGNED"',
      );
    });

    it('UC15-PUB-05 rejects publish when a broker is already assigned even if the request is still in a draft status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const assignedPrivateDraft = makeRequest({
        status: RequestStatus.PRIVATE_DRAFT,
        brokerId: 'broker-1',
      });

      jest.spyOn(service, 'findOne').mockResolvedValue(assignedPrivateDraft as any);

      await expect(service.publish('req-1', 'client-1', {} as any)).rejects.toThrow(
        BadRequestException,
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Publish Request Failed: Cannot publish a request that already has a broker assigned',
      );
    });

    it('UC15-PUB-06 still returns the published request when audit logging fails', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const draftRequest = makeRequest({ status: RequestStatus.DRAFT });
      const publishedRequest = makeRequest({ status: RequestStatus.PUBLIC_DRAFT });

      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(draftRequest as any)
        .mockResolvedValueOnce(publishedRequest as any);
      requestRepo.save.mockResolvedValue(publishedRequest);
      auditLogsService.logUpdate.mockRejectedValueOnce(new Error('db unavailable'));

      const result = await service.publish('req-1', 'client-1', {} as any);

      expect(result).toEqual(publishedRequest);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Publish Request Audit Log Failed');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Publish Request Successful: "req-1" -> "PUBLIC_DRAFT"',
      );
    });
  });

  describe('inviteBroker', () => {
    it('UC30-INV-01 creates an "INVITED" broker proposal and notifies the broker', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Invite Broker Successful: "req-invite-1" -> "broker-1"',
      );
    });

    it('UC30-INV-02 rejects inviting a broker when the request already has an assigned broker', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invite Broker Failed: Request already has a broker assigned',
      );
    });

    it('UC30-INV-03 rejects inviting a broker who already has an "INVITED" proposal', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invite Broker Failed: Broker already invited',
      );
    });

    it('UC30-INV-04 rejects inviting a broker who has already applied to the request', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invite Broker Failed: Broker has already applied',
      );
    });
  });

  describe('applyToRequest', () => {
    it('UC62-APL-01 creates a pending broker proposal for a "PUBLIC_DRAFT" request', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Apply To Request Successful: "req-1" -> "broker-1"',
      );
    });

    it('UC62-APL-02 rejects duplicate broker applications for the same request', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Apply To Request Failed: Broker already has an application or invitation for this request',
      );
    });

    it('UC62-APL-03 rejects applications when the request is not public', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const privateRequest = makeRequest({ status: RequestStatus.PRIVATE_DRAFT });

      requestRepo.findOne.mockResolvedValue(privateRequest);

      await expect(
        service.applyToRequest('req-1', 'broker-1', 'not public'),
      ).rejects.toThrow(BadRequestException);

      expect(brokerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Apply To Request Failed: Request is not open for marketplace applications.',
      );
    });

    it('UC62-APL-04 rejects applications when the request does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyToRequest('req-404', 'broker-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Apply To Request Failed: Request not found',
      );
    });

    it('UC62-APL-05 rejects applications when the request already has an assigned broker', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.PUBLIC_DRAFT,
          brokerId: 'broker-2',
        }),
      );

      await expect(
        service.applyToRequest('req-1', 'broker-1', 'already assigned'),
      ).rejects.toThrow(BadRequestException);

      expect(brokerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(quotaService.checkQuota).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Apply To Request Failed: Request already has a broker assigned.',
      );
    });

    it('UC62-APL-06 rejects applications when the broker application cap has been reached', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.PUBLIC_DRAFT, brokerId: null }),
      );
      brokerProposalRepo.count.mockResolvedValueOnce(10);

      await expect(
        service.applyToRequest('req-1', 'broker-1', 'cap reached'),
      ).rejects.toThrow(BadRequestException);

      expect(brokerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(quotaService.checkQuota).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Apply To Request Failed: Broker application limit reached for this request. Only 10 active applications are allowed within 72 hours.',
      );
    });

    it('UC62-APL-07 rejects applications when broker quota validation fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.PUBLIC_DRAFT, brokerId: null }),
      );
      brokerProposalRepo.findOne.mockResolvedValue(null);
      quotaService.checkQuota.mockRejectedValueOnce(new BadRequestException('Quota exceeded'));

      await expect(
        service.applyToRequest('req-1', 'broker-1', 'quota blocked'),
      ).rejects.toThrow(BadRequestException);

      expect(brokerProposalRepo.create).not.toHaveBeenCalled();
      expect(quotaService.incrementUsage).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Apply To Request Failed: Quota exceeded',
      );
    });
  });

  describe('acceptBroker', () => {
    it('EP-206-SVC-01 assigns the selected broker, marks the request "BROKER_ASSIGNED", and rejects the other pending proposals', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Accept Broker Successful: "req-1" -> "broker-1"',
      );
    });

    it('EP-206-SVC-02 rejects broker acceptance from a client who does not own the request', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const existingRequest = makeRequest({
        id: 'req-1',
        clientId: 'client-1',
        status: RequestStatus.PUBLIC_DRAFT,
      });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(existingRequest);

      await expect(service.acceptBroker('req-1', 'broker-1', 'client-2')).rejects.toThrow(
        ForbiddenException,
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(brokerProposalRepo.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Accept Broker Failed: Forbidden: You can only accept brokers for your own requests',
      );
    });

    it('EP-206-SVC-03 rejects broker acceptance from an invalid request state', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const completedRequest = makeRequest({ status: RequestStatus.COMPLETED });

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(completedRequest);

      await expect(service.acceptBroker('req-1', 'broker-1', 'client-1')).rejects.toThrow(
        'Request is not in a valid state to accept a broker',
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(brokerProposalRepo.update).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Accept Broker Failed: Request is not in a valid state to accept a broker',
      );
    });
  });

  describe('releaseBrokerSlot', () => {
    it('EP-207-SVC-01 releases an active broker slot and returns the refreshed request', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const request = makeRequest({
        id: 'req-1',
        clientId: 'client-1',
        status: RequestStatus.PUBLIC_DRAFT,
        brokerId: null,
      });
      const refreshedRequest = makeRequest({
        id: 'req-1',
        clientId: 'client-1',
        status: RequestStatus.PUBLIC_DRAFT,
      });
      const proposal = {
        id: 'application-1',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.PENDING,
      };

      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(request);
      jest.spyOn(service, 'findOne').mockResolvedValue(refreshedRequest as any);
      brokerProposalRepo.findOne.mockResolvedValue(proposal);
      brokerProposalRepo.save.mockResolvedValue({ ...proposal, status: ProposalStatus.REJECTED });

      const result = await service.releaseBrokerSlot(
        'req-1',
        'application-1',
        { id: 'client-1', role: UserRole.CLIENT } as UserEntity,
      );

      expect(brokerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'application-1',
          status: ProposalStatus.REJECTED,
        }),
      );
      expect(result).toEqual(refreshedRequest);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Release Broker Slot Successful: "application-1"',
      );
    });

    it('EP-207-SVC-02 rejects releasing a broker slot from an inactive application status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(
        makeRequest({
          id: 'req-1',
          clientId: 'client-1',
          status: RequestStatus.PUBLIC_DRAFT,
          brokerId: null,
        }),
      );
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'application-1',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.ACCEPTED,
      });

      await expect(
        service.releaseBrokerSlot(
          'req-1',
          'application-1',
          { id: 'client-1', role: UserRole.CLIENT } as UserEntity,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Release Broker Slot Failed: Proposal status ACCEPTED cannot be released.',
      );
    });

    it('EP-207-SVC-03 rejects broker slot release from a non-owner actor', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(
        makeRequest({
          id: 'req-1',
          clientId: 'client-1',
          status: RequestStatus.PUBLIC_DRAFT,
          brokerId: null,
        }),
      );

      await expect(
        service.releaseBrokerSlot(
          'req-1',
          'application-1',
          { id: 'client-2', role: UserRole.CLIENT } as UserEntity,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(brokerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Release Broker Slot Failed: Only the client or internal staff can release a broker slot.',
      );
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

    it('UC30-INV-05 creates a pending-client-approval freelancer proposal and records the broker id', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Invite Freelancer Successful: "req-1" -> "freelancer-1"',
      );
    });

    it('EP-203-SVC-01 approves a freelancer recommendation and makes it visible to the freelancer', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const request = makeRequest({
        status: RequestStatus.SPEC_APPROVED,
        brokerId: 'broker-1',
      });
      const proposal = {
        id: 'recommendation-approve-1',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'PENDING_CLIENT_APPROVAL',
      };

      requestRepo.findOne.mockResolvedValue(request);
      freelancerProposalRepo.findOne.mockResolvedValue(proposal);
      freelancerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.approveFreelancerInvite(
        'req-1',
        'recommendation-approve-1',
        'client-1',
      );

      expect(freelancerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'recommendation-approve-1',
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Approve Freelancer Invite Successful: "recommendation-approve-1"',
      );
    });

    it('EP-203-SVC-02 rejects freelancer recommendation approval from a non-owner client', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );

      await expect(
        service.approveFreelancerInvite('req-1', 'recommendation-approve-1', 'client-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(freelancerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Approve Freelancer Invite Failed: Forbidden: You can only approve freelancer recommendations for your own requests',
      );
    });

    it('EP-203-SVC-03 rejects approving a freelancer recommendation from a non-pending status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'recommendation-approve-1',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'INVITED',
      });

      await expect(
        service.approveFreelancerInvite('req-1', 'recommendation-approve-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Approve Freelancer Invite Failed: Proposal status INVITED cannot be approved by the client.',
      );
    });

    it('EP-203-SVC-04 rejects approving a freelancer recommendation when the recommendation does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approveFreelancerInvite('req-1', 'recommendation-missing-1', 'client-1'),
      ).rejects.toThrow(NotFoundException);

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Approve Freelancer Invite Failed: Freelancer proposal not found.',
      );
    });

    it('EP-204-SVC-01 rejects a freelancer recommendation and notifies the broker', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const request = makeRequest({
        status: RequestStatus.SPEC_APPROVED,
        brokerId: 'broker-1',
      });
      const proposal = {
        id: 'recommendation-reject-1',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'PENDING_CLIENT_APPROVAL',
      };

      requestRepo.findOne.mockResolvedValue(request);
      freelancerProposalRepo.findOne.mockResolvedValue(proposal);
      freelancerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.rejectFreelancerInvite(
        'req-1',
        'recommendation-reject-1',
        'client-1',
      );

      expect(freelancerProposalRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'recommendation-reject-1',
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Reject Freelancer Invite Successful: "recommendation-reject-1"',
      );
    });

    it('UC30-INV-06 rejects freelancer recommendation from a non-owner broker or staff context', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-2' }),
      );

      await expect(
        service.inviteFreelancer(
          'req-1',
          'freelancer-1',
          'Strong frontend portfolio.',
          { id: 'broker-1', role: UserRole.BROKER } as UserEntity,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invite Freelancer Failed: Only the assigned broker or internal staff can recommend freelancers.',
      );
    });

    it('UC30-INV-07 rejects freelancer recommendation before the client approves the client spec', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.BROKER_ASSIGNED,
          brokerId: 'broker-1',
          specs: [],
        }),
      );

      await expect(
        service.inviteFreelancer(
          'req-1',
          'freelancer-1',
          'Strong frontend portfolio.',
          { id: 'broker-1', role: UserRole.BROKER } as UserEntity,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(freelancerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invite Freelancer Failed: Freelancer recommendations are only available after the client approves the client spec.',
      );
    });

    it('UC30-INV-08 rejects freelancer recommendation when the freelancer is already associated with the request', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
          specs: [approvedClientSpec as any],
        }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'fp-existing',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        status: 'INVITED',
      });

      await expect(
        service.inviteFreelancer(
          'req-1',
          'freelancer-1',
          'Strong frontend portfolio.',
          { id: 'broker-1', role: UserRole.BROKER } as UserEntity,
        ),
      ).rejects.toThrow('Freelancer already associated with this request (Status: INVITED)');

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invite Freelancer Failed: Freelancer already associated with this request (Status: INVITED)',
      );
    });

    it('EP-204-SVC-02 rejects freelancer recommendation rejection from a non-owner client', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );

      await expect(
        service.rejectFreelancerInvite('req-1', 'recommendation-reject-1', 'client-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(freelancerProposalRepo.findOne).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Reject Freelancer Invite Failed: Forbidden: You can only reject freelancer recommendations for your own requests',
      );
    });

    it('EP-204-SVC-03 rejects freelancer recommendation rejection from a non-pending status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'recommendation-reject-1',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'INVITED',
      });

      await expect(
        service.rejectFreelancerInvite('req-1', 'recommendation-reject-1', 'client-1'),
      ).rejects.toThrow(BadRequestException);

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Reject Freelancer Invite Failed: Proposal status INVITED cannot be rejected by the client.',
      );
    });

    it('EP-204-SVC-04 rejects freelancer recommendation rejection when the recommendation does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ status: RequestStatus.SPEC_APPROVED, brokerId: 'broker-1' }),
      );
      freelancerProposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rejectFreelancerInvite('req-1', 'recommendation-missing-2', 'client-1'),
      ).rejects.toThrow(NotFoundException);

      expect(freelancerProposalRepo.save).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Reject Freelancer Invite Failed: Freelancer proposal not found.',
      );
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

  describe('respondToInvitation endpoint pack', () => {
    const approvedClientSpec = {
      id: 'client-spec-ep210',
      title: 'Client Spec',
      status: ProjectSpecStatus.CLIENT_APPROVED,
      specPhase: SpecPhase.CLIENT_SPEC,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
      updatedAt: new Date('2026-03-19T00:00:00.000Z'),
    };

    it('EP-210-SVC-01 allows an invited broker to accept and become the assigned broker', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const request = makeRequest({
        status: RequestStatus.PRIVATE_DRAFT,
        brokerId: null,
      });
      const proposal = {
        id: 'invite-broker-1',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        request,
      };
      const competingProposal = {
        id: 'invite-broker-2',
        requestId: 'req-1',
        brokerId: 'broker-2',
        status: ProposalStatus.PENDING,
      };

      brokerProposalRepo.findOne.mockResolvedValue(proposal);
      brokerProposalRepo.find.mockResolvedValue([proposal, competingProposal]);
      brokerProposalRepo.save.mockImplementation(async (value) => value);
      requestRepo.save.mockImplementation(async (value) => value);

      const result = await service.respondToInvitation(
        'invite-broker-1',
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
          id: 'invite-broker-2',
          status: ProposalStatus.REJECTED,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'invite-broker-1',
          status: ProposalStatus.ACCEPTED,
        }),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Respond To Invitation Successful: role="BROKER" invitation="invite-broker-1" status="ACCEPTED"',
      );
    });

    it('EP-210-SVC-02 allows an invited broker to reject the invitation', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const proposal = {
        id: 'invite-broker-3',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        request: makeRequest({
          status: RequestStatus.PUBLIC_DRAFT,
          brokerId: null,
        }),
      };

      brokerProposalRepo.findOne.mockResolvedValue(proposal);
      brokerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.respondToInvitation(
        'invite-broker-3',
        'broker-1',
        UserRole.BROKER,
        'REJECTED',
      );

      expect(requestRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'invite-broker-3',
          status: ProposalStatus.REJECTED,
        }),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Respond To Invitation Successful: role="BROKER" invitation="invite-broker-3" status="REJECTED"',
      );
    });

    it('EP-210-SVC-03 rejects broker invitation responses when the invitation is missing', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      brokerProposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.respondToInvitation('invite-missing', 'broker-1', UserRole.BROKER, 'ACCEPTED'),
      ).rejects.toThrow('Invitation not found');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Respond To Invitation Failed: Invitation not found',
      );
    });

    it('EP-210-SVC-04 rejects broker invitation responses from a non-invited status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'invite-broker-4',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.PENDING,
        request: makeRequest(),
      });

      await expect(
        service.respondToInvitation('invite-broker-4', 'broker-1', UserRole.BROKER, 'ACCEPTED'),
      ).rejects.toThrow('Cannot respond to invitation with status: PENDING');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Respond To Invitation Failed: Cannot respond to invitation with status: PENDING',
      );
    });

    it('EP-210-SVC-05 blocks broker acceptance when another broker is already assigned', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      brokerProposalRepo.findOne.mockResolvedValue({
        id: 'invite-broker-5',
        requestId: 'req-1',
        brokerId: 'broker-1',
        status: ProposalStatus.INVITED,
        request: makeRequest({
          status: RequestStatus.BROKER_ASSIGNED,
          brokerId: 'broker-2',
        }),
      });

      await expect(
        service.respondToInvitation('invite-broker-5', 'broker-1', UserRole.BROKER, 'ACCEPTED'),
      ).rejects.toThrow(BadRequestException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Respond To Invitation Failed: Another broker has already been assigned to this request.',
      );
    });

    it('EP-210-SVC-06 allows an invited freelancer to accept after client approval', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const execute = jest.fn().mockResolvedValue(undefined);
      freelancerProposalRepo.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute,
      });

      freelancerProposalRepo.findOne
        .mockResolvedValueOnce({
          id: 'invite-freelancer-1',
          requestId: 'req-1',
          freelancerId: 'freelancer-1',
          brokerId: 'broker-1',
          status: 'INVITED',
          request: makeRequest({
            status: RequestStatus.SPEC_APPROVED,
            brokerId: 'broker-1',
          }),
        })
        .mockResolvedValueOnce(null);
      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(
        makeRequest({
          id: 'req-1',
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
          specs: [approvedClientSpec as any],
        }),
      );
      freelancerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.respondToInvitation(
        'invite-freelancer-1',
        'freelancer-1',
        UserRole.FREELANCER,
        'ACCEPTED',
      );

      expect(execute).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          id: 'invite-freelancer-1',
          status: 'ACCEPTED',
        }),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Respond To Invitation Successful: role="FREELANCER" invitation="invite-freelancer-1" status="ACCEPTED"',
      );
    });

    it('EP-210-SVC-07 allows an invited freelancer to reject the invitation', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'invite-freelancer-2',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'INVITED',
        request: makeRequest({
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
        }),
      });
      freelancerProposalRepo.save.mockImplementation(async (value) => value);

      const result = await service.respondToInvitation(
        'invite-freelancer-2',
        'freelancer-1',
        UserRole.FREELANCER,
        'REJECTED',
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'invite-freelancer-2',
          status: 'REJECTED',
        }),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Respond To Invitation Successful: role="FREELANCER" invitation="invite-freelancer-2" status="REJECTED"',
      );
    });

    it('EP-210-SVC-08 rejects freelancer invitation responses when the invitation is missing', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      freelancerProposalRepo.findOne.mockResolvedValue(null);

      await expect(
        service.respondToInvitation(
          'invite-freelancer-missing',
          'freelancer-1',
          UserRole.FREELANCER,
          'ACCEPTED',
        ),
      ).rejects.toThrow('Invitation not found');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Respond To Invitation Failed: Invitation not found',
      );
    });

    it('EP-210-SVC-09 blocks freelancer acceptance before the client approves the broker draft', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      freelancerProposalRepo.findOne.mockResolvedValue({
        id: 'invite-freelancer-3',
        requestId: 'req-1',
        freelancerId: 'freelancer-1',
        brokerId: 'broker-1',
        status: 'INVITED',
        request: makeRequest({
          status: RequestStatus.PRIVATE_DRAFT,
          brokerId: 'broker-1',
        }),
      });
      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(
        makeRequest({
          id: 'req-1',
          status: RequestStatus.PRIVATE_DRAFT,
          brokerId: 'broker-1',
          specs: [],
        }),
      );

      await expect(
        service.respondToInvitation(
          'invite-freelancer-3',
          'freelancer-1',
          UserRole.FREELANCER,
          'ACCEPTED',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Respond To Invitation Failed: Freelancer can only accept after the broker draft has been approved by the client.',
      );
    });

    it('EP-210-SVC-10 blocks freelancer acceptance when another freelancer was already accepted', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      freelancerProposalRepo.findOne
        .mockResolvedValueOnce({
          id: 'invite-freelancer-4',
          requestId: 'req-1',
          freelancerId: 'freelancer-1',
          brokerId: 'broker-1',
          status: 'INVITED',
          request: makeRequest({
            status: RequestStatus.SPEC_APPROVED,
            brokerId: 'broker-1',
          }),
        })
        .mockResolvedValueOnce({
          id: 'invite-freelancer-other',
          requestId: 'req-1',
          freelancerId: 'freelancer-2',
          status: 'ACCEPTED',
        });
      jest.spyOn(service as any, 'findOneEntity').mockResolvedValue(
        makeRequest({
          id: 'req-1',
          status: RequestStatus.SPEC_APPROVED,
          brokerId: 'broker-1',
          specs: [approvedClientSpec as any],
        }),
      );

      await expect(
        service.respondToInvitation(
          'invite-freelancer-4',
          'freelancer-1',
          UserRole.FREELANCER,
          'ACCEPTED',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Respond To Invitation Failed: A freelancer has already been accepted for this request',
      );
    });
  });

  describe('broker marketplace access', () => {
    const brokerUser = { id: 'broker-1', role: UserRole.BROKER } as UserEntity;

    it('UC17-DET-04 shows marketplace detail to a broker but masks client contact and hides other broker applications', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
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
      expect(consoleLogSpy).toHaveBeenCalledWith('Get Request Detail Successful: "req-1"');
    });

    it('UC17-DET-05 blocks a broker from viewing a request assigned to another broker', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      requestRepo.findOne.mockResolvedValue(
        makeRequest({
          status: RequestStatus.BROKER_ASSIGNED,
          brokerId: 'broker-2',
        }),
      );

      await expect(service.findOne('req-1', brokerUser)).rejects.toThrow(ForbiddenException);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Get Request Detail Failed: Forbidden: You can only view open marketplace requests, your invitations, or requests assigned to you',
      );
    });
  });

  describe('assignBroker', () => {
    it('UC24-ASN-01 rejects broker self-assignment and requires client selection instead', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      await expect(service.assignBroker('req-1', 'broker-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Assign Broker Failed: Brokers cannot assign marketplace requests to themselves. Apply to the request and wait for the client to select you.',
      );
    });
  });

  describe('deleteRequest', () => {
    it('UC19-DEL-01 deletes a draft request owned by the caller', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
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
      expect(consoleLogSpy).toHaveBeenCalledWith('Delete Request Successful: "req-delete"');
    });

    it('UC19-DEL-02 rejects deleting another client request', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(
        makeRequest({ id: 'req-delete', clientId: 'client-a' }),
      );

      await expect(service.deleteRequest('req-delete', 'client-b')).rejects.toThrow(
        ForbiddenException,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Delete Request Failed: You can only delete your own requests',
      );
    });

    it('UC19-DEL-03 rejects deletion after a broker has been assigned', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Delete Request Failed: Cannot delete request with status "BROKER_ASSIGNED". Only draft requests can be deleted.',
      );
    });

    it('UC19-DEL-04 rejects deletion when an accepted freelancer exists', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Delete Request Failed: Cannot delete a request that has an accepted freelancer.',
      );
    });

    it('UC19-DEL-05 rejects deletion when the request does not exist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      requestRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteRequest('req-missing', 'client-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Delete Request Failed: Request not found',
      );
    });
  });
});
