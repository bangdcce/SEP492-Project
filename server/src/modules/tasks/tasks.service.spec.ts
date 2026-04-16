import { TaskStatus } from '../../database/entities/task.entity';
import { UserRole } from '../../database/entities/user.entity';
import { TasksService } from './tasks.service';
import { TaskSubmissionStatus } from './entities/task-submission.entity';

describe('TasksService.reviewSubmission', () => {
  const fixedNow = new Date('2026-04-13T08:00:00.000Z');

  const createService = () => {
    const taskRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const milestoneRepository = {};
    const escrowRepository = {};
    const projectRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'project-1',
        clientId: 'client-1',
        brokerId: 'broker-1',
      }),
    };
    const calendarEventRepository = {};
    const historyRepository = {};
    const commentRepository = {};
    const attachmentRepository = {};
    const taskLinkRepository = {};
    const submissionRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = {
      query: jest.fn(),
    };
    const auditLogsService = {
      logSystemIncident: jest.fn(),
    };
    const milestoneInteractionPolicyService = {
      assertMilestoneUnlockedForWorkspace: jest.fn(),
    };

    const service = new TasksService(
      taskRepository as any,
      milestoneRepository as any,
      escrowRepository as any,
      projectRepository as any,
      calendarEventRepository as any,
      historyRepository as any,
      commentRepository as any,
      attachmentRepository as any,
      taskLinkRepository as any,
      submissionRepository as any,
      dataSource as any,
      auditLogsService as any,
      milestoneInteractionPolicyService as any,
    );

    jest
      .spyOn(service as any, 'getTaskOrThrow')
      .mockResolvedValue({
        id: 'task-1',
        title: 'Implement task completion',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        status: TaskStatus.IN_REVIEW,
      });
    jest
      .spyOn(service as any, 'assertMilestoneInteractionAllowed')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'assertMilestoneEscrowFundedForWorkspace')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'getUnfinishedSubtasks')
      .mockResolvedValue([]);
    jest.spyOn(service as any, 'createHistory').mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'findTaskWithWorkspaceRelations')
      .mockResolvedValue({
        id: 'task-1',
        title: 'Implement task completion',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        status: TaskStatus.DONE,
      });
    jest
      .spyOn(service as any, 'calculateMilestoneProgress')
      .mockResolvedValue({
        progress: 100,
        totalTasks: 3,
        completedTasks: 3,
      });
    jest.spyOn(service as any, 'syncMilestoneStatus').mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'recordWorkspaceSystemMessage')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'emitTaskRealtimeEvent').mockImplementation(() => undefined);

    return {
      service,
      taskRepository,
      projectRepository,
      submissionRepository,
    };
  };

  const createPendingSubmission = () => ({
    id: 'submission-1',
    taskId: 'task-1',
    version: 2,
    status: TaskSubmissionStatus.PENDING,
    submitterId: 'freelancer-1',
    content: 'Ready for review',
    attachments: [],
    reviewNote: null,
    reviewerId: null,
    reviewedAt: null,
    brokerReviewNote: null,
    brokerReviewerId: null,
    brokerReviewedAt: null,
    clientReviewNote: null,
    clientReviewerId: null,
    clientReviewedAt: null,
    clientReviewDueAt: null,
    autoApprovedAt: null,
    createdAt: new Date('2026-04-13T07:00:00.000Z'),
    submitter: null,
    reviewer: null,
    brokerReviewer: null,
    clientReviewer: null,
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('marks the task DONE immediately when the broker approves a pending submission', async () => {
    jest.useFakeTimers().setSystemTime(fixedNow);
    const { service, submissionRepository, taskRepository } = createService();
    const pendingSubmission = createPendingSubmission();
    const hydratedSubmission = {
      ...pendingSubmission,
      status: TaskSubmissionStatus.APPROVED,
      brokerReviewerId: 'broker-1',
      brokerReviewedAt: fixedNow,
      brokerReviewNote: 'Looks good',
      reviewNote: 'Looks good',
      reviewerId: 'broker-1',
      reviewedAt: fixedNow,
      clientReviewDueAt: null,
    };

    submissionRepository.findOne
      .mockResolvedValueOnce(pendingSubmission)
      .mockResolvedValueOnce(hydratedSubmission);

    const result = await service.reviewSubmission(
      'task-1',
      'submission-1',
      {
        status: TaskSubmissionStatus.APPROVED,
        reviewNote: 'Looks good',
      },
      'broker-1',
      UserRole.BROKER,
    );

    expect(submissionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TaskSubmissionStatus.APPROVED,
        brokerReviewerId: 'broker-1',
        brokerReviewedAt: fixedNow,
        brokerReviewNote: 'Looks good',
        reviewNote: 'Looks good',
        reviewerId: 'broker-1',
        reviewedAt: fixedNow,
        clientReviewDueAt: null,
        clientReviewerId: null,
        clientReviewedAt: null,
        clientReviewNote: null,
      }),
    );
    expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
      status: TaskStatus.DONE,
      submittedAt: fixedNow,
    });
    expect(result.submission.status).toBe(TaskSubmissionStatus.APPROVED);
    expect(result.task.status).toBe(TaskStatus.DONE);
  });

  it('does not require client approval after broker approval for the new flow', async () => {
    jest.useFakeTimers().setSystemTime(fixedNow);
    const { service, submissionRepository } = createService();
    const approvedSubmission = {
      ...createPendingSubmission(),
      status: TaskSubmissionStatus.APPROVED,
      brokerReviewerId: 'broker-1',
      brokerReviewedAt: fixedNow,
      reviewedAt: fixedNow,
      reviewerId: 'broker-1',
    };

    submissionRepository.findOne.mockResolvedValue(approvedSubmission);

    await expect(
      service.reviewSubmission(
        'task-1',
        'submission-1',
        {
          status: TaskSubmissionStatus.APPROVED,
        },
        'client-1',
        UserRole.CLIENT,
      ),
    ).rejects.toThrow('This submission is no longer waiting for review.');
  });

  it('keeps completion side effects when broker approval finishes the task', async () => {
    jest.useFakeTimers().setSystemTime(fixedNow);
    const { service, submissionRepository } = createService();
    const pendingSubmission = createPendingSubmission();
    submissionRepository.findOne
      .mockResolvedValueOnce(pendingSubmission)
      .mockResolvedValueOnce({
        ...pendingSubmission,
        status: TaskSubmissionStatus.APPROVED,
      });

    await service.reviewSubmission(
      'task-1',
      'submission-1',
      {
        status: TaskSubmissionStatus.APPROVED,
        reviewNote: 'Ship it',
      },
      'broker-1',
      UserRole.BROKER,
    );

    expect((service as any).createHistory).toHaveBeenCalledWith(
      'task-1',
      'status',
      TaskStatus.IN_REVIEW,
      TaskStatus.DONE,
      'broker-1',
    );
    expect((service as any).syncMilestoneStatus).toHaveBeenCalledWith(
      'milestone-1',
      100,
      fixedNow,
    );
    expect((service as any).recordWorkspaceSystemMessage).toHaveBeenCalledWith(
      'project-1',
      'Broker approved submission V2 for task "Implement task completion". The task is now marked DONE.',
      'task-1',
    );
    expect((service as any).emitTaskRealtimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATED',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        milestoneProgress: 100,
      }),
    );
  });

  it('keeps request-changes flow unchanged for broker rejection paths', async () => {
    jest.useFakeTimers().setSystemTime(fixedNow);
    const { service, submissionRepository, taskRepository } = createService();
    const pendingSubmission = createPendingSubmission();

    jest
      .spyOn(service as any, 'findTaskWithWorkspaceRelations')
      .mockResolvedValueOnce({
        id: 'task-1',
        title: 'Implement task completion',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        status: TaskStatus.IN_PROGRESS,
      });

    submissionRepository.findOne
      .mockResolvedValueOnce(pendingSubmission)
      .mockResolvedValueOnce({
        ...pendingSubmission,
        status: TaskSubmissionStatus.REQUEST_CHANGES,
        brokerReviewerId: 'broker-1',
        brokerReviewedAt: fixedNow,
        brokerReviewNote: 'Fix edge cases',
        reviewNote: 'Fix edge cases',
        reviewerId: 'broker-1',
        reviewedAt: fixedNow,
      });

    const result = await service.reviewSubmission(
      'task-1',
      'submission-1',
      {
        status: TaskSubmissionStatus.REQUEST_CHANGES,
        reviewNote: 'Fix edge cases',
      },
      'broker-1',
      UserRole.BROKER,
    );

    expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
      status: TaskStatus.IN_PROGRESS,
      submittedAt: null,
    });
    expect(result.submission.status).toBe(TaskSubmissionStatus.REQUEST_CHANGES);
    expect(result.task.status).toBe(TaskStatus.IN_PROGRESS);
  });
});

