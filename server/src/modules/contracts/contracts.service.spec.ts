import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ContractsService } from './contracts.service';
import {
  ContractCommercialContext,
  ContractEntity,
  ContractStatus,
} from '../../database/entities/contract.entity';
import {
  ProjectEntity,
  ProjectStaffInviteStatus,
  ProjectStatus,
} from '../../database/entities/project.entity';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
} from '../../database/entities/project-spec.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  DeliverableType,
  MilestoneEntity,
  MilestoneStatus,
} from '../../database/entities/milestone.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';
import { EscrowEntity } from '../../database/entities/escrow.entity';
import { ContractArchiveStorageService } from './contract-archive.storage';
import { NotificationsService } from '../notifications/notifications.service';
import { SigningCredentialsService } from '../auth/signing-credentials.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let queryRunner: QueryRunner;
  let mockDataSource: { createQueryRunner: jest.Mock; getRepository: jest.Mock };

  const mockContractsRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockProjectsRepo = {};
  const mockProjectSpecsRepo = {
    findOne: jest.fn(),
  };
  const mockProjectRequestsRepo = {};
  const mockProjectRequestProposalsRepo = { find: jest.fn() };
  const mockAuditLogsService = { log: jest.fn() };
  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
  };
  const mockEventEmitter = { emit: jest.fn() };
  const mockContractArchiveStorage = {
    persistPdfArtifact: jest.fn(),
    downloadPdfArtifact: jest.fn(),
  };
  const mockEscrowReadRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockSigningCredentialsService = {
    signContentHash: jest.fn().mockResolvedValue({
      signatureBase64: 'signed-payload',
      signatureAlgorithm: 'RSA-SHA256',
      keyFingerprint: 'mini-ca-fingerprint',
      keyVersion: 1,
      certificateSerial: 'INTERDEV-MCA-1-MINI',
    }),
  };

  const mockManager = {
    create: jest.fn((_: unknown, data: unknown) => data),
    save: jest.fn(async (...args: unknown[]) => {
      if (args.length === 2) {
        return args[1];
      }
      return args[0];
    }),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const brokerUser: UserEntity = {
    id: 'broker-uuid',
    role: UserRole.BROKER,
  } as UserEntity;

  const buildSnapshot = () => [
    {
      contractMilestoneKey: 'cmk-1',
      sourceSpecMilestoneId: 'spec-m1',
      title: 'Milestone 1',
      description: 'Kickoff',
      amount: 300,
      startDate: '2026-03-01T00:00:00.000Z',
      dueDate: '2026-03-10T00:00:00.000Z',
      sortOrder: 1,
      deliverableType: DeliverableType.DESIGN_PROTOTYPE,
      retentionAmount: 0,
      acceptanceCriteria: ['Approved wireframes'],
    },
    {
      contractMilestoneKey: 'cmk-2',
      sourceSpecMilestoneId: 'spec-m2',
      title: 'Milestone 2',
      description: 'Build',
      amount: 700,
      startDate: '2026-03-11T00:00:00.000Z',
      dueDate: '2026-04-01T00:00:00.000Z',
      sortOrder: 2,
      deliverableType: DeliverableType.SOURCE_CODE,
      retentionAmount: 50,
      acceptanceCriteria: ['All features completed'],
    },
  ];

  const buildProject = (overrides: Partial<ProjectEntity> = {}): ProjectEntity =>
    ({
      id: 'project-uuid',
      requestId: 'request-uuid',
      clientId: 'client-uuid',
      brokerId: 'broker-uuid',
      freelancerId: 'freelancer-uuid',
      title: 'Website Revamp',
      description: 'Scoped project',
      totalBudget: 1000,
      currency: 'USD',
      status: ProjectStatus.INITIALIZING,
      ...overrides,
    }) as ProjectEntity;

  const buildCommercialContext = (
    project: ProjectEntity,
    overrides: Partial<ContractCommercialContext> = {},
  ): ContractCommercialContext => ({
    sourceSpecId: 'spec-uuid',
    sourceSpecUpdatedAt: '2026-03-01T00:00:00.000Z',
    requestId: project.requestId ?? null,
    projectTitle: project.title,
    clientId: project.clientId,
    brokerId: project.brokerId,
    freelancerId: project.freelancerId ?? null,
    totalBudget: 1000,
    currency: project.currency,
    description: project.description,
    techStack: 'NestJS, React',
    scopeNarrativeRichContent: null,
    scopeNarrativePlainText: null,
    features: [],
    escrowSplit: {
      developerPercentage: 85,
      brokerPercentage: 10,
      platformPercentage: 5,
    },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager.create.mockImplementation((_: unknown, data: unknown) => data);
    mockManager.save.mockImplementation(async (...args: unknown[]) => {
      if (args.length === 2) {
        return args[1];
      }
      return args[0];
    });
    mockManager.findOne.mockImplementation(async () => null);
    mockManager.find.mockImplementation(async () => []);
    mockManager.update.mockImplementation(async () => undefined);
    mockManager.delete.mockImplementation(async () => undefined);

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    } as unknown as QueryRunner;

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === EscrowEntity) {
          return mockEscrowReadRepository;
        }
        return { find: jest.fn().mockResolvedValue([]) };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: getRepositoryToken(ContractEntity), useValue: mockContractsRepo },
        { provide: getRepositoryToken(ProjectEntity), useValue: mockProjectsRepo },
        { provide: getRepositoryToken(ProjectSpecEntity), useValue: mockProjectSpecsRepo },
        { provide: getRepositoryToken(ProjectRequestEntity), useValue: mockProjectRequestsRepo },
        {
          provide: getRepositoryToken(ProjectRequestProposalEntity),
          useValue: mockProjectRequestProposalsRepo,
        },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ContractArchiveStorageService, useValue: mockContractArchiveStorage },
        { provide: SigningCredentialsService, useValue: mockSigningCredentialsService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  describe('initializeProjectAndContract', () => {
    it('creates a SENT contract with frozen snapshot, content hash, and spec lock', async () => {
      const spec = {
        id: 'spec-uuid',
        requestId: 'request-uuid',
        title: 'Website Revamp',
        description: 'Scoped project',
        totalBudget: 1000,
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        lockedByContractId: null,
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.ALL_SIGNED,
        features: [],
        techStack: 'NestJS, React',
        richContentJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Delivery assumptions' }],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Broker provides staging access.' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        milestones: [
          {
            id: 'spec-m1',
            title: 'Milestone 1',
            description: 'Kickoff',
            amount: 300,
            startDate: '2026-03-01T00:00:00.000Z',
            dueDate: '2026-03-10T00:00:00.000Z',
            sortOrder: 1,
            deliverableType: DeliverableType.DESIGN_PROTOTYPE,
            retentionAmount: 0,
            acceptanceCriteria: ['Approved wireframes'],
          },
          {
            id: 'spec-m2',
            title: 'Milestone 2',
            description: 'Build',
            amount: 700,
            startDate: '2026-03-11T00:00:00.000Z',
            dueDate: '2026-04-01T00:00:00.000Z',
            sortOrder: 2,
            deliverableType: DeliverableType.SOURCE_CODE,
            retentionAmount: 50,
            acceptanceCriteria: ['All features completed'],
          },
        ],
      } as unknown as ProjectSpecEntity;
      const request = {
        id: spec.requestId,
        brokerId: 'broker-uuid',
        clientId: 'client-uuid',
      } as ProjectRequestEntity;

      mockManager.findOne.mockImplementation(
        async (entity: unknown, options?: { where?: { id?: string } }) => {
          if (entity === ProjectSpecEntity && options?.where?.id === spec.id) return spec;
          if (entity === ProjectRequestEntity && options?.where?.id === request.id) return request;
          if (entity === ContractEntity) return null;
          return null;
        },
      );
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === MilestoneEntity) {
          return spec.milestones;
        }
        return [];
      });
      mockProjectRequestProposalsRepo.find.mockResolvedValue([
        {
          freelancerId: 'freelancer-uuid',
          status: 'ACCEPTED',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ]);
      mockManager.save.mockImplementation(async (...args: unknown[]) => {
        if (args.length === 1) {
          const entity = args[0] as Record<string, unknown>;
          if ('projectId' in entity) {
            return { id: 'contract-uuid', ...entity };
          }
          return { id: 'project-uuid', ...entity };
        }
        return args[1];
      });
      mockContractsRepo.findOne.mockResolvedValue({
        id: 'contract-uuid',
        projectId: 'project-uuid',
        sourceSpecId: spec.id,
        title: spec.title,
        status: ContractStatus.SENT,
        contractUrl: 'contracts/project-uuid.pdf',
        project: {
          ...buildProject({
            client: { id: 'client-uuid', fullName: 'Client', email: 'client@example.com' } as any,
            broker: { id: 'broker-uuid', fullName: 'Broker', email: 'broker@example.com' } as any,
            freelancer: {
              id: 'freelancer-uuid',
              fullName: 'Freelancer',
              email: 'freelancer@example.com',
            } as any,
            request: { specs: [spec] } as any,
          }),
        },
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(buildProject(), {
          scopeNarrativeRichContent: spec.richContentJson,
          scopeNarrativePlainText: 'Delivery assumptions\nBroker provides staging access.',
        }),
        termsContent: 'Detailed Scope Notes\nBroker provides staging access.',
        signatures: [],
        contentHash: null,
      });

      const result = await service.initializeProjectAndContract(brokerUser, spec.id);

      expect(result.status).toBe(ContractStatus.SENT);
      expect(result.milestoneSnapshot).toHaveLength(2);
      expect(result.contentHash).toBeTruthy();
      expect(result.contractUrl).toMatch(/\/contracts\/contract-uuid\/pdf$/);
      expect(result.contentHash).toBe((service as any).computeContentHash(result));
      expect(result.commercialContext).toEqual(
        expect.objectContaining({
          sourceSpecId: spec.id,
          totalBudget: 1000,
          brokerId: 'broker-uuid',
          clientId: 'client-uuid',
          freelancerId: 'freelancer-uuid',
          scopeNarrativeRichContent: spec.richContentJson,
          scopeNarrativePlainText: expect.stringContaining('Delivery assumptions'),
        }),
      );
      expect(result.termsContent).toContain('Detailed Scope Notes');
      expect(result.termsContent).toContain('Broker provides staging access.');
      expect(mockManager.save).toHaveBeenCalledWith(
        ProjectSpecEntity,
        expect.objectContaining({
          lockedByContractId: 'contract-uuid',
        }),
      );
    });

    it('rejects initialization when the spec does not exist', async () => {
      await expect(service.initializeProjectAndContract(brokerUser, 'missing-spec')).rejects.toThrow(
        'Spec not found',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('rejects initialization when the spec is already locked by another contract', async () => {
      const spec = {
        id: 'spec-locked',
        requestId: 'request-locked',
        lockedByContractId: 'contract-existing',
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.ALL_SIGNED,
      } as ProjectSpecEntity;
      const request = {
        id: 'request-locked',
        brokerId: brokerUser.id,
        clientId: 'client-uuid',
      } as ProjectRequestEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: { where?: { id?: string } }) => {
        if (entity === ProjectSpecEntity && options?.where?.id === spec.id) return spec;
        if (entity === ProjectRequestEntity && options?.where?.id === request.id) return request;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await expect(service.initializeProjectAndContract(brokerUser, spec.id)).rejects.toThrow(
        'This spec is already locked by an existing contract.',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects initialization when the caller is not the request broker', async () => {
      const spec = {
        id: 'spec-auth',
        requestId: 'request-auth',
        lockedByContractId: null,
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.ALL_SIGNED,
      } as ProjectSpecEntity;
      const request = {
        id: 'request-auth',
        brokerId: 'other-broker',
        clientId: 'client-uuid',
      } as ProjectRequestEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: { where?: { id?: string } }) => {
        if (entity === ProjectSpecEntity && options?.where?.id === spec.id) return spec;
        if (entity === ProjectRequestEntity && options?.where?.id === request.id) return request;
        if (entity === ContractEntity) return null;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await expect(service.initializeProjectAndContract(brokerUser, spec.id)).rejects.toThrow(
        'Only Broker can initialize contract',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects phased-flow initialization when no accepted freelancer can be resolved', async () => {
      const spec = {
        id: 'spec-no-freelancer',
        requestId: 'request-no-freelancer',
        lockedByContractId: null,
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.ALL_SIGNED,
      } as ProjectSpecEntity;
      const request = {
        id: 'request-no-freelancer',
        brokerId: brokerUser.id,
        clientId: 'client-uuid',
      } as ProjectRequestEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: { where?: { id?: string } }) => {
        if (entity === ProjectSpecEntity && options?.where?.id === spec.id) return spec;
        if (entity === ProjectRequestEntity && options?.where?.id === request.id) return request;
        if (entity === ContractEntity) return null;
        return null;
      });
      mockManager.find.mockResolvedValue([]);
      mockProjectRequestProposalsRepo.find.mockResolvedValue([]);

      await expect(service.initializeProjectAndContract(brokerUser, spec.id)).rejects.toThrow(
        'Cannot initialize contract: no accepted freelancer found for this request.',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('listByUser', () => {
    it('applies the archived-status filter and maps active contract summaries', async () => {
      const createdAt = new Date('2026-03-02T00:00:00.000Z');
      const activatedAt = new Date('2026-03-03T00:00:00.000Z');
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'contract-active',
            projectId: 'project-uuid',
            activatedAt,
            title: 'Website Revamp',
            status: ContractStatus.SENT,
            legalSignatureStatus: 'NOT_STARTED',
            provider: null,
            verifiedAt: null,
            certificateSerial: null,
            createdAt,
            project: {
              requestId: 'request-uuid',
              status: ProjectStatus.INITIALIZING,
              title: 'Website Revamp',
              client: { fullName: 'Client Name' },
              freelancer: { fullName: 'Freelancer Name' },
            },
          },
        ]),
      };
      mockContractsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.listByUser('client-uuid');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'contract.status <> :archivedStatus',
        { archivedStatus: ContractStatus.ARCHIVED },
      );
      expect(result).toEqual([
        {
          id: 'contract-active',
          projectId: 'project-uuid',
          requestId: 'request-uuid',
          activatedAt,
          projectStatus: ProjectStatus.INITIALIZING,
          projectTitle: 'Website Revamp',
          title: 'Website Revamp',
          status: ContractStatus.SENT,
          legalSignatureStatus: 'NOT_STARTED',
          provider: null,
          verifiedAt: null,
          certificateSerial: null,
          createdAt,
          clientName: 'Client Name',
          freelancerName: 'Freelancer Name',
        },
      ]);
    });

    it('includes accepted supervising staff in the participant visibility brackets', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockContractsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.listByUser('staff-uuid');

      const staffVisibilityBrackets = queryBuilder.where.mock.calls[0][0];
      const nestedQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
      };

      staffVisibilityBrackets.whereFactory(nestedQueryBuilder);

      expect(nestedQueryBuilder.orWhere).toHaveBeenCalledWith(
        'project.staffId = :userId AND project.staffInviteStatus = :acceptedInviteStatus',
        {
          userId: 'staff-uuid',
          acceptedInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
        },
      );
    });
  });

  describe('findOneForUser', () => {
    it('allows accepted supervising staff to view contract detail', async () => {
      const project = buildProject({
        staffId: 'staff-uuid',
        staffInviteStatus: ProjectStaffInviteStatus.ACCEPTED,
        client: { id: 'client-uuid', fullName: 'Client', email: 'client@example.com' } as any,
        broker: { id: 'broker-uuid', fullName: 'Broker', email: 'broker@example.com' } as any,
        freelancer: {
          id: 'freelancer-uuid',
          fullName: 'Freelancer',
          email: 'freelancer@example.com',
        } as any,
        request: { specs: [] } as any,
      });
      const contract = {
        id: 'contract-staff',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        title: 'Website Revamp',
        status: ContractStatus.SENT,
        contractUrl: 'contracts/project-uuid.pdf',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
        signatures: [{ id: 'signature-1' }],
        contentHash: null,
      } as unknown as ContractEntity;

      mockContractsRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOneForUser(
        { id: 'staff-uuid', role: UserRole.STAFF } as UserEntity,
        contract.id,
      );

      expect(result.id).toBe(contract.id);
      expect((result as any).requiredSignerCount).toBe(3);
      expect((result as any).signedCount).toBe(1);
    });

    it('rejects viewers outside the contract parties and accepted staff', async () => {
      const project = buildProject({
        client: { id: 'client-uuid', fullName: 'Client', email: 'client@example.com' } as any,
        broker: { id: 'broker-uuid', fullName: 'Broker', email: 'broker@example.com' } as any,
        freelancer: {
          id: 'freelancer-uuid',
          fullName: 'Freelancer',
          email: 'freelancer@example.com',
        } as any,
        request: { specs: [] } as any,
      });
      const contract = {
        id: 'contract-private',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        title: 'Website Revamp',
        status: ContractStatus.SENT,
        contractUrl: 'contracts/project-uuid.pdf',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
        signatures: [],
        contentHash: null,
      } as unknown as ContractEntity;

      mockContractsRepo.findOne.mockResolvedValue(contract);

      await expect(
        service.findOneForUser(
          { id: 'outsider-uuid', role: UserRole.CLIENT } as UserEntity,
          contract.id,
        ),
      ).rejects.toThrow('You are not allowed to view this contract');
    });

    it('self-heals a stale stored contentHash before returning contract detail', async () => {
      const project = buildProject({
        client: { id: 'client-uuid', fullName: 'Client', email: 'client@example.com' } as any,
        broker: { id: 'broker-uuid', fullName: 'Broker', email: 'broker@example.com' } as any,
        freelancer: {
          id: 'freelancer-uuid',
          fullName: 'Freelancer',
          email: 'freelancer@example.com',
        } as any,
        request: { specs: [] } as any,
      });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        title: 'Website Revamp',
        status: ContractStatus.SENT,
        contractUrl: 'contracts/project-uuid.pdf',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
        signatures: [],
        contentHash: 'stale-hash',
      } as ContractEntity;

      mockContractsRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOneForUser({ id: 'broker-uuid' } as UserEntity, contract.id);

      expect(result.contentHash).toBe((service as any).computeContentHash(contract));
      expect(result.contractUrl).toMatch(/\/contracts\/contract-uuid\/pdf$/);
      expect(mockContractsRepo.update).toHaveBeenCalledWith(
        contract.id,
        expect.objectContaining({
          contentHash: result.contentHash,
          contractUrl: result.contractUrl,
        }),
      );
    });
  });

  describe('updateDraft', () => {
    it('rebuilds draft commercial terms, resets signature progress, and recomputes contentHash', async () => {
      const project = buildProject({ currency: 'USD' });
      const updatedSnapshot = buildSnapshot().map((item, index) => ({
        ...item,
        amount: index === 0 ? 350 : item.amount,
        title: index === 0 ? 'Discovery' : item.title,
      }));
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.DRAFT,
        activatedAt: null,
        provider: 'VN_CA_SANDBOX',
        legalSignatureStatus: 'VERIFIED',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Old terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) return [];
        return [];
      });
      jest.spyOn(service, 'findOneForUser').mockResolvedValue({
        ...contract,
        title: 'Updated contract title',
        contentHash: 'recomputed-hash',
      } as ContractEntity);

      const result = await service.updateDraft(brokerUser, contract.id, {
        title: 'Updated contract title',
        currency: 'EUR',
        milestoneSnapshot: updatedSnapshot as any,
      });

      expect(mockManager.save).toHaveBeenCalledWith(
        ProjectEntity,
        expect.objectContaining({
          currency: 'EUR',
          totalBudget: 1050,
        }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        ContractEntity,
        expect.objectContaining({
          title: 'Updated contract title',
          provider: null,
          contentHash: expect.any(String),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          title: 'Updated contract title',
          contentHash: 'recomputed-hash',
        }),
      );
    });

    it('rejects draft updates when the contract is no longer in DRAFT status', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });

      await expect(
        service.updateDraft(brokerUser, contract.id, {
          title: 'Updated contract title',
        } as any),
      ).rejects.toThrow('Only DRAFT contracts can be edited.');
    });

    it('rejects draft edits after signing has started', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.DRAFT,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) {
          return [{ contractId: contract.id, userId: 'client-uuid' }];
        }
        return [];
      });

      await expect(
        service.updateDraft(brokerUser, contract.id, {
          title: 'Updated contract title',
        } as any),
      ).rejects.toThrow('Contract draft can no longer be edited after signing starts.');
    });
  });

  describe('sendDraft', () => {
    it('moves a valid draft to SENT without changing content hash semantics', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.DRAFT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Draft terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockResolvedValue([]);
      jest.spyOn(service, 'findOneForUser').mockResolvedValue({
        ...contract,
        contentHash: 'hashed-content',
      } as ContractEntity);

      await service.sendDraft(brokerUser, contract.id);

      expect(mockManager.save).toHaveBeenCalledWith(
        ContractEntity,
        expect.objectContaining({
          status: ContractStatus.SENT,
          contentHash: expect.any(String),
        }),
      );
    });
  });

  describe('signContract', () => {
    it('rejects blank contentHash before opening a transaction', async () => {
      await expect(
        service.signContract(
          brokerUser,
          'contract-uuid',
          '   ',
          {
            headers: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('jest-agent'),
          } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('changes the signable content hash when the frozen narrative changes', () => {
      const project = buildProject();
      const baseContract = {
        id: 'contract-uuid',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        title: 'Website Revamp',
        termsContent: 'Terms',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project, {
          scopeNarrativeRichContent: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Initial narrative copy.' }],
              },
            ],
          },
          scopeNarrativePlainText: 'Initial narrative copy.',
        }),
      } as ContractEntity;

      const revisedContract = {
        ...baseContract,
        commercialContext: buildCommercialContext(project, {
          scopeNarrativeRichContent: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Revised narrative copy.' }],
              },
            ],
          },
          scopeNarrativePlainText: 'Revised narrative copy.',
        }),
      } as ContractEntity;

      expect((service as any).computeContentHash(baseContract)).not.toBe(
        (service as any).computeContentHash(revisedContract),
      );
    });

    it('rejects users who are not contract parties', async () => {
      const outsiderUser = {
        id: 'outsider-uuid',
        role: UserRole.CLIENT,
      } as UserEntity;
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });

      await expect(
        service.signContract(
          outsiderUser,
          contract.id,
          contract.contentHash,
          {
            headers: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('jest-agent'),
          } as any,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('rejects signing when the contract is not in SENT status', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.DRAFT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });

      await expect(
        service.signContract(
          brokerUser,
          contract.id,
          contract.contentHash,
          {
            headers: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('jest-agent'),
          } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('rejects stale contentHash values', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });

      await expect(
        service.signContract(brokerUser, contract.id, 'stale-hash', '123456', {
          headers: {},
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('jest-agent'),
        } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects users who already signed the contract', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === brokerUser.id) {
          return {
            contractId: contract.id,
            userId: brokerUser.id,
          };
        }
        return null;
      });

      await expect(
        service.signContract(
          brokerUser,
          contract.id,
          contract.contentHash,
          {
            headers: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('jest-agent'),
          } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('maps signature unique key conflicts to a duplicate-sign error', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === brokerUser.id) {
          return null;
        }
        return null;
      });
      mockManager.save.mockImplementation(async (...args: unknown[]) => {
        if (args[0] === DigitalSignatureEntity) {
          const error = Object.assign(new Error('duplicate'), { code: '23505' });
          throw error;
        }
        if (args.length === 2) {
          return args[1];
        }
        return args[0];
      });

      await expect(
        service.signContract(
          brokerUser,
          contract.id,
          contract.contentHash,
          {
            headers: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('jest-agent'),
          } as any,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('returns Pending Signatures when required signers are still missing', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === brokerUser.id) {
          return null;
        }
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) {
          return [
            {
              contractId: contract.id,
              userId: 'client-uuid',
              signedAt: new Date('2026-03-10T10:00:00.000Z'),
            },
            {
              contractId: contract.id,
              userId: 'broker-uuid',
              signedAt: new Date('2026-03-10T10:05:00.000Z'),
            },
          ];
        }
        return [];
      });

      const result = await service.signContract(
        brokerUser,
        contract.id,
        contract.contentHash,
        {
          headers: {},
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('jest-agent'),
        } as any,
      );

      expect(result).toEqual({
        status: 'Pending Signatures',
        signaturesCount: 2,
        requiredSignerCount: 3,
        allRequiredSigned: false,
        archivePersisted: false,
      });
      expect(
        mockManager.save.mock.calls.some(([entity]) => entity === ContractEntity),
      ).toBe(false);
      expect(mockAuditLogsService.log).not.toHaveBeenCalled();
    });

    it('hydrates legacy contract data before signing and records forwarded client metadata', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: [],
        commercialContext: null,
        termsContent: 'Terms',
      } as ContractEntity;
      const hydratedSnapshot = buildSnapshot();
      const hydratedContext = buildCommercialContext(project);
      contract.milestoneSnapshot = hydratedSnapshot;
      contract.commercialContext = hydratedContext;
      const expectedHash = (service as any).computeContentHash(contract);
      contract.milestoneSnapshot = [];
      contract.commercialContext = null;

      const hydrateSpy = jest
        .spyOn<any, any>(service as any, 'hydrateSnapshotFromLegacySpec')
        .mockImplementation(async (_queryRunner: QueryRunner, targetContract: ContractEntity) => {
          targetContract.milestoneSnapshot = hydratedSnapshot;
          targetContract.commercialContext = hydratedContext;
          targetContract.contentHash = expectedHash;
          return hydratedSnapshot;
        });

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === brokerUser.id) {
          return null;
        }
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) {
          return [
            {
              contractId: contract.id,
              userId: 'client-uuid',
              signedAt: new Date('2026-03-10T10:00:00.000Z'),
            },
            {
              contractId: contract.id,
              userId: brokerUser.id,
              signedAt: new Date('2026-03-10T10:05:00.000Z'),
            },
          ];
        }
        return [];
      });

      const result = await service.signContract(
        brokerUser,
        contract.id,
        expectedHash,
        {
          headers: {
            'x-forwarded-for': '203.0.113.10, 10.0.0.1',
          },
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('jest-agent'),
        } as any,
      );

      expect(hydrateSpy).toHaveBeenCalled();
      expect(result.status).toBe('Pending Signatures');
      expect(result.allRequiredSigned).toBe(false);
      expect(mockManager.save).toHaveBeenCalledWith(
        DigitalSignatureEntity,
        expect.objectContaining({
          contractId: contract.id,
          userId: brokerUser.id,
          ipAddress: '203.0.113.10',
          userAgent: 'jest-agent',
          provider: 'INTERDEV_AUDIT',
          legalStatus: 'AUDIT_RECORDED',
        }),
      );
      expect(mockNotificationsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Contract signing updated',
          }),
        ]),
      );
    });

    it('marks the contract SIGNED when the last required party signs and does not activate it', async () => {
      const project = buildProject({ freelancerId: null });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project, { freelancerId: null }),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === brokerUser.id) {
          return null;
        }
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) {
          return [
            {
              contractId: contract.id,
              userId: 'client-uuid',
              signedAt: new Date('2026-03-10T10:00:00.000Z'),
            },
            {
              contractId: contract.id,
              userId: 'broker-uuid',
              signedAt: new Date('2026-03-10T10:05:00.000Z'),
            },
          ];
        }
        return [];
      });
      jest
        .spyOn<any, any>(service as any, 'persistSignedContractArchiveIfPossible')
        .mockResolvedValue(true);

      const result = await service.signContract(
        brokerUser,
        contract.id,
        contract.contentHash,
        '123456',
        {
          headers: {},
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('jest-agent'),
        } as any,
      );

      expect(result.allRequiredSigned).toBe(true);
      expect(result.archivePersisted).toBe(true);
      expect(mockManager.save).toHaveBeenCalledWith(
        DigitalSignatureEntity,
        expect.objectContaining({
          contractId: contract.id,
          userId: brokerUser.id,
          signerRole: 'BROKER',
          contentHash: contract.contentHash,
          userAgent: 'jest-agent',
        }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        ContractEntity,
        expect.objectContaining({
          status: ContractStatus.SIGNED,
          activatedAt: null,
        }),
      );
      expect(mockAuditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: brokerUser.id,
          action: 'CONTRACT_FULLY_SIGNED',
          entityType: 'Contract',
          entityId: contract.id,
          newData: {
            status: ContractStatus.SIGNED,
          },
        }),
      );
      expect(mockNotificationsService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Contract fully signed',
          }),
        ]),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'contract.updated',
        expect.objectContaining({
          userId: brokerUser.id,
          contractId: contract.id,
          projectId: contract.projectId,
        }),
      );
    });

    it('keeps signing successful when archive persistence is unavailable', async () => {
      const project = buildProject({ freelancerId: null });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project, { freelancerId: null }),
        termsContent: 'Terms',
      } as ContractEntity;
      contract.contentHash = (service as any).computeContentHash(contract);

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === brokerUser.id) {
          return null;
        }
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) {
          return [
            {
              contractId: contract.id,
              userId: 'client-uuid',
              signedAt: new Date('2026-03-10T10:00:00.000Z'),
            },
            {
              contractId: contract.id,
              userId: 'broker-uuid',
              signedAt: new Date('2026-03-10T10:05:00.000Z'),
            },
          ];
        }
        return [];
      });
      jest
        .spyOn<any, any>(service as any, 'persistSignedContractArchiveIfPossible')
        .mockResolvedValue(false);

      const result = await service.signContract(
        brokerUser,
        contract.id,
        contract.contentHash,
        '123456',
        {
          headers: {},
          ip: '127.0.0.1',
          get: jest.fn().mockReturnValue('jest-agent'),
        } as any,
      );

      expect(result.allRequiredSigned).toBe(true);
      expect(result.archivePersisted).toBe(false);
    });
  });

  describe('generatePdfForUser', () => {
    it('streams the archived artifact when one is available', async () => {
      const archivedBuffer = Buffer.from('archived-contract-pdf');
      const contract = {
        id: 'contract-uuid',
        status: ContractStatus.SIGNED,
        archiveStoragePath: 'contracts/contract-uuid/archive-hash.pdf',
        archiveDocumentHash: 'archive-hash',
      } as ContractEntity;

      jest.spyOn(service, 'findOneForUser').mockResolvedValue(contract as any);
      mockContractArchiveStorage.downloadPdfArtifact.mockResolvedValue(archivedBuffer);

      const dynamicPdfSpy = jest
        .spyOn<any, any>(service as any, 'buildPdfBufferForContract')
        .mockResolvedValue(Buffer.from('dynamic-pdf'));

      const result = await service.generatePdfForUser(brokerUser, contract.id);

      expect(result).toEqual(archivedBuffer);
      expect(mockContractArchiveStorage.downloadPdfArtifact).toHaveBeenCalledWith(
        contract.archiveStoragePath,
      );
      expect(dynamicPdfSpy).not.toHaveBeenCalled();
    });

    it('falls back to dynamic PDF rendering when archive storage is missing the object', async () => {
      const dynamicBuffer = Buffer.from('dynamic-contract-pdf');
      const contract = {
        id: 'contract-uuid',
        status: ContractStatus.ACTIVATED,
        archiveStoragePath: 'contracts/contract-uuid/archive-hash.pdf',
        archiveDocumentHash: 'archive-hash',
      } as ContractEntity;

      jest.spyOn(service, 'findOneForUser').mockResolvedValue(contract as any);
      mockContractArchiveStorage.downloadPdfArtifact.mockResolvedValue(null);

      jest
        .spyOn<any, any>(service as any, 'buildPdfBufferForContract')
        .mockResolvedValue(dynamicBuffer);

      const result = await service.generatePdfForUser(brokerUser, contract.id);

      expect(result).toEqual(dynamicBuffer);
    });
  });

  describe('discardDraft', () => {
    it('archives a pre-sign contract, cancels the shell project, and unlocks the matching spec', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SENT,
        project,
      } as ContractEntity;
      const spec = {
        id: 'spec-uuid',
        lockedByContractId: contract.id,
        lockedAt: new Date('2026-03-10T00:00:00.000Z'),
      } as ProjectSpecEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === ProjectSpecEntity && options?.where?.id === 'spec-uuid') return spec;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await service.discardDraft(brokerUser, contract.id);

      expect(mockManager.save).toHaveBeenCalledWith(
        ContractEntity,
        expect.objectContaining({ status: ContractStatus.ARCHIVED }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        ProjectEntity,
        expect.objectContaining({ status: ProjectStatus.CANCELED }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        ProjectSpecEntity,
        expect.objectContaining({
          lockedByContractId: null,
          lockedAt: null,
        }),
      );
    });
  });

  describe('activateProject', () => {
    it('activates from the frozen contract snapshot and creates runtime milestones plus escrows', async () => {
      const project = buildProject();
      const snapshot = buildSnapshot();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SIGNED,
        legalSignatureStatus: 'VERIFIED',
        activatedAt: null,
        project,
        milestoneSnapshot: snapshot,
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === ProjectSpecEntity) {
          throw new Error('Activation should not resolve live spec when snapshot exists');
        }
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === MilestoneEntity) return [];
        if (entity === DigitalSignatureEntity) {
          return [
            { contractId: contract.id, userId: 'client-uuid' },
            { contractId: contract.id, userId: 'broker-uuid' },
            { contractId: contract.id, userId: 'freelancer-uuid' },
          ];
        }
        if (entity === EscrowEntity) return [];
        return [];
      });
      mockManager.save.mockImplementation(async (...args: unknown[]) => {
        if (args.length === 2 && args[0] === MilestoneEntity) {
          return (args[1] as MilestoneEntity[]).map((milestone, index) => ({
            id: `runtime-milestone-${index + 1}`,
            ...milestone,
          }));
        }
        if (args.length === 2) {
          return args[1];
        }
        return args[0];
      });

      const result = await service.activateProject(brokerUser, contract.id);

      expect(result.alreadyActivated).toBe(false);
      expect(mockManager.save).toHaveBeenCalledWith(
        MilestoneEntity,
        expect.arrayContaining([
          expect.objectContaining({
            sourceContractMilestoneKey: 'cmk-1',
            title: 'Milestone 1',
            amount: 300,
            status: MilestoneStatus.PENDING,
          }),
        ]),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        EscrowEntity,
        expect.arrayContaining([
          expect.objectContaining({
            totalAmount: 300,
            currency: 'USD',
          }),
        ]),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        ContractEntity,
        expect.objectContaining({ status: ContractStatus.ACTIVATED }),
      );
      expect(mockManager.save).toHaveBeenCalledWith(
        ProjectEntity,
        expect.objectContaining({ status: ProjectStatus.IN_PROGRESS }),
      );
    });

    it('fails fast when a stale project milestone set no longer matches the contract snapshot', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        sourceSpecId: 'spec-uuid',
        status: ContractStatus.SIGNED,
        legalSignatureStatus: 'VERIFIED',
        activatedAt: null,
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === MilestoneEntity) {
          return [
            {
              id: 'runtime-m1',
              projectId: project.id,
              title: 'Tampered title',
              description: 'Kickoff',
              amount: 300,
              deliverableType: DeliverableType.DESIGN_PROTOTYPE,
              retentionAmount: 0,
              acceptanceCriteria: ['Approved wireframes'],
              sortOrder: 1,
              startDate: new Date('2026-03-01T00:00:00.000Z'),
              dueDate: new Date('2026-03-10T00:00:00.000Z'),
            },
          ];
        }
        if (entity === DigitalSignatureEntity) {
          return [
            { contractId: contract.id, userId: 'client-uuid' },
            { contractId: contract.id, userId: 'broker-uuid' },
            { contractId: contract.id, userId: 'freelancer-uuid' },
          ];
        }
        if (entity === EscrowEntity) return [];
        return [];
      });

      await expect(service.activateProject(brokerUser, contract.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('draft guardrails', () => {
    it('rejects draft updates that try to change the frozen project budget baseline', async () => {
      const project = buildProject({ totalBudget: 1000 });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        status: ContractStatus.DRAFT,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Draft terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await expect(
        service.updateDraft(brokerUser, contract.id, {
          milestoneSnapshot: [
            {
              title: 'Milestone 1',
              amount: 300,
              sortOrder: 1,
              deliverableType: DeliverableType.DESIGN_PROTOTYPE,
              retentionAmount: 0,
            },
            {
              title: 'Milestone 2',
              amount: 800,
              sortOrder: 2,
              deliverableType: DeliverableType.SOURCE_CODE,
              retentionAmount: 50,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects draft updates when first milestone exceeds 30% of total budget', async () => {
      const project = buildProject({ totalBudget: 1000 });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        status: ContractStatus.DRAFT,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Draft terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await expect(
        service.updateDraft(brokerUser, contract.id, {
          milestoneSnapshot: [
            {
              title: 'Milestone 1',
              amount: 400,
              sortOrder: 1,
              deliverableType: DeliverableType.DESIGN_PROTOTYPE,
              retentionAmount: 40,
            },
            {
              title: 'Milestone 2',
              amount: 600,
              sortOrder: 2,
              deliverableType: DeliverableType.SOURCE_CODE,
              retentionAmount: 60,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects draft updates when retention exceeds 10% cap for a milestone', async () => {
      const project = buildProject({ totalBudget: 1000 });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        status: ContractStatus.DRAFT,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Draft terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await expect(
        service.updateDraft(brokerUser, contract.id, {
          milestoneSnapshot: [
            {
              title: 'Milestone 1',
              amount: 300,
              sortOrder: 1,
              deliverableType: DeliverableType.DESIGN_PROTOTYPE,
              retentionAmount: 31,
            },
            {
              title: 'Milestone 2',
              amount: 700,
              sortOrder: 2,
              deliverableType: DeliverableType.SOURCE_CODE,
              retentionAmount: 70,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects draft updates when a milestone starts on or before the previous due date', async () => {
      const project = buildProject({ totalBudget: 1000 });
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        status: ContractStatus.DRAFT,
        title: 'Website Revamp',
        sourceSpecId: 'spec-uuid',
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Draft terms',
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });
      mockManager.find.mockResolvedValue([]);

      await expect(
        service.updateDraft(brokerUser, contract.id, {
          milestoneSnapshot: [
            {
              title: 'Milestone 1',
              amount: 300,
              sortOrder: 1,
              deliverableType: DeliverableType.DESIGN_PROTOTYPE,
              retentionAmount: 30,
              startDate: '2026-03-01',
              dueDate: '2026-03-10',
            },
            {
              title: 'Milestone 2',
              amount: 700,
              sortOrder: 2,
              deliverableType: DeliverableType.SOURCE_CODE,
              retentionAmount: 70,
              startDate: '2026-03-10',
              dueDate: '2026-04-01',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects sending a non-draft contract', async () => {
      const project = buildProject();
      const contract = {
        id: 'contract-uuid',
        projectId: project.id,
        status: ContractStatus.SENT,
        project,
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });

      await expect(service.sendDraft(brokerUser, contract.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
