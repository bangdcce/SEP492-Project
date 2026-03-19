import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ContractEntity } from '../../database/entities/contract.entity';
import { DisputeEntity } from '../../database/entities/dispute.entity';
import { ReviewEntity } from '../../database/entities/review.entity';
import {
  DeliverableType,
  MilestoneEntity,
  MilestoneStatus,
} from '../../database/entities/milestone.entity';
import { ProjectEntity, ProjectStatus } from '../../database/entities/project.entity';
import { TaskEntity, TaskStatus } from '../../database/entities/task.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ProjectsService } from './projects.service';
import { MilestoneLockPolicyService } from './milestone-lock-policy.service';
import { EscrowReleaseService } from '../payments/escrow-release.service';

const createQueryBuilderMock = (result: unknown) => ({
  setLock: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
});

describe('ProjectsService approveMilestone', () => {
  let service: ProjectsService;

  const projectRepository = {};
  const disputeRepository = {};
  const reviewRepository = {};
  const milestoneRepository = {};
  const taskRepository = {};
  const userRepository = {};
  const auditLogsService = {
    logUpdate: jest.fn(),
  };
  const milestoneLockPolicyService = {
    findLatestActivatedContract: jest.fn(),
  };
  const escrowReleaseService = {
    releaseForApprovedMilestone: jest.fn(),
  };

  const milestoneRepoInTransaction = {
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };
  const projectRepoInTransaction = {
    createQueryBuilder: jest.fn(),
  };
  const taskRepoInTransaction = {
    find: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === MilestoneEntity) return milestoneRepoInTransaction;
      if (entity === ProjectEntity) return projectRepoInTransaction;
      if (entity === TaskEntity) return taskRepoInTransaction;
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
          provide: getRepositoryToken(TaskEntity),
          useValue: taskRepository,
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
          provide: EscrowReleaseService,
          useValue: escrowReleaseService,
        },
      ],
    }).compile();

    service = module.get(ProjectsService);
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
    expect(result.milestone.status).toBe(MilestoneStatus.COMPLETED);
    expect(result.message).toContain('Funds have been released');
    expect(milestoneRepoInTransaction.save).toHaveBeenCalledTimes(1);
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

  it('allows approving a milestone after staff review when status is PENDING_CLIENT_APPROVAL', async () => {
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

    expect(result.milestone.status).toBe(MilestoneStatus.COMPLETED);
    expect(escrowReleaseService.releaseForApprovedMilestone).toHaveBeenCalledWith(
      'milestone-1',
      'client-1',
      manager,
    );
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
});
