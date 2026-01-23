import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSpecsService } from './project-specs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { DeliverableType } from '../../database/entities/milestone.entity';

describe('ProjectSpecsService', () => {
  let service: ProjectSpecsService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockProjectSpecsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockMilestonesRepo = {};
  const mockProjectRequestsRepo = {};
  const mockAuditLogsService = {
    log: jest.fn(),
  };

  const mockUser: UserEntity = {
    id: 'broker-uuid',
    role: UserRole.BROKER,
  } as UserEntity;

  beforeEach(async () => {
    // Mock QueryRunner
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      },
    } as unknown as QueryRunner;

    // Mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectSpecsService,
        { provide: getRepositoryToken(ProjectSpecEntity), useValue: mockProjectSpecsRepo },
        { provide: getRepositoryToken(MilestoneEntity), useValue: mockMilestonesRepo },
        { provide: getRepositoryToken(ProjectRequestEntity), useValue: mockProjectRequestsRepo },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ProjectSpecsService>(ProjectSpecsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSpec', () => {
    // Valid Budget Distribution: 30% - 50% - 20%
    const createDto: CreateProjectSpecDto = {
      requestId: 'request-uuid',
      title: 'Governance Compliant Spec',
      description: 'A robust system description',
      totalBudget: 1000,
      milestones: [
        {
          title: 'Design',
          description: 'UI/UX',
          amount: 300, // 30% (Max allowed for 1st)
          deliverableType: DeliverableType.DESIGN_PROTOTYPE,
          retentionAmount: 0,
          sortOrder: 1,
        },
        {
          title: 'Development',
          description: 'Backend',
          amount: 500, // 50%
          deliverableType: DeliverableType.SOURCE_CODE,
          retentionAmount: 0,
          sortOrder: 2,
        },
        {
          title: 'Deployment',
          description: 'Go Live',
          amount: 200, // 20% (Min allowed for Last)
          deliverableType: DeliverableType.DEPLOYMENT,
          retentionAmount: 200,
          sortOrder: 3,
        },
      ],
      features: [
        {
          title: 'Login',
          description: 'Secure login',
          complexity: 'LOW' as const,
          acceptanceCriteria: ['User can login with valid credentials (valid email)'],
        },
      ],
    };

    it('Scenario 1: Happy Path - Should successfully create spec with 0 warnings', async () => {
      // Mock Request found and owned by broker
      const mockRequest = {
        id: 'request-uuid',
        brokerId: 'broker-uuid',
        status: RequestStatus.PROCESSING, // or whatever status allows it
        broker: mockUser,
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      // Mock Save Spec
      const mockSavedSpec = {
        id: 'spec-uuid',
        ...createDto,
        status: ProjectSpecStatus.DRAFT,
      };
      (queryRunner.manager.create as jest.Mock).mockImplementation((entity, data) => data);
      (queryRunner.manager.save as jest.Mock).mockImplementation((entityOrEntities) => {
        if (Array.isArray(entityOrEntities)) return Promise.resolve(entityOrEntities); // Milestones
        if (entityOrEntities.requestId) return Promise.resolve(mockSavedSpec); // Spec
        return Promise.resolve(entityOrEntities); // Request update
      });

      // Mock findOne for return
      mockProjectSpecsRepo.findOne.mockResolvedValue(mockSavedSpec);

      const result = await service.createSpec(mockUser, createDto, {});

      // Verify Flow
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.spec).toBeDefined();
      expect(result.warnings).toHaveLength(0);
    });

    it('Scenario 2: Milestone Budget Violation - First Milestone > 30%', async () => {
      const mockRequest = { id: 'request-uuid', brokerId: 'broker-uuid' };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      const invalidDto = {
        ...createDto,
        milestones: [
          { ...createDto.milestones[0], amount: 350 }, // 35% -> ERROR
          { ...createDto.milestones[1], amount: 450 },
          { ...createDto.milestones[2], amount: 200 },
        ],
      };

      await expect(service.createSpec(mockUser, invalidDto, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSpec(mockUser, invalidDto, {})).rejects.toThrow(
        /First milestone cannot exceed 30%/,
      );
    });

    it('Scenario 3: Milestone Budget Violation - Last Milestone < 20%', async () => {
      const mockRequest = { id: 'request-uuid', brokerId: 'broker-uuid' };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      const invalidDto = {
        ...createDto,
        milestones: [
          { ...createDto.milestones[0], amount: 300 },
          { ...createDto.milestones[1], amount: 600 },
          { ...createDto.milestones[2], amount: 100 }, // 10% -> ERROR
        ],
      };

      await expect(service.createSpec(mockUser, invalidDto, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSpec(mockUser, invalidDto, {})).rejects.toThrow(
        /Final milestone must be at least 20%/,
      );
    });

    it('Scenario 4: Keyword Warnings', async () => {
      const mockRequest = {
        id: 'request-uuid',
        brokerId: 'broker-uuid',
        status: RequestStatus.PROCESSING,
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      const warningDto = {
        ...createDto,
        description: 'This is a beautiful and modern system.', // "beautiful", "modern" -> Warnings
      };

      // Mock Save Spec (need specific mocks again as beforeEach resets them but we need to ensure flow reaches end)
      const mockSavedSpec = { id: 'spec-uuid', ...warningDto };
      (queryRunner.manager.create as jest.Mock).mockImplementation((entity, data) => data);
      (queryRunner.manager.save as jest.Mock).mockResolvedValue(mockSavedSpec);
      mockProjectSpecsRepo.findOne.mockResolvedValue(mockSavedSpec);

      const result = await service.createSpec(mockUser, warningDto, {});

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('beautiful');
    });

    it('Scenario 5: Feature Validation - Short Criteria', async () => {
      const mockRequest = { id: 'request-uuid', brokerId: 'broker-uuid' };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      const invalidFeatureDto = {
        ...createDto,
        features: [
          {
            title: 'Bad Feature',
            description: 'Desc',
            complexity: 'LOW' as const,
            acceptanceCriteria: ['Short'], // < 10 chars -> ERROR
          },
        ],
      };

      await expect(service.createSpec(mockUser, invalidFeatureDto, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSpec(mockUser, invalidFeatureDto, {})).rejects.toThrow(
        /too short/,
      );
    });
  });
});
