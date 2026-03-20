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
import { QuotaService } from '../subscriptions/quota.service';
import { ProjectRequestsService } from './project-requests.service';

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
    it('creates a new marketplace request in PUBLIC_DRAFT when isDraft is false', async () => {
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
      expect(result).toEqual(hydratedRequest);
    });

    it('creates a draft request in DRAFT when isDraft is true', async () => {
      const dto = {
        title: 'Draft request',
        description: 'Save for later',
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
          status: RequestStatus.DRAFT,
        }),
      );
      expect(answerRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(createdRequest);
    });
  });

  describe('update', () => {
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
