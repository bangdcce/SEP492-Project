import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContractEntity } from '../../database/entities/contract.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource, QueryRunner } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { MilestoneEntity, DeliverableType } from '../../database/entities/milestone.entity';

describe('ContractsService', () => {
  let service: ContractsService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockContractsRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockProjectsRepo = { save: jest.fn() };
  const mockProjectSpecsRepo = { findOne: jest.fn() };
  const mockAuditLogsService = { log: jest.fn() };

  const mockUser: UserEntity = {
    id: 'broker-uuid',
    role: UserRole.BROKER,
  } as UserEntity;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
      },
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
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('initializeProjectAndContract', () => {
    it('Should generate contract terms with Features and Milestones', async () => {
      const mockSpec = {
        id: 'spec-id',
        title: 'Governance Project',
        description: 'Desc',
        totalBudget: 1000,
        status: ProjectSpecStatus.APPROVED,
        request: { brokerId: 'broker-uuid', clientId: 'client-uuid' },
        features: [
          {
             title: 'Login',
             description: 'SSO',
             complexity: 'LOW',
             acceptanceCriteria: ['Must support Google Auth']
          }
        ],
        milestones: [
          {
            title: 'M1',
            amount: 300,
            sortOrder: 1,
            deliverableType: DeliverableType.DESIGN_PROTOTYPE,
            retentionAmount: 0
          }
        ],
        techStack: 'NodeJS, React'
      };

      mockProjectSpecsRepo.findOne.mockResolvedValue(mockSpec);
      (queryRunner.manager.create as jest.Mock).mockImplementation((entity, data) => data);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue({ id: 'new-id' });

      await service.initializeProjectAndContract(mockUser, 'spec-id');

      // Verify Contract Terms Generation
      const contractCall = (queryRunner.manager.create as jest.Mock).mock.calls.find(call => call[0] === ContractEntity);
      const contractData = contractCall[1];

      expect(contractData.termsContent).toContain('Governance Project');
      expect(contractData.termsContent).toContain('Must support Google Auth'); // Feature AC
      expect(contractData.termsContent).toContain('NodeJS, React'); // Tech Stack
      expect(contractData.termsContent).toContain(DeliverableType.DESIGN_PROTOTYPE); // Milestone Type
    });
  });
});
