import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractEntity, ContractStatus } from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
} from '../../database/entities/project-spec.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { DeliverableType, MilestoneEntity } from '../../database/entities/milestone.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { DigitalSignatureEntity } from '../../database/entities/digital-signature.entity';

describe('ContractsService', () => {
  let service: ContractsService;
  let queryRunner: QueryRunner;

  const mockContractsRepo = { findOne: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn() };
  const mockProjectsRepo = { save: jest.fn() };
  const mockProjectSpecsRepo = { findOne: jest.fn() };
  const mockProjectRequestsRepo = { findOne: jest.fn() };
  const mockProjectRequestProposalsRepo = { findOne: jest.fn(), find: jest.fn() };
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
  };

  const mockUser: UserEntity = {
    id: 'broker-uuid',
    role: UserRole.BROKER,
  } as UserEntity;

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
    it('generates contract terms with features and milestones', async () => {
      const mockSpec = {
        id: 'spec-id',
        requestId: 'request-id',
        title: 'Governance Project',
        description: 'Desc',
        totalBudget: 1000,
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.APPROVED,
        request: { brokerId: 'broker-uuid', clientId: 'client-uuid' },
        features: [
          {
            title: 'Login',
            description: 'SSO',
            complexity: 'LOW',
            acceptanceCriteria: ['Must support Google Auth'],
          },
        ],
        milestones: [
          {
            title: 'M1',
            amount: 300,
            sortOrder: 1,
            deliverableType: DeliverableType.DESIGN_PROTOTYPE,
            retentionAmount: 0,
          },
        ],
        techStack: 'NodeJS, React',
      } as ProjectSpecEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ProjectSpecEntity) return mockSpec;
        if (entity === ContractEntity) return null;
        return null;
      });
      mockProjectRequestProposalsRepo.find.mockResolvedValue([
        {
          id: 'proposal-id',
          requestId: 'request-id',
          freelancerId: 'freelancer-uuid',
          status: 'ACCEPTED',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      mockManager.save.mockImplementation(async (...args: unknown[]) => {
        if (args.length === 1) {
          const entity = args[0] as Record<string, unknown>;
          if ('projectId' in entity) return { id: 'contract-id', ...entity };
          return { id: 'project-id', ...entity };
        }
        return args[1];
      });

      await service.initializeProjectAndContract(mockUser, 'spec-id');

      const contractCall = mockManager.create.mock.calls.find((call) => call[0] === ContractEntity);
      const contractData = contractCall?.[1] as Record<string, string>;

      expect(contractData.termsContent).toContain('Governance Project');
      expect(contractData.termsContent).toContain('Must support Google Auth');
      expect(contractData.termsContent).toContain('NodeJS, React');
      expect(contractData.termsContent).toContain(DeliverableType.DESIGN_PROTOTYPE);
      expect(contractData.status).toBe(ContractStatus.DRAFT);
    });
  });

  describe('signContract', () => {
    it('marks the contract SIGNED without auto-activation when the last signer signs', async () => {
      const project = {
        id: 'project-id',
        clientId: 'client-uuid',
        brokerId: 'broker-uuid',
        freelancerId: null,
      } as ProjectEntity;
      const contract = {
        id: 'contract-id',
        projectId: project.id,
        status: ContractStatus.DRAFT,
        activatedAt: null,
        milestoneSnapshot: null,
        project,
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown, options?: any) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === DigitalSignatureEntity && options?.where?.userId === 'broker-uuid') {
          return null;
        }
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === DigitalSignatureEntity) {
          return [
            {
              contractId: 'contract-id',
              userId: 'client-uuid',
              signatureHash: 'sig-client',
              signedAt: new Date('2026-03-03T00:00:00.000Z'),
            },
            {
              contractId: 'contract-id',
              userId: 'broker-uuid',
              signatureHash: 'sig-broker',
              signedAt: new Date('2026-03-03T00:05:00.000Z'),
            },
          ];
        }
        return [];
      });

      const result = await service.signContract(mockUser, 'contract-id', 'sig-broker');

      expect(result.allRequiredSigned).toBe(true);
      expect(mockManager.save).toHaveBeenCalledWith(
        ContractEntity,
        expect.objectContaining({ status: ContractStatus.SIGNED }),
      );
      expect(mockManager.update).not.toHaveBeenCalled();
    });
  });

  describe('activateProject', () => {
    it('rejects activation for users who are not contract parties', async () => {
      const outsider = { id: 'outsider-uuid' } as UserEntity;
      const project = {
        id: 'project-id',
        clientId: 'client-uuid',
        brokerId: 'broker-uuid',
        freelancerId: null,
      } as ProjectEntity;
      const contract = {
        id: 'contract-id',
        projectId: project.id,
        status: ContractStatus.SIGNED,
        activatedAt: null,
        milestoneSnapshot: null,
        project,
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        return null;
      });

      await expect(service.activateProject(outsider, 'contract-id')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('fails fast when the source spec cannot be resolved', async () => {
      const project = {
        id: 'project-id',
        requestId: 'request-id',
        clientId: 'client-uuid',
        brokerId: 'broker-uuid',
        freelancerId: null,
        totalBudget: 1000,
        status: ProjectStatus.INITIALIZING,
      } as ProjectEntity;
      const contract = {
        id: 'contract-id',
        projectId: project.id,
        sourceSpecId: 'spec-id',
        status: ContractStatus.SIGNED,
        activatedAt: null,
        milestoneSnapshot: null,
        project,
      } as ContractEntity;

      mockManager.findOne.mockImplementation(async (entity: unknown) => {
        if (entity === ContractEntity) return contract;
        if (entity === ProjectEntity) return project;
        if (entity === ProjectSpecEntity) return null;
        return null;
      });
      mockManager.find.mockImplementation(async (entity: unknown) => {
        if (entity === MilestoneEntity) return [];
        if (entity === DigitalSignatureEntity) {
          return [
            { contractId: 'contract-id', userId: 'client-uuid' },
            { contractId: 'contract-id', userId: 'broker-uuid' },
          ];
        }
        return [];
      });

      await expect(service.activateProject(mockUser, 'contract-id')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockManager.save).not.toHaveBeenCalledWith(
        ProjectEntity,
        expect.objectContaining({ status: ProjectStatus.IN_PROGRESS }),
      );
    });
  });
});
