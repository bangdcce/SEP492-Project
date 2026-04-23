import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectSpecsService } from './project-specs.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ProjectSpecEntity,
  ProjectSpecStatus,
  SpecPhase,
} from '../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import {
  ProjectRequestEntity,
  RequestStatus,
} from '../../database/entities/project-request.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { DataSource, QueryRunner } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateProjectSpecDto } from './dto/create-project-spec.dto';
import { DeliverableType } from '../../database/entities/milestone.entity';
import { ProjectSpecSignatureEntity } from '../../database/entities/project-spec-signature.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestChatService } from '../request-chat/request-chat.service';

describe('ProjectSpecsService', () => {
  let service: ProjectSpecsService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const mockProjectSpecsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const mockMilestonesRepo = {};
  const mockProjectRequestsRepo = {
    save: jest.fn(),
  };
  const mockProjectSpecSignaturesRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(),
    metadata: {
      columns: [{ databaseName: 'specId', propertyName: 'specId' }],
    },
  };
  const mockProjectRequestProposalsRepo = {
    find: jest.fn(),
  };
  const mockNotificationsRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(),
  };
  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(undefined),
  };
  const mockAuditLogsService = {
    log: jest.fn(),
  };
  const mockRequestChatService = {
    createSystemMessage: jest.fn().mockResolvedValue(undefined),
    assertRequestReadAccess: jest.fn().mockResolvedValue(undefined),
    assertRequestWriteAccess: jest.fn().mockResolvedValue(undefined),
  };
  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockUser: UserEntity = {
    id: 'broker-uuid',
    role: UserRole.BROKER,
  } as UserEntity;

  const buildRequest = (overrides: Partial<ProjectRequestEntity> = {}) =>
    ({
      id: 'request-uuid',
      brokerId: 'broker-uuid',
      clientId: 'client-uuid',
      title: 'Project request',
      description: 'Legacy request fixture',
      status: RequestStatus.PROCESSING,
      requestedDeadline: '2026-05-15',
      requestScopeBaseline: {
        productTypeCode: 'CUSTOM_SOFTWARE',
        productTypeLabel: 'Custom Software',
        projectGoalSummary: 'Deliver a production-ready implementation',
        requestedDeadline: '2026-05-15',
        requestTitle: 'Project request',
        requestDescription: 'Legacy request fixture',
      },
      ...overrides,
    }) as ProjectRequestEntity;

  beforeEach(async () => {
    (mockProjectSpecSignaturesRepo as any).metadata = {
      columns: [{ databaseName: 'specId', propertyName: 'specId' }],
    };

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
        delete: jest.fn(),
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
        {
          provide: getRepositoryToken(ProjectSpecSignatureEntity),
          useValue: mockProjectSpecSignaturesRepo,
        },
        {
          provide: getRepositoryToken(ProjectRequestProposalEntity),
          useValue: mockProjectRequestProposalsRepo,
        },
        { provide: getRepositoryToken(NotificationEntity), useValue: mockNotificationsRepo },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: RequestChatService, useValue: mockRequestChatService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
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
          startDate: '2026-04-01',
          dueDate: '2026-04-10',
          deliverableType: DeliverableType.DESIGN_PROTOTYPE,
          retentionAmount: 0,
          sortOrder: 1,
        },
        {
          title: 'Development',
          description: 'Backend',
          amount: 500, // 50%
          startDate: '2026-04-11',
          dueDate: '2026-04-24',
          deliverableType: DeliverableType.SOURCE_CODE,
          retentionAmount: 0,
          sortOrder: 2,
        },
        {
          title: 'Deployment',
          description: 'Go Live',
          amount: 200, // 20% (Min allowed for Last)
          startDate: '2026-04-25',
          dueDate: '2026-05-15',
          deliverableType: DeliverableType.DEPLOYMENT,
          retentionAmount: 20,
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
      const mockRequest = buildRequest({ broker: mockUser });
      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(null);

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
      const mockRequest = buildRequest();
      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(null);

      const invalidDto = {
        ...createDto,
        milestones: [
          { ...createDto.milestones[0], amount: 350 }, // 35% -> ERROR
          { ...createDto.milestones[1], amount: 450 },
          { ...createDto.milestones[2], amount: 200 },
        ],
      };

      await expect(service.createSpec(mockUser, invalidDto, {})).rejects.toThrow(
        /First milestone cannot exceed 30%/,
      );
    });

    it('Scenario 3: Milestone Budget Violation - Last Milestone < 20%', async () => {
      const mockRequest = buildRequest();
      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(null);

      const invalidDto = {
        ...createDto,
        milestones: [
          { ...createDto.milestones[0], amount: 300 },
          { ...createDto.milestones[1], amount: 600 },
          { ...createDto.milestones[2], amount: 100, retentionAmount: 0 }, // 10% -> ERROR
        ],
      };

      await expect(service.createSpec(mockUser, invalidDto, {})).rejects.toThrow(
        /Final milestone must be at least 20%/,
      );
    });

    it('Scenario 4: Keyword Warnings', async () => {
      const mockRequest = buildRequest();
      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(null);

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
      const mockRequest = buildRequest();
      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(null);

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
        /too short/,
      );
    });
  });

  describe('full spec budget cap', () => {
    const fullSpecDto: CreateProjectSpecDto = {
      requestId: 'request-uuid',
      parentSpecId: 'client-spec-uuid',
      title: 'Detailed Full Spec',
      description: 'Detailed technical scope for implementation',
      totalBudget: 1200,
      milestones: [
        {
          title: 'Phase 1',
          description: 'Discovery and design',
          amount: 300,
          startDate: '2026-04-01',
          dueDate: '2026-04-10',
          deliverableType: DeliverableType.DESIGN_PROTOTYPE,
          retentionAmount: 0,
          sortOrder: 1,
        },
        {
          title: 'Phase 2',
          description: 'Implementation',
          amount: 660,
          startDate: '2026-04-11',
          dueDate: '2026-04-30',
          deliverableType: DeliverableType.SOURCE_CODE,
          retentionAmount: 0,
          sortOrder: 2,
        },
        {
          title: 'Phase 3',
          description: 'Release',
          amount: 240,
          startDate: '2026-05-01',
          dueDate: '2026-05-15',
          deliverableType: DeliverableType.DEPLOYMENT,
          retentionAmount: 0,
          sortOrder: 3,
        },
      ],
      features: [
        {
          title: 'Feature A',
          description: 'Detailed feature',
          complexity: 'MEDIUM' as const,
          acceptanceCriteria: ['System supports the approved workflow end-to-end'],
        },
      ],
      techStack: 'NestJS, React',
    };

    it('rejects createFullSpec when milestone budget exceeds approved client spec budget', async () => {
      const mockRequest = buildRequest({ broker: mockUser });
      const approvedClientSpec = {
        id: 'client-spec-uuid',
        requestId: 'request-uuid',
        specPhase: SpecPhase.CLIENT_SPEC,
        status: ProjectSpecStatus.CLIENT_APPROVED,
        totalBudget: 1000,
      };

      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(approvedClientSpec)
        .mockResolvedValueOnce(null);

      await expect(service.createFullSpec(mockUser, fullSpecDto, {})).rejects.toThrow(
        /must match the approved commercial baseline/i,
      );
    });

    it('rejects updateFullSpec when new budget exceeds approved client spec budget', async () => {
      const existingSpec = {
        id: 'full-spec-uuid',
        requestId: 'request-uuid',
        parentSpecId: 'client-spec-uuid',
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.DRAFT,
        request: buildRequest(),
        parentSpec: {
          id: 'client-spec-uuid',
          totalBudget: 1000,
        },
        milestones: [],
      } as unknown as ProjectSpecEntity;

      jest.spyOn(service, 'findOne').mockResolvedValue(existingSpec);

      await expect(
        service.updateFullSpec(mockUser, 'full-spec-uuid', fullSpecDto, {}),
      ).rejects.toThrow(/must match the approved commercial baseline/i);
    });

    it('rejects updateFullSpec when the full spec is locked by a contract draft', async () => {
      const existingSpec = {
        id: 'full-spec-uuid',
        requestId: 'request-uuid',
        parentSpecId: 'client-spec-uuid',
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.DRAFT,
        lockedByContractId: 'contract-uuid',
        request: buildRequest(),
        parentSpec: {
          id: 'client-spec-uuid',
          totalBudget: 1400,
        },
        milestones: [],
      } as unknown as ProjectSpecEntity;

      jest.spyOn(service, 'findOne').mockResolvedValue(existingSpec);

      await expect(
        service.updateFullSpec(
          mockUser,
          'full-spec-uuid',
          {
            ...fullSpecDto,
            totalBudget: 1000,
          },
          {},
        ),
      ).rejects.toThrow(/locked by contract/i);
    });

    it('rejects createFullSpec when milestone retention exceeds milestone amount', async () => {
      const mockRequest = buildRequest({ broker: mockUser });
      const approvedClientSpec = {
        id: 'client-spec-uuid',
        requestId: 'request-uuid',
        specPhase: SpecPhase.CLIENT_SPEC,
        status: ProjectSpecStatus.CLIENT_APPROVED,
        totalBudget: 1400,
      };

      (queryRunner.manager.findOne as jest.Mock)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(approvedClientSpec)
        .mockResolvedValueOnce(null);

      await expect(
        service.createFullSpec(
          mockUser,
          {
            ...fullSpecDto,
            totalBudget: 1000,
            milestones: [
              {
                ...fullSpecDto.milestones[0],
                amount: 300,
                retentionAmount: 350,
              },
              {
                ...fullSpecDto.milestones[1],
                amount: 500,
              },
              {
                ...fullSpecDto.milestones[2],
                amount: 200,
              },
            ],
          },
          {},
        ),
      ).rejects.toThrow(/retention amount cannot exceed/i);
    });

    it('rejects updateFullSpec when milestone due date is before start date', async () => {
      const existingSpec = {
        id: 'full-spec-uuid',
        requestId: 'request-uuid',
        parentSpecId: 'client-spec-uuid',
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.DRAFT,
        request: buildRequest(),
        parentSpec: {
          id: 'client-spec-uuid',
          totalBudget: 1400,
        },
        milestones: [],
      } as unknown as ProjectSpecEntity;

      jest.spyOn(service, 'findOne').mockResolvedValue(existingSpec);

      await expect(
        service.updateFullSpec(
          mockUser,
          'full-spec-uuid',
          {
            ...fullSpecDto,
            totalBudget: 1000,
            milestones: [
              {
                ...fullSpecDto.milestones[0],
                amount: 300,
                startDate: '2026-04-15',
                dueDate: '2026-04-10',
              },
              {
                ...fullSpecDto.milestones[1],
                amount: 500,
                startDate: '2026-04-16',
                dueDate: '2026-04-30',
              },
              {
                ...fullSpecDto.milestones[2],
                amount: 200,
                startDate: '2026-05-01',
                dueDate: '2026-05-15',
              },
            ],
          },
          {},
        ),
      ).rejects.toThrow(/due date must be on or after/i);
    });
  });

  describe('milestone sequencing guardrails', () => {
    it('allows milestones that start on the same day the previous milestone ends', () => {
      const milestones = [
        {
          title: 'Phase 1',
          description: 'Setup',
          amount: 300,
          retentionAmount: 0,
          sortOrder: 1,
          startDate: '2099-01-01',
          dueDate: '2099-01-10',
        },
        {
          title: 'Phase 2',
          description: 'Build',
          amount: 700,
          retentionAmount: 0,
          sortOrder: 2,
          startDate: '2099-01-10',
          dueDate: '2099-01-20',
        },
      ] as any;

      expect(() => (service as any).validateMilestoneStructure(milestones)).not.toThrow();
    });
  });

  describe('approved feature mapping guardrails', () => {
    it('allows approved feature assignments to be reused across milestones when coverage is satisfied', () => {
      const approvedClientFeatures = [
        {
          id: 'feature-dashboard',
          title: 'Workspace Dashboard',
          description: 'Dashboard feature',
          priority: 'MUST_HAVE',
        },
      ] as any;
      const milestones = [
        {
          title: 'Phase 1',
          approvedClientFeatureIds: ['feature-dashboard'],
        },
        {
          title: 'Phase 2',
          approvedClientFeatureIds: ['feature-dashboard'],
        },
      ] as any;

      expect(() =>
        (service as any).validateApprovedFeatureCoverage([], milestones, approvedClientFeatures),
      ).not.toThrow();
    });
  });

  describe('signature foreign key mapping', () => {
    it('falls back to specId when signature metadata is unavailable', () => {
      delete (mockProjectSpecSignaturesRepo as any).metadata;

      const where = (service as any).buildProjectSpecSignatureWhere('spec-uuid', {
        userId: 'user-uuid',
      });

      expect(where).toEqual({
        specId: 'spec-uuid',
        userId: 'user-uuid',
      });
    });

    it('uses mapped property when specId database column maps to projectSpecId', () => {
      (mockProjectSpecSignaturesRepo as any).metadata = {
        columns: [{ databaseName: 'specId', propertyName: 'projectSpecId' }],
      };

      const where = (service as any).buildProjectSpecSignatureWhere('spec-uuid', {
        userId: 'user-uuid',
      });

      expect(where).toEqual({
        projectSpecId: 'spec-uuid',
        userId: 'user-uuid',
      });
    });
  });

  describe('requestFullSpecChanges', () => {
    it('returns a final-review full spec to REJECTED and clears collected signatures', async () => {
      const fullSpec = {
        id: 'full-spec-uuid',
        requestId: 'request-uuid',
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.FINAL_REVIEW,
        title: 'Needs revision',
        rejectionReason: null,
        request: {
          id: 'request-uuid',
          title: 'Marketplace Revamp',
          clientId: 'client-uuid',
          brokerId: 'broker-uuid',
        },
        signatures: [
          { id: 'sig-1', userId: 'broker-uuid', signerRole: 'BROKER' },
          { id: 'sig-2', userId: 'client-uuid', signerRole: 'CLIENT' },
        ],
      } as unknown as ProjectSpecEntity;

      jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(fullSpec)
        .mockResolvedValueOnce({
          ...fullSpec,
          status: ProjectSpecStatus.REJECTED,
          rejectionReason: 'Please tighten the milestone acceptance criteria.',
          signatures: [],
        } as unknown as ProjectSpecEntity);

      mockProjectRequestProposalsRepo.find.mockResolvedValue([]);
      (queryRunner.manager.findOne as jest.Mock).mockResolvedValue({
        ...fullSpec,
        request: fullSpec.request,
      });
      (queryRunner.manager.save as jest.Mock).mockImplementation((value) => Promise.resolve(value));
      (queryRunner.manager.delete as jest.Mock).mockResolvedValue({ affected: 2 });

      const result = await service.requestFullSpecChanges(
        mockUser,
        'full-spec-uuid',
        'Please tighten the milestone acceptance criteria.',
        {},
      );

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.manager.delete).toHaveBeenCalledWith(ProjectSpecSignatureEntity, {
        specId: 'full-spec-uuid',
      });
      expect(result.status).toBe(ProjectSpecStatus.REJECTED);
      expect(result.rejectionReason).toContain('acceptance criteria');
      expect(mockAuditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REQUEST_FULL_SPEC_CHANGES',
        }),
      );
    });

    it('rejects change requests from users who are not eligible full-spec reviewers', async () => {
      const outsider = {
        id: 'outsider-uuid',
        role: UserRole.CLIENT,
      } as UserEntity;

      const fullSpec = {
        id: 'full-spec-uuid',
        requestId: 'request-uuid',
        specPhase: SpecPhase.FULL_SPEC,
        status: ProjectSpecStatus.FINAL_REVIEW,
        request: {
          id: 'request-uuid',
          title: 'Marketplace Revamp',
          clientId: 'client-uuid',
          brokerId: 'broker-uuid',
        },
        signatures: [],
      } as unknown as ProjectSpecEntity;

      jest.spyOn(service, 'findOne').mockResolvedValue(fullSpec);
      mockProjectRequestProposalsRepo.find.mockResolvedValue([]);

      await expect(
        service.requestFullSpecChanges(
          outsider,
          'full-spec-uuid',
          'This needs a substantial rewrite before we can sign.',
          {},
        ),
      ).rejects.toThrow(/not an eligible reviewer/i);
    });
  });

  describe('query authorization', () => {
    it('allows a contract-side freelancer to view a spec for the request', async () => {
      const freelancer = {
        id: 'freelancer-uuid',
        role: UserRole.FREELANCER,
      } as UserEntity;

      const spec = {
        id: 'spec-uuid',
        request: {
          id: 'request-uuid',
          clientId: 'client-uuid',
          brokerId: 'broker-uuid',
          proposals: [
            {
              freelancerId: 'freelancer-uuid',
              status: 'ACCEPTED',
            },
          ],
        },
      } as unknown as ProjectSpecEntity;

      mockProjectSpecsRepo.findOne.mockResolvedValue(spec);

      await expect(service.findOneForUser(freelancer, 'spec-uuid')).resolves.toBe(spec);
    });

    it('rejects unrelated users from viewing a spec', async () => {
      const outsider = {
        id: 'outsider-uuid',
        role: UserRole.CLIENT,
      } as UserEntity;

      const spec = {
        id: 'spec-uuid',
        request: {
          id: 'request-uuid',
          clientId: 'client-uuid',
          brokerId: 'broker-uuid',
          proposals: [
            {
              freelancerId: 'freelancer-uuid',
              status: 'ACCEPTED',
            },
          ],
        },
      } as unknown as ProjectSpecEntity;

      mockProjectSpecsRepo.findOne.mockResolvedValue(spec);

      await expect(service.findOneForUser(outsider, 'spec-uuid')).rejects.toThrow(
        /not authorized to view this spec/i,
      );
    });
  });
});