describe('TasksService subtask DONE permissions', () => {
  const createService = () => {
    const taskRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const milestoneRepository = {};
    const escrowRepository = {};
    const projectRepository = {};
    const calendarEventRepository = {};
    const historyRepository = {};
    const commentRepository = {};
    const attachmentRepository = {};
    const taskLinkRepository = {};
    const submissionRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    const dataSource = {
      query: jest.fn(),
    };
    const auditLogsService = {
      logSystemIncident: jest.fn(),
    };
    const milestoneInteractionPolicyService = {
      assertMilestoneUnlockedForWorkspace: jest.fn(),
    };

    const service = new TasksService(
      taskRepository as any,
      milestoneRepository as any,
      escrowRepository as any,
      projectRepository as any,
      calendarEventRepository as any,
      historyRepository as any,
      commentRepository as any,
      attachmentRepository as any,
      taskLinkRepository as any,
      submissionRepository as any,
      dataSource as any,
      auditLogsService as any,
      milestoneInteractionPolicyService as any,
    );

    jest
      .spyOn(service as any, 'assertMilestoneAllowsTaskWorkById')
      .mockResolvedValue({ id: 'milestone-1' });
    jest
      .spyOn(service as any, 'assertMilestoneEscrowFundedForWorkspace')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'createHistory').mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'findTaskWithWorkspaceRelations')
      .mockResolvedValue({
        id: 'subtask-1',
        parentTaskId: 'task-1',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        status: TaskStatus.DONE,
      });
    jest
      .spyOn(service as any, 'calculateMilestoneProgress')
      .mockResolvedValue({ progress: 100, totalTasks: 1, completedTasks: 1 });
    jest.spyOn(service as any, 'syncMilestoneStatus').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'emitTaskRealtimeEvent').mockImplementation(() => undefined);

    return { service, taskRepository };
  };

  it('rejects moving a subtask to DONE when the actor is not a broker', async () => {
    const { service, taskRepository } = createService();
    taskRepository.findOne.mockResolvedValue({
      id: 'subtask-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      parentTaskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
    });

    await expect(
      service.updateTask(
        'subtask-1',
        { status: TaskStatus.DONE } as any,
        'client-1',
        UserRole.CLIENT,
      ),
    ).rejects.toThrow('Only brokers can move subtasks to DONE.');
  });

  it('rejects any subtask status change from freelancers', async () => {
    const { service, taskRepository } = createService();
    taskRepository.findOne.mockResolvedValue({
      id: 'subtask-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      parentTaskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
    });

    await expect(
      service.updateTask(
        'subtask-1',
        { status: TaskStatus.TODO } as any,
        'freelancer-1',
        UserRole.FREELANCER,
      ),
    ).rejects.toThrow('Freelancers are not allowed to change subtask status.');
  });

  it('allows brokers to move a subtask to DONE', async () => {
    const { service, taskRepository } = createService();
    taskRepository.findOne.mockResolvedValue({
      id: 'subtask-1',
      milestoneId: 'milestone-1',
      projectId: 'project-1',
      parentTaskId: 'task-1',
      status: TaskStatus.IN_PROGRESS,
      title: 'Subtask',
      priority: 'MEDIUM',
      storyPoints: null,
      description: null,
      assignedTo: null,
      labels: null,
    });

    const result = await service.updateTask(
      'subtask-1',
      { status: TaskStatus.DONE } as any,
      'broker-1',
      UserRole.BROKER,
    );

    expect(taskRepository.update).toHaveBeenCalledWith('subtask-1', { status: TaskStatus.DONE });
    expect(result.status).toBe(TaskStatus.DONE);
  });
});

