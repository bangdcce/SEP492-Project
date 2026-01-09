import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSpecsService } from './project-specs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectSpecEntity, ProjectSpecStatus } from '../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { ProjectRequestEntity, RequestStatus } from '../../database/entities/project-request.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';

describe('ProjectSpecsService', () => {
  let service: ProjectSpecsService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockProjectSpecsRepo = {
    findOne: jest.fn(),
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
    const createDto: CreateProjectSpecDto = {
      requestId: 'request-uuid',
      title: 'E-commerce System',
      description: 'Full stack',
      totalBudget: 1000,
      milestones: [
        { title: 'Phase 1', description: 'UI', amount: 300 },
        { title: 'Phase 2', description: 'Backend', amount: 700 },
      ],
    };

    it('Scenario 1: Happy Path - Should successfully create spec and milestones', async () => {
      // Mock Request found and owned by broker
      const mockRequest = {
        id: 'request-uuid',
        brokerId: 'broker-uuid',
        status: RequestStatus.PROCESSING,
        broker: mockUser,
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      // Mock Save Spec
      const mockSavedSpec = { id: 'spec-uuid', ...createDto, status: ProjectSpecStatus.PENDING_APPROVAL };
      (queryRunner.manager.create as jest.Mock).mockImplementation((entity, data) => data);
      (queryRunner.manager.save as jest.Mock).mockImplementation((entityOrEntities) => {
        if (Array.isArray(entityOrEntities)) return Promise.resolve(entityOrEntities); // Milestones
        if (entityOrEntities.title) return Promise.resolve(mockSavedSpec); // Spec
        return Promise.resolve(entityOrEntities); // Request update
      });
      
      // Mock findOne for return
      mockProjectSpecsRepo.findOne.mockResolvedValue(mockSavedSpec);

      const result = await service.createSpec(mockUser, createDto, {});

      // Verify Flow
      expect(dataSource.createQueryRunner).toHaveBeenCalled();
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      
      // Verify Validation Check
      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(ProjectRequestEntity, expect.any(Object));

      // Verify Saves
      expect(queryRunner.manager.save).toHaveBeenCalledTimes(3); // Spec, Milestones, Request

      // Verify Commit
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();

      // Verify Result
      expect(result).toEqual(mockSavedSpec);
    });

    it('Scenario 2: Validation Trap - Should throw BadRequest if budget mismatch', async () => {
       const mockRequest = {
        id: 'request-uuid',
        brokerId: 'broker-uuid',
        status: RequestStatus.PROCESSING,
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      // Create mismatch DTO
      const mismatchDto = { ...createDto, totalBudget: 2000 }; // Milestones sum is 1000

      await expect(service.createSpec(mockUser, mismatchDto, {}))
        .rejects
        .toThrow(BadRequestException);

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('Scenario 3: Transaction Check - Should rollback on error during save', async () => {
        const mockRequest = {
        id: 'request-uuid',
        brokerId: 'broker-uuid',
        status: RequestStatus.PROCESSING,
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      // Mock Save Spec Success
      (queryRunner.manager.create as jest.Mock).mockImplementation((entity, data) => data);
      
      // Mock Save Milestones Failure
      (queryRunner.manager.save as jest.Mock).mockImplementationOnce(() => Promise.resolve({ id: 'spec-id' })) // Spec save ok
        .mockRejectedValueOnce(new Error('DB Error')); // Milestones save fail

      await expect(service.createSpec(mockUser, createDto, {}))
        .rejects
        .toThrow('DB Error');

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('Should throw Forbidden if broker does not own request', async () => {
         const mockRequest = {
        id: 'request-uuid',
        brokerId: 'other-broker', // Mismatch
        status: RequestStatus.PROCESSING,
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      await expect(service.createSpec(mockUser, createDto, {}))
        .rejects
        .toThrow(ForbiddenException);
        
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('Should throw BadRequest if request status is not PROCESSING', async () => {
         const mockRequest = {
        id: 'request-uuid',
        brokerId: 'broker-uuid',
        status: RequestStatus.PENDING, // Wrong status
      };
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockRequest);

      await expect(service.createSpec(mockUser, createDto, {}))
        .rejects
        .toThrow(BadRequestException);
        
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
