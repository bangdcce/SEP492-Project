import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ContractsService } from './contracts.service';
import {
  ContractCommercialContext,
  ContractEntity,
  ContractStatus,
} from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
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

describe('ContractsService', () => {
  let service: ContractsService;
  let queryRunner: QueryRunner;

  const mockContractsRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockProjectsRepo = {};
  const mockProjectSpecsRepo = {};
  const mockProjectRequestsRepo = {};
  const mockProjectRequestProposalsRepo = { find: jest.fn() };
  const mockAuditLogsService = { log: jest.fn() };

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

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    } as unknown as QueryRunner;

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
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
        { provide: DataSource, useValue: mockDataSource },
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

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: { where?: { id?: string } }) => {
        if (entity === ProjectSpecEntity && options?.where?.id === spec.id) return spec;
        if (entity === ProjectRequestEntity && options?.where?.id === request.id) return request;
        if (entity === ContractEntity) return null;
        return null;
      });
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

      const result = await service.initializeProjectAndContract(brokerUser, spec.id);

      expect(result.status).toBe(ContractStatus.SENT);
      expect(result.milestoneSnapshot).toHaveLength(2);
      expect(result.contentHash).toBeTruthy();
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
  });

  describe('findOneForUser', () => {
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
        project,
        milestoneSnapshot: buildSnapshot(),
        commercialContext: buildCommercialContext(project),
        termsContent: 'Terms',
        signatures: [],
        contentHash: 'stale-hash',
      } as ContractEntity;

      mockContractsRepo.findOne.mockResolvedValue(contract);

      const result = await service.findOneForUser(
        { id: 'broker-uuid' } as UserEntity,
        contract.id,
      );

      expect(result.contentHash).toBe((service as any).computeContentHash(contract));
      expect(mockContractsRepo.update).toHaveBeenCalledWith(contract.id, {
        contentHash: result.contentHash,
      });
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
        service.signContract(
          brokerUser,
          contract.id,
          'stale-hash',
          {
            headers: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('jest-agent'),
          } as any,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
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

      expect(result.allRequiredSigned).toBe(true);
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