describe('TasksService.deleteTask', () => {
  const createService = () => {
    const taskRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const milestoneRepository = {};
    const escrowRepository = {};
    const projectRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'project-1',
        brokerId: 'broker-1',
      }),
    };
    const calendarEventRepository = {};
    const historyRepository = {};
    const commentRepository = {};
    const attachmentRepository = {};
    const taskLinkRepository = {};
    const submissionRepository = {};
    const dataSource = {
      query: jest.fn(),
    };
    const auditLogsService = {
      logSystemIncident: jest.fn(),
    };
    const milestoneInteractionPolicyService = {
      assertMilestoneUnlockedForWorkspace: jest.fn(),
    };

    const service = new TasksService(
      taskRepository as any,
      milestoneRepository as any,
      escrowRepository as any,
      projectRepository as any,
      calendarEventRepository as any,
      historyRepository as any,
      commentRepository as any,
      attachmentRepository as any,
      taskLinkRepository as any,
      submissionRepository as any,
      dataSource as any,
      auditLogsService as any,
      milestoneInteractionPolicyService as any,
    );

    jest
      .spyOn(service as any, 'getTaskOrThrow')
      .mockResolvedValue({
        id: 'task-1',
        title: 'Delete me',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        parentTaskId: null,
        status: TaskStatus.IN_PROGRESS,
      });
    jest
      .spyOn(service as any, 'assertMilestoneAllowsTaskWorkById')
      .mockResolvedValue({ id: 'milestone-1' });
    jest
      .spyOn(service as any, 'assertMilestoneEscrowFundedForWorkspace')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'recordWorkspaceSystemMessage')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'emitWorkspaceRefreshForTask')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'calculateMilestoneProgress')
      .mockResolvedValue({ progress: 0, totalTasks: 0, completedTasks: 0 });
    jest.spyOn(service as any, 'syncMilestoneStatus').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'emitTaskRealtimeEvent').mockImplementation(() => undefined);

    return { service, taskRepository, projectRepository };
  };

  it('allows the assigned broker to delete a task', async () => {
    const { service, taskRepository } = createService();

    await service.deleteTask('task-1', 'broker-1', UserRole.BROKER);

    expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
    expect((service as any).emitTaskRealtimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETED',
        projectId: 'project-1',
        taskId: 'task-1',
        milestoneId: 'milestone-1',
      }),
    );
    expect((service as any).recordWorkspaceSystemMessage).toHaveBeenCalledWith(
      'project-1',
      'Task "Delete me" was deleted from the workspace.',
      'task-1',
    );
  });

  it('rejects non-broker users from deleting tasks', async () => {
    const { service } = createService();

    await expect(service.deleteTask('task-1', 'client-1', UserRole.CLIENT)).rejects.toThrow(
      'Only brokers can delete tasks in project workspace.',
    );
  });

  it('rejects deleting tasks that are already in review or done', async () => {
    const { service } = createService();
    jest
      .spyOn(service as any, 'getTaskOrThrow')
      .mockResolvedValueOnce({
        id: 'task-1',
        title: 'Locked task',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        parentTaskId: null,
        status: TaskStatus.IN_REVIEW,
      });

    await expect(service.deleteTask('task-1', 'broker-1', UserRole.BROKER)).rejects.toThrow(
      'Tasks in review or done cannot be deleted.',
    );
  });
});
