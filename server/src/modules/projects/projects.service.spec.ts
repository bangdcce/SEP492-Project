import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ContractEntity } from '../../database/entities/contract.entity';
import { DisputeEntity } from '../../database/entities/dispute.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { ReviewEntity } from '../../database/entities/review.entity';
import { ProjectRequestEntity, RequestStatus } from '../../database/entities/project-request.entity';
import {
  DeliverableType,
  MilestoneEntity,
  MilestoneStatus,
} from '../../database/entities/milestone.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { TaskHistoryEntity } from '../../database/entities/task-history.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ProjectsService } from './projects.service';
import { MilestoneLockPolicyService } from './milestone-lock-policy.service';
import { MilestoneInteractionPolicyService } from './milestone-interaction-policy.service';
import { EscrowReleaseService } from '../payments/escrow-release.service';
import { NotificationsService } from '../notifications/notifications.service';

const createQueryBuilderMock = (result: unknown) => ({
  setLock: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
  getMany: jest
    .fn()
    .mockResolvedValue(Array.isArray(result) ? result : result ? [result] : []),
});

describe('ProjectsService', () => {
  let service: ProjectsService;

  const projectRepository = {
    findOne: jest.fn(),
  };
  const disputeRepository = {};
  const reviewRepository = {};
  const milestoneRepository = {
    create: jest.fn((value) => value),
    count: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };
  const escrowRepository = {
    findOne: jest.fn(),
  };
  const taskRepository = {
    count: jest.fn(),
  };
  const userRepository = {};
  const auditLogsService = {
    logUpdate: jest.fn(),
  };
  const milestoneLockPolicyService = {
    findLatestActivatedContract: jest.fn(),
    assertCanMutateMilestoneStructure: jest.fn(),
  };
  const milestoneInteractionPolicyService = {
    assertMilestoneUnlockedForWorkspace: jest.fn().mockResolvedValue(undefined),
  };
  const escrowReleaseService = {
    releaseForApprovedMilestone: jest.fn(),
    refundCancelledEscrow: jest.fn(),
  };
  const notificationsService = {
    createMany: jest.fn(),
  };
  const eventEmitter = {
    emit: jest.fn(),
  };

  const milestoneRepoInTransaction = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const projectRepoInTransaction = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const escrowRepoInTransaction = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const taskRepoInTransaction = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const taskHistoryRepoInTransaction = {
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const requestRepoInTransaction = {
    update: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === MilestoneEntity) return milestoneRepoInTransaction;
      if (entity === ProjectEntity) return projectRepoInTransaction;
      if (entity === EscrowEntity) return escrowRepoInTransaction;
      if (entity === TaskEntity) return taskRepoInTransaction;
      if (entity === TaskHistoryEntity) return taskHistoryRepoInTransaction;
      if (entity === ProjectRequestEntity) return requestRepoInTransaction;
      throw new Error('Unexpected repository');
    }),
  };

  const dataSource = {
    transaction: jest.fn((callback: (entityManager: typeof manager) => Promise<unknown>) =>
      callback(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    milestoneRepository.save.mockImplementation((value: MilestoneEntity) => value);
    notificationsService.createMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(ProjectEntity),
          useValue: projectRepository,
        },
        {
          provide: getRepositoryToken(DisputeEntity),
          useValue: disputeRepository,
        },
        {
          provide: getRepositoryToken(ReviewEntity),
          useValue: reviewRepository,
        },
        {
          provide: getRepositoryToken(MilestoneEntity),
          useValue: milestoneRepository,
        },
        {
          provide: getRepositoryToken(EscrowEntity),
          useValue: escrowRepository,
        },
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(TaskHistoryEntity),
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AuditLogsService,
          useValue: auditLogsService,
        },
        {
          provide: MilestoneLockPolicyService,
          useValue: milestoneLockPolicyService,
        },
        {
          provide: MilestoneInteractionPolicyService,
          useValue: milestoneInteractionPolicyService,
        },
        {
          provide: EscrowReleaseService,
          useValue: escrowReleaseService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get(ProjectsService);
  });

  it('routes requested milestone review to broker review when the project has an assigned broker', async () => {
    const milestone = {
      id: 'milestone-1',
      projectId: 'project-1',
      status: MilestoneStatus.IN_PROGRESS,
      submittedAt: null,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;

    milestoneRepository.findOne.mockResolvedValue(milestone);
    projectRepository.findOne.mockResolvedValue(project);
    taskRepository.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    escrowRepository.findOne.mockResolvedValue({
      id: 'escrow-1',
      milestoneId: 'milestone-1',
      status: EscrowStatus.FUNDED,
      fundedAmount: 100,
      totalAmount: 100,
    });

    const result = await service.requestMilestoneReview('milestone-1', 'freelancer-1');

    expect(result.status).toBe(MilestoneStatus.PENDING_STAFF_REVIEW);
    expect(result.submittedAt).toBeInstanceOf(Date);
    expect(milestoneRepository.save).toHaveBeenCalledWith(milestone);
  });

  it('allows milestone review requests to proceed once the task work is complete even if escrow is still pending', async () => {
    const milestone = {
      id: 'milestone-1',
      projectId: 'project-1',
      status: MilestoneStatus.IN_PROGRESS,
      submittedAt: null,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;

    milestoneRepository.findOne.mockResolvedValue(milestone);
    projectRepository.findOne.mockResolvedValue(project);
    taskRepository.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    escrowRepository.findOne.mockResolvedValue({
      id: 'escrow-1',
      milestoneId: 'milestone-1',
      status: EscrowStatus.PENDING,
      fundedAmount: 0,
      totalAmount: 100,
    });

    const result = await service.requestMilestoneReview('milestone-1', 'freelancer-1');

    expect(result.status).toBe(MilestoneStatus.PENDING_STAFF_REVIEW);
    expect(result.submittedAt).toBeInstanceOf(Date);
    expect(milestoneRepository.save).toHaveBeenCalledWith(milestone);
  });

  describe('createMilestone', () => {
    it('creates a milestone and validates the project budget after save', async () => {
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 1000,
      } as ProjectEntity;

      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.count.mockResolvedValue(1);

      const createdMilestone = {
        id: 'milestone-2',
        projectId: 'project-1',
        title: 'Implementation',
        description: 'Build the feature',
        amount: 250,
        retentionAmount: 25,
        deliverableType: DeliverableType.SOURCE_CODE,
        acceptanceCriteria: ['Feature is implemented'],
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        dueDate: new Date('2026-04-10T00:00:00.000Z'),
        sortOrder: 2,
        status: MilestoneStatus.PENDING,
      } as MilestoneEntity;

      milestoneRepository.save.mockResolvedValue(createdMilestone);
      milestoneRepository.find.mockResolvedValue([createdMilestone]);

      const result = await service.createMilestone('project-1', 'broker-1', {
        title: 'Implementation',
        description: 'Build the feature',
        amount: 250,
        retentionAmount: 25,
        deliverableType: DeliverableType.SOURCE_CODE,
        acceptanceCriteria: ['Feature is implemented'],
        startDate: '2026-04-01',
        dueDate: '2026-04-10',
      });

      expect(projectRepository.findOne).toHaveBeenCalledWith({ where: { id: 'project-1' } });
      expect(milestoneRepository.count).toHaveBeenCalledWith({ where: { projectId: 'project-1' } });
      expect(milestoneRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          title: 'Implementation',
          amount: 250,
          retentionAmount: 25,
          deliverableType: DeliverableType.SOURCE_CODE,
          sortOrder: 2,
          status: MilestoneStatus.PENDING,
        }),
      );
      expect(result).toBe(createdMilestone);
    });

    it('removes the saved milestone when the budget check fails', async () => {
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 100,
      } as ProjectEntity;

      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.count.mockResolvedValue(0);
      const savedMilestone = {
        id: 'milestone-1',
        projectId: 'project-1',
        title: 'Too expensive',
        amount: 120,
        retentionAmount: 0,
      } as MilestoneEntity;
      milestoneRepository.save.mockResolvedValue(savedMilestone);
      milestoneRepository.find.mockResolvedValue([savedMilestone]);

      await expect(
        service.createMilestone('project-1', 'broker-1', {
          title: 'Too expensive',
          amount: 120,
        }),
      ).rejects.toThrow('Milestone total exceeds project budget');

      expect(milestoneRepository.remove).toHaveBeenCalledWith(savedMilestone);
    });

    it('rejects milestones whose retention exceeds the amount', async () => {
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 1000,
      } as ProjectEntity;

      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.count.mockResolvedValue(0);

      await expect(
        service.createMilestone('project-1', 'broker-1', {
          title: 'Invalid retention',
          amount: 100,
          retentionAmount: 120,
        }),
      ).rejects.toThrow('Milestone retentionAmount cannot exceed milestone amount');

      expect(milestoneRepository.save).not.toHaveBeenCalled();
      expect(milestoneRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('updateMilestoneStructure', () => {
    it('updates a milestone and returns the saved structure when budget remains valid', async () => {
      const milestone = {
        id: 'milestone-1',
        projectId: 'project-1',
        title: 'Discovery',
        description: 'Old description',
        amount: 100,
        retentionAmount: 10,
        sortOrder: 1,
        deliverableType: DeliverableType.DESIGN_PROTOTYPE,
        acceptanceCriteria: ['Old criteria'],
      } as MilestoneEntity;
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 500,
      } as ProjectEntity;

      milestoneRepository.findOne.mockResolvedValue(milestone);
      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.find.mockResolvedValue([
        {
          ...milestone,
          title: 'Updated milestone',
          description: null,
          amount: 120,
          retentionAmount: 0,
          sortOrder: 2,
          deliverableType: DeliverableType.SOURCE_CODE,
          acceptanceCriteria: ['Updated criteria'],
        },
      ]);

      const updatedMilestone = {
        ...milestone,
        title: 'Updated milestone',
        description: null,
        amount: 120,
        retentionAmount: 0,
        sortOrder: 2,
        deliverableType: DeliverableType.SOURCE_CODE,
        acceptanceCriteria: ['Updated criteria'],
      } as MilestoneEntity;
      milestoneRepository.save.mockImplementation(async (value) => value);

      const result = await service.updateMilestoneStructure('milestone-1', 'broker-1', {
        title: 'Updated milestone',
        description: null,
        amount: 120,
        sortOrder: 2,
        deliverableType: DeliverableType.SOURCE_CODE,
        retentionAmount: 0,
        acceptanceCriteria: ['Updated criteria'],
      });

      expect(milestoneRepository.findOne).toHaveBeenCalledWith({ where: { id: 'milestone-1' } });
      expect(milestoneRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'milestone-1',
          title: 'Updated milestone',
          description: null,
          amount: 120,
          retentionAmount: 0,
          sortOrder: 2,
          deliverableType: DeliverableType.SOURCE_CODE,
        }),
      );
      expect(result).toEqual(updatedMilestone);
    });

    it('rejects an update when no milestone structure fields are provided', async () => {
      milestoneRepository.findOne.mockResolvedValue({
        id: 'milestone-1',
        projectId: 'project-1',
      } as MilestoneEntity);
      projectRepository.findOne.mockResolvedValue({
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 500,
      } as ProjectEntity);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(service.updateMilestoneStructure('milestone-1', 'broker-1', {})).rejects.toThrow(
        'No milestone structure fields provided to update',
      );

      expect(milestoneRepository.save).not.toHaveBeenCalled();
    });

    it('restores the previous milestone state if the budget check fails', async () => {
      const milestone = {
        id: 'milestone-1',
        projectId: 'project-1',
        title: 'Discovery',
        amount: 100,
        retentionAmount: 0,
      } as MilestoneEntity;
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 50,
      } as ProjectEntity;

      milestoneRepository.findOne.mockResolvedValue(milestone);
      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.save.mockImplementation(async (value) => value);
      milestoneRepository.find.mockResolvedValue([
        {
          ...milestone,
          amount: 100,
          retentionAmount: 0,
        },
      ]);

      await expect(
        service.updateMilestoneStructure('milestone-1', 'broker-1', { amount: 100 }),
      ).rejects.toThrow('Milestone total exceeds project budget');

      expect(milestoneRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'milestone-1',
          amount: 100,
        }),
      );
      expect(milestoneRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'milestone-1',
          projectId: 'project-1',
          title: 'Discovery',
          amount: 100,
          retentionAmount: 0,
        }),
      );
    });
  });

  describe('deleteMilestoneStructure', () => {
    it('deletes a milestone when the remaining project budget is still valid', async () => {
      const milestone = {
        id: 'milestone-1',
        projectId: 'project-1',
        title: 'Discovery',
        amount: 100,
        retentionAmount: 10,
      } as MilestoneEntity;
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 500,
      } as ProjectEntity;

      milestoneRepository.findOne.mockResolvedValue(milestone);
      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.find.mockResolvedValue([]);
      milestoneRepository.remove.mockResolvedValue(milestone);

      await expect(service.deleteMilestoneStructure('milestone-1', 'broker-1')).resolves.toBeUndefined();

      expect(milestoneRepository.remove).toHaveBeenCalledWith(milestone);
      expect(milestoneRepository.save).not.toHaveBeenCalled();
    });

    it('restores the milestone if deleting it causes the project budget to fail', async () => {
      const milestone = {
        id: 'milestone-1',
        projectId: 'project-1',
        title: 'Discovery',
        amount: 300,
        retentionAmount: 10,
      } as MilestoneEntity;
      const project = {
        id: 'project-1',
        brokerId: 'broker-1',
        status: ProjectStatus.IN_PROGRESS,
        totalBudget: 200,
      } as ProjectEntity;

      milestoneRepository.findOne.mockResolvedValue(milestone);
      projectRepository.findOne.mockResolvedValue(project);
      milestoneLockPolicyService.assertCanMutateMilestoneStructure = jest
        .fn()
        .mockResolvedValue(undefined);
      milestoneRepository.remove.mockResolvedValue(milestone);
      milestoneRepository.find.mockResolvedValue([
        {
          id: 'milestone-2',
          projectId: 'project-1',
          amount: 250,
          retentionAmount: 0,
        } as MilestoneEntity,
      ]);

      await expect(service.deleteMilestoneStructure('milestone-1', 'broker-1')).rejects.toThrow(
        'Milestone total exceeds project budget',
      );

      expect(milestoneRepository.remove).toHaveBeenCalledWith(milestone);
      expect(milestoneRepository.save).toHaveBeenCalledWith(milestone);
    });

    it('rejects deleting a milestone that is not linked to a project', async () => {
      milestoneRepository.findOne.mockResolvedValue({
        id: 'milestone-1',
        projectId: null,
      } as MilestoneEntity);

      await expect(service.deleteMilestoneStructure('milestone-1', 'broker-1')).rejects.toThrow(
        'Milestone is not linked to a project',
      );

      expect(milestoneRepository.remove).not.toHaveBeenCalled();
    });
  });

  it('allows the assigned broker to complete the intermediate milestone review', async () => {
    const milestone = {
      id: 'milestone-1',
      projectId: 'project-1',
      status: MilestoneStatus.PENDING_STAFF_REVIEW,
      reviewedByStaffId: null,
      staffRecommendation: null,
      staffReviewNote: null,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;

    milestoneRepository.findOne.mockResolvedValue(milestone);
    projectRepository.findOne.mockResolvedValue(project);

    const result = await service.reviewMilestoneAsBroker('milestone-1', 'broker-1', {
      recommendation: 'ACCEPT',
      note: 'Broker review passed.',
    });

    expect(result.status).toBe(MilestoneStatus.PENDING_CLIENT_APPROVAL);
    expect(result.reviewedByStaffId).toBe('broker-1');
    expect(result.staffRecommendation).toBe('ACCEPT');
    expect(result.staffReviewNote).toBe('Broker review passed.');
    expect(milestoneRepository.save).toHaveBeenCalledWith(milestone);
  });

  it('approves a submitted milestone and releases escrow without changing the response contract', async () => {
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      amount: 100,
      projectId: 'project-1',
      status: MilestoneStatus.SUBMITTED,
      deliverableType: DeliverableType.OTHER,
      feedback: null,
      sortOrder: 1,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;
    const activatedContract = {
      milestoneSnapshot: [
        {
          contractMilestoneKey: 'cmk-1',
          projectMilestoneId: 'milestone-1',
          title: 'Kickoff',
          amount: 100,
          sortOrder: 1,
        },
      ],
    } as ContractEntity;

    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(milestone),
    );
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));
    taskRepoInTransaction.find.mockResolvedValue([
      { id: 'task-1', milestoneId: 'milestone-1', status: TaskStatus.DONE },
      { id: 'task-2', milestoneId: 'milestone-1', status: TaskStatus.DONE },
    ] as TaskEntity[]);
    milestoneRepoInTransaction.save.mockImplementation((value: MilestoneEntity) => value);
    milestoneLockPolicyService.findLatestActivatedContract.mockResolvedValue(activatedContract);
    escrowReleaseService.releaseForApprovedMilestone.mockResolvedValue({
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: 'RELEASED',
      releasedAmount: 100,
      clientWalletSnapshot: {
        id: 'wallet-client',
        userId: 'client-1',
        availableBalance: 0,
        pendingBalance: 0,
        heldBalance: 0,
        totalDeposited: 100,
        totalWithdrawn: 0,
        totalEarned: 0,
        totalSpent: 100,
        currency: 'USD',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      },
      releaseTransactionIds: ['tx-client', 'tx-freelancer', 'tx-broker'],
      recipients: [],
    });

    const result = await service.approveMilestone('milestone-1', 'client-1', 'Looks good', {
      ip: '127.0.0.1',
      method: 'POST',
      path: '/projects/milestones/milestone-1/approve',
    });

    expect(result.fundsReleased).toBe(true);
    expect(result.milestone.status).toBe(MilestoneStatus.PAID);
    expect(result.message).toContain('Funds have been released');
    expect(milestoneRepoInTransaction.save).toHaveBeenCalledTimes(2);
    expect(escrowReleaseService.releaseForApprovedMilestone).toHaveBeenCalledWith(
      'milestone-1',
      'client-1',
      manager,
    );
    expect(auditLogsService.logUpdate).toHaveBeenCalledTimes(1);
    expect(taskRepoInTransaction.find).toHaveBeenCalledTimes(1);
  });

  it('rolls back approval if escrow release fails', async () => {
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      amount: 100,
      projectId: 'project-1',
      status: MilestoneStatus.SUBMITTED,
      deliverableType: DeliverableType.OTHER,
      feedback: null,
      sortOrder: 1,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;

    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(milestone),
    );
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));
    taskRepoInTransaction.find.mockResolvedValue([
      { id: 'task-1', milestoneId: 'milestone-1', status: TaskStatus.DONE },
    ] as TaskEntity[]);
    milestoneRepoInTransaction.save.mockImplementation((value: MilestoneEntity) => value);
    milestoneLockPolicyService.findLatestActivatedContract.mockResolvedValue(null);
    escrowReleaseService.releaseForApprovedMilestone.mockRejectedValue(
      new BadRequestException('Escrow is not funded'),
    );

    await expect(
      service.approveMilestone('milestone-1', 'client-1', 'Looks good', {
        ip: '127.0.0.1',
        method: 'POST',
        path: '/projects/milestones/milestone-1/approve',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(auditLogsService.logUpdate).not.toHaveBeenCalled();
  });

  it('allows approving a milestone after broker review when status is PENDING_CLIENT_APPROVAL', async () => {
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      amount: 100,
      projectId: 'project-1',
      status: MilestoneStatus.PENDING_CLIENT_APPROVAL,
      deliverableType: DeliverableType.OTHER,
      feedback: null,
      sortOrder: 1,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;

    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(milestone),
    );
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));
    taskRepoInTransaction.find.mockResolvedValue([
      { id: 'task-1', milestoneId: 'milestone-1', status: TaskStatus.DONE },
    ] as TaskEntity[]);
    milestoneRepoInTransaction.save.mockImplementation((value: MilestoneEntity) => value);
    milestoneLockPolicyService.findLatestActivatedContract.mockResolvedValue(null);
    escrowReleaseService.releaseForApprovedMilestone.mockResolvedValue({
      releaseTransactionIds: ['tx-1'],
    });

    const result = await service.approveMilestone('milestone-1', 'client-1');

    expect(result.milestone.status).toBe(MilestoneStatus.PAID);
    expect(escrowReleaseService.releaseForApprovedMilestone).toHaveBeenCalledWith(
      'milestone-1',
      'client-1',
      manager,
    );
  });

  it('rejects broker users from giving final milestone approval', async () => {
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      amount: 100,
      projectId: 'project-1',
      status: MilestoneStatus.PENDING_CLIENT_APPROVAL,
      deliverableType: DeliverableType.OTHER,
      feedback: null,
      sortOrder: 1,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;

    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(milestone),
    );
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));

    await expect(service.approveMilestone('milestone-1', 'broker-1')).rejects.toThrow(
      'Only the project client can give final milestone approval',
    );

    expect(taskRepoInTransaction.find).not.toHaveBeenCalled();
    expect(escrowReleaseService.releaseForApprovedMilestone).not.toHaveBeenCalled();
  });

  it('rejects milestone approval while the project is disputed', async () => {
    const milestone = {
      id: 'milestone-1',
      title: 'Kickoff',
      amount: 100,
      projectId: 'project-1',
      status: MilestoneStatus.SUBMITTED,
      deliverableType: DeliverableType.OTHER,
      feedback: null,
      sortOrder: 1,
    } as MilestoneEntity;
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      currency: 'USD',
      status: ProjectStatus.DISPUTED,
    } as ProjectEntity;

    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock(milestone),
    );
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));

    await expect(service.approveMilestone('milestone-1', 'client-1')).rejects.toThrow(
      'Cannot approve milestone while the project is under dispute',
    );

    expect(escrowReleaseService.releaseForApprovedMilestone).not.toHaveBeenCalled();
  });

  it('cancels an active project, refunds funded escrows, and locks unfinished work', async () => {
    const project = {
      id: 'project-1',
      requestId: 'request-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      staffId: 'staff-1',
      staffInviteStatus: 'ACCEPTED',
      currency: 'USD',
      status: ProjectStatus.IN_PROGRESS,
      title: 'Website rebuild',
    } as ProjectEntity;
    const milestone1 = {
      id: 'milestone-1',
      projectId: 'project-1',
      status: MilestoneStatus.SUBMITTED,
      title: 'Discovery',
    } as MilestoneEntity;
    const milestone2 = {
      id: 'milestone-2',
      projectId: 'project-1',
      status: MilestoneStatus.COMPLETED,
      title: 'Design',
    } as MilestoneEntity;
    const escrow1 = {
      id: 'escrow-1',
      projectId: 'project-1',
      milestoneId: 'milestone-1',
      status: EscrowStatus.FUNDED,
      totalAmount: 100,
      fundedAmount: 100,
      currency: 'USD',
      holdTransactionId: 'tx-hold-1',
    } as EscrowEntity;
    const escrow2 = {
      id: 'escrow-2',
      projectId: 'project-1',
      milestoneId: 'milestone-2',
      status: EscrowStatus.PENDING,
      totalAmount: 250,
      fundedAmount: 0,
      currency: 'USD',
    } as EscrowEntity;
    const task1 = {
      id: 'task-1',
      projectId: 'project-1',
      milestoneId: 'milestone-1',
      status: TaskStatus.IN_PROGRESS,
      submittedAt: new Date('2026-03-25T00:00:00.000Z'),
    } as TaskEntity;
    const task2 = {
      id: 'task-2',
      projectId: 'project-1',
      milestoneId: 'milestone-2',
      status: TaskStatus.DONE,
      submittedAt: new Date('2026-03-25T00:00:00.000Z'),
    } as TaskEntity;

    projectRepository.findOne.mockResolvedValue(project);
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));
    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock([milestone1, milestone2]),
    );
    escrowRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock([escrow1, escrow2]),
    );
    taskRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock([task1, task2]),
    );
    milestoneRepoInTransaction.save.mockImplementation((value: MilestoneEntity) => value);
    projectRepoInTransaction.save.mockImplementation((value: ProjectEntity) => value);
    taskRepoInTransaction.save.mockImplementation((value: TaskEntity) => value);
    taskHistoryRepoInTransaction.save.mockImplementation((value) => value);
    escrowReleaseService.refundCancelledEscrow.mockResolvedValue({
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: EscrowStatus.REFUNDED,
      refundedAmount: 100,
      clientWalletSnapshot: {
        id: 'wallet-client',
        userId: 'client-1',
        availableBalance: 100,
        pendingBalance: 0,
        heldBalance: 0,
        totalDeposited: 100,
        totalWithdrawn: 0,
        totalEarned: 0,
        totalSpent: 0,
        currency: 'USD',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-13T00:00:00.000Z'),
        updatedAt: new Date('2026-03-13T00:00:00.000Z'),
      },
      refundTransactionId: 'tx-refund-1',
    });

    const result = await service.cancelProject('project-1', 'client-1', 'CLIENT', {
      ip: '127.0.0.1',
      method: 'POST',
      path: '/projects/project-1/cancel',
    });

    expect(escrowReleaseService.refundCancelledEscrow).toHaveBeenCalledTimes(1);
    expect(escrowReleaseService.refundCancelledEscrow).toHaveBeenCalledWith(
      project,
      milestone1,
      escrow1,
      'client-1',
      manager,
    );
    expect(milestoneRepoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'milestone-1',
        status: MilestoneStatus.LOCKED,
      }),
    );
    expect(taskRepoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: TaskStatus.BLOCKED,
        submittedAt: null,
      }),
    );
    expect(taskRepoInTransaction.save).not.toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-2',
        status: TaskStatus.BLOCKED,
      }),
    );
    expect(taskHistoryRepoInTransaction.save).toHaveBeenCalled();
    expect(projectRepoInTransaction.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'project-1',
        status: ProjectStatus.CANCELED,
        staffId: null,
        staffInviteStatus: null,
      }),
    );
    expect(requestRepoInTransaction.update).toHaveBeenCalledWith(
      { id: project.requestId },
      { status: RequestStatus.CANCELED },
    );
    expect(notificationsService.createMany).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'project.updated',
      expect.objectContaining({ projectId: 'project-1' }),
    );
    expect(auditLogsService.logUpdate).toHaveBeenCalled();
    expect(result.totalRefundedAmount).toBe(100);
    expect(result.refundedEscrows).toHaveLength(1);
    expect(result.project.status).toBe(ProjectStatus.CANCELED);
  });

  it('rejects project cancellation after any escrow has already been released', async () => {
    const project = {
      id: 'project-1',
      clientId: 'client-1',
      brokerId: 'broker-1',
      freelancerId: 'freelancer-1',
      status: ProjectStatus.IN_PROGRESS,
    } as ProjectEntity;
    const milestone = {
      id: 'milestone-1',
      projectId: 'project-1',
      status: MilestoneStatus.SUBMITTED,
    } as MilestoneEntity;

    projectRepository.findOne.mockResolvedValue(project);
    projectRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock(project));
    milestoneRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock([milestone]),
    );
    escrowRepoInTransaction.createQueryBuilder.mockReturnValue(
      createQueryBuilderMock([
        {
          id: 'escrow-1',
          projectId: 'project-1',
          milestoneId: 'milestone-1',
          status: EscrowStatus.RELEASED,
          totalAmount: 100,
          fundedAmount: 100,
        } as EscrowEntity,
      ]),
    );
    taskRepoInTransaction.createQueryBuilder.mockReturnValue(createQueryBuilderMock([]));

    await expect(service.cancelProject('project-1', 'client-1')).rejects.toThrow(
      'Cannot cancel a project after escrow has been released',
    );

    expect(escrowReleaseService.refundCancelledEscrow).not.toHaveBeenCalled();
    expect(projectRepoInTransaction.save).not.toHaveBeenCalled();
  });
});
