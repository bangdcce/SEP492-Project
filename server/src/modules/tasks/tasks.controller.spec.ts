import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { UserRole } from '../../database/entities/user.entity';
import { TaskSubmissionStatus } from './entities/task-submission.entity';
import { TasksController } from './tasks.controller';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: Record<string, jest.Mock>;

  beforeEach(() => {
    tasksService = {
      getProjectRecentActivity: jest.fn(),
      getTaskHistory: jest.fn(),
      getTaskComments: jest.fn(),
      getTaskSubmissions: jest.fn(),
      uploadFile: jest.fn(),
      addComment: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      submitWork: jest.fn(),
      reviewSubmission: jest.fn(),
    };

    controller = new TasksController(tasksService as any);
  });

  describe('getProjectRecentActivity', () => {
    it('UC36-RECENT-UTCID01 forwards the project id and returns the recent activity list', async () => {
      const activity = [
        {
          id: 'history-1',
          taskId: 'task-1',
          fieldChanged: 'status',
          oldValue: 'IN_PROGRESS',
          newValue: 'DONE',
        },
      ];
      tasksService.getProjectRecentActivity.mockResolvedValue(activity);

      await expect(controller.getProjectRecentActivity('project-1')).resolves.toEqual(activity);
      expect(tasksService.getProjectRecentActivity).toHaveBeenCalledWith('project-1');
    });

    it('UC36-RECENT-UTCID02 propagates service failures for an unknown project id', async () => {
      tasksService.getProjectRecentActivity.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(controller.getProjectRecentActivity('missing-project')).rejects.toThrow(
        NotFoundException,
      );
      expect(tasksService.getProjectRecentActivity).toHaveBeenCalledWith('missing-project');
    });

    it('UC36-RECENT-UTCID03 returns an empty activity list when the project has no tracked history yet', async () => {
      tasksService.getProjectRecentActivity.mockResolvedValue([]);

      await expect(controller.getProjectRecentActivity('project-empty')).resolves.toEqual([]);
      expect(tasksService.getProjectRecentActivity).toHaveBeenCalledWith('project-empty');
    });
  });

  describe('getTaskHistory', () => {
    it('UC36-HISTORY-UTCID01 forwards the task id and returns the task history list', async () => {
      const history = [{ id: 'history-1', fieldChanged: 'status', oldValue: 'TODO', newValue: 'DONE' }];
      tasksService.getTaskHistory.mockResolvedValue(history);

      await expect(controller.getTaskHistory('task-1')).resolves.toEqual(history);
      expect(tasksService.getTaskHistory).toHaveBeenCalledWith('task-1');
    });

    it('UC36-HISTORY-UTCID02 bubbles up task-history lookup failures', async () => {
      tasksService.getTaskHistory.mockRejectedValue(new NotFoundException('Task not found'));

      await expect(controller.getTaskHistory('task-missing')).rejects.toThrow(NotFoundException);
      expect(tasksService.getTaskHistory).toHaveBeenCalledWith('task-missing');
    });

    it('UC36-HISTORY-UTCID03 returns an empty history list when the task has not changed yet', async () => {
      tasksService.getTaskHistory.mockResolvedValue([]);

      await expect(controller.getTaskHistory('task-clean')).resolves.toEqual([]);
      expect(tasksService.getTaskHistory).toHaveBeenCalledWith('task-clean');
    });
  });

  describe('getTaskComments', () => {
    it('UC37-COMMENTS-UTCID01 forwards the task id and returns sanitized comments from the service', async () => {
      const comments = [{ id: 'comment-1', content: '<p>Hello</p>', actorId: 'user-1' }];
      tasksService.getTaskComments.mockResolvedValue(comments);

      await expect(controller.getTaskComments('task-1')).resolves.toEqual(comments);
      expect(tasksService.getTaskComments).toHaveBeenCalledWith('task-1');
    });

    it('UC37-COMMENTS-UTCID02 propagates task-comment lookup failures', async () => {
      tasksService.getTaskComments.mockRejectedValue(new NotFoundException('Task not found'));

      await expect(controller.getTaskComments('task-missing')).rejects.toThrow(NotFoundException);
      expect(tasksService.getTaskComments).toHaveBeenCalledWith('task-missing');
    });

    it('UC37-COMMENTS-UTCID03 returns an empty comment list when the discussion has not started', async () => {
      tasksService.getTaskComments.mockResolvedValue([]);

      await expect(controller.getTaskComments('task-silent')).resolves.toEqual([]);
      expect(tasksService.getTaskComments).toHaveBeenCalledWith('task-silent');
    });
  });

  describe('getTaskSubmissions', () => {
    it('UC59-SUBMISSIONS-UTCID01 forwards the task id and returns task submissions', async () => {
      const submissions = [
        { id: 'submission-2', taskId: 'task-1', version: 2 },
        { id: 'submission-1', taskId: 'task-1', version: 1 },
      ];
      tasksService.getTaskSubmissions.mockResolvedValue(submissions);

      await expect(controller.getTaskSubmissions('task-1')).resolves.toEqual(submissions);
      expect(tasksService.getTaskSubmissions).toHaveBeenCalledWith('task-1');
    });

    it('UC59-SUBMISSIONS-UTCID02 propagates task-submission lookup failures', async () => {
      tasksService.getTaskSubmissions.mockRejectedValue(new NotFoundException('Task not found'));

      await expect(controller.getTaskSubmissions('task-missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(tasksService.getTaskSubmissions).toHaveBeenCalledWith('task-missing');
    });

    it('UC59-SUBMISSIONS-UTCID03 returns an empty submission list when no work has been submitted yet', async () => {
      tasksService.getTaskSubmissions.mockResolvedValue([]);

      await expect(controller.getTaskSubmissions('task-open')).resolves.toEqual([]);
      expect(tasksService.getTaskSubmissions).toHaveBeenCalledWith('task-open');
    });
  });

  describe('uploadAttachment', () => {
    it('UC37-UPLOAD-UTCID01 uploads the provided file through TasksService.uploadFile', async () => {
      const file = {
        originalname: 'evidence.png',
        mimetype: 'image/png',
        buffer: Buffer.from('binary'),
      } as Express.Multer.File;
      const uploaded = { url: 'https://cdn.example.com/evidence.png' };
      tasksService.uploadFile.mockResolvedValue(uploaded);

      await expect(controller.uploadAttachment(file)).resolves.toEqual(uploaded);
      expect(tasksService.uploadFile).toHaveBeenCalledWith(file);
    });

    it('UC37-UPLOAD-UTCID02 rejects requests that omit the file payload', async () => {
      await expect(controller.uploadAttachment(undefined as any)).rejects.toThrow(
        new BadRequestException('File is required'),
      );
      expect(tasksService.uploadFile).not.toHaveBeenCalled();
    });

    it('UC37-UPLOAD-UTCID03 still forwards zero-byte files because the controller only validates file presence', async () => {
      const file = {
        originalname: 'empty.txt',
        mimetype: 'text/plain',
        buffer: Buffer.alloc(0),
      } as Express.Multer.File;
      const uploaded = { url: 'https://cdn.example.com/empty.txt' };
      tasksService.uploadFile.mockResolvedValue(uploaded);

      await expect(controller.uploadAttachment(file)).resolves.toEqual(uploaded);
      expect(tasksService.uploadFile).toHaveBeenCalledWith(file);
    });
  });

  describe('addComment', () => {
    it('UC37-ADDCOMMENT-UTCID01 passes the task id, content, and authenticated user id to the service', async () => {
      const savedComment = {
        id: 'comment-1',
        taskId: 'task-1',
        content: '<p>Looks good</p>',
        actorId: 'user-1',
      };
      tasksService.addComment.mockResolvedValue(savedComment);

      await expect(
        controller.addComment('task-1', { content: 'Looks good' } as any, {
          user: { id: 'user-1', role: UserRole.CLIENT },
        } as any),
      ).resolves.toEqual(savedComment);
      expect(tasksService.addComment).toHaveBeenCalledWith('task-1', 'Looks good', 'user-1');
    });

    it('UC37-ADDCOMMENT-UTCID02 falls back to SYSTEM when the authenticated user is unavailable', async () => {
      const savedComment = {
        id: 'comment-2',
        taskId: 'task-1',
        content: '<p>System note</p>',
        actorId: 'SYSTEM',
      };
      tasksService.addComment.mockResolvedValue(savedComment);

      await expect(
        controller.addComment('task-1', { content: 'System note' } as any, {} as any),
      ).resolves.toEqual(savedComment);
      expect(tasksService.addComment).toHaveBeenCalledWith('task-1', 'System note', 'SYSTEM');
    });

    it('UC37-ADDCOMMENT-UTCID03 forwards whitespace-only comments because validation happens downstream', async () => {
      const savedComment = {
        id: 'comment-3',
        taskId: 'task-1',
        content: '   ',
        actorId: 'user-1',
      };
      tasksService.addComment.mockResolvedValue(savedComment);

      await expect(
        controller.addComment('task-1', { content: '   ' } as any, {
          user: { id: 'user-1', role: UserRole.CLIENT },
        } as any),
      ).resolves.toEqual(savedComment);
      expect(tasksService.addComment).toHaveBeenCalledWith('task-1', '   ', 'user-1');
    });
  });

  describe('updateComment', () => {
    it('UC37-UPDATECOMMENT-UTCID01 passes the comment id, content, and authenticated user id to the service', async () => {
      const updatedComment = {
        id: 'comment-1',
        taskId: 'task-1',
        content: '<p>Updated</p>',
        actorId: 'user-1',
      };
      tasksService.updateComment.mockResolvedValue(updatedComment);

      await expect(
        controller.updateComment('comment-1', { content: 'Updated' } as any, {
          user: { id: 'user-1', role: UserRole.CLIENT },
        } as any),
      ).resolves.toEqual(updatedComment);
      expect(tasksService.updateComment).toHaveBeenCalledWith('comment-1', 'user-1', 'Updated');
    });

    it('UC37-UPDATECOMMENT-UTCID02 rejects unauthenticated edit attempts before touching the service', async () => {
      expect(() =>
        controller.updateComment('comment-1', { content: 'Updated' } as any, {} as any),
      ).toThrow(new ForbiddenException('Authentication required'));
      expect(tasksService.updateComment).not.toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('UC37-DELETECOMMENT-UTCID01 passes the comment id, authenticated user id, and role to the service', async () => {
      tasksService.deleteComment.mockResolvedValue(undefined);

      await expect(
        controller.deleteComment('comment-1', {
          user: { id: 'admin-1', role: UserRole.ADMIN },
        } as any),
      ).resolves.toEqual({ success: true });
      expect(tasksService.deleteComment).toHaveBeenCalledWith(
        'comment-1',
        'admin-1',
        UserRole.ADMIN,
      );
    });

    it('UC37-DELETECOMMENT-UTCID02 rejects unauthenticated delete attempts before touching the service', async () => {
      await expect(controller.deleteComment('comment-1', {} as any)).rejects.toThrow(
        new ForbiddenException('Authentication required'),
      );
      expect(tasksService.deleteComment).not.toHaveBeenCalled();
    });
  });

  describe('submitWork', () => {
    it('UC59-SUBMITWORK-UTCID01 passes the submission dto and authenticated user id to the service', async () => {
      const dto = {
        content: 'Completed implementation',
        attachments: ['https://cdn.example.com/build-log.txt'],
      };
      const savedSubmission = {
        id: 'submission-1',
        taskId: 'task-1',
        version: 1,
        status: TaskSubmissionStatus.PENDING,
      };
      tasksService.submitWork.mockResolvedValue(savedSubmission);

      await expect(
        controller.submitWork('task-1', dto as any, {
          user: { id: 'freelancer-1', role: UserRole.FREELANCER },
        } as any),
      ).resolves.toEqual(savedSubmission);
      expect(tasksService.submitWork).toHaveBeenCalledWith('task-1', dto, 'freelancer-1');
    });

    it('UC59-SUBMITWORK-UTCID02 falls back to SYSTEM when the request has no authenticated user', async () => {
      const dto = { content: 'Fallback submission' };
      const savedSubmission = {
        id: 'submission-2',
        taskId: 'task-1',
        version: 2,
        status: TaskSubmissionStatus.PENDING,
      };
      tasksService.submitWork.mockResolvedValue(savedSubmission);

      await expect(controller.submitWork('task-1', dto as any, {} as any)).resolves.toEqual(
        savedSubmission,
      );
      expect(tasksService.submitWork).toHaveBeenCalledWith('task-1', dto, 'SYSTEM');
    });

    it('UC59-SUBMITWORK-UTCID03 forwards an explicitly empty attachment list for a normal authenticated submission', async () => {
      const dto = {
        content: 'Completed implementation without files',
        attachments: [],
      };
      const savedSubmission = {
        id: 'submission-3',
        taskId: 'task-1',
        version: 3,
        status: TaskSubmissionStatus.PENDING,
      };
      tasksService.submitWork.mockResolvedValue(savedSubmission);

      await expect(
        controller.submitWork('task-1', dto as any, {
          user: { id: 'freelancer-1', role: UserRole.FREELANCER },
        } as any),
      ).resolves.toEqual(savedSubmission);
      expect(tasksService.submitWork).toHaveBeenCalledWith('task-1', dto, 'freelancer-1');
    });
  });

  describe('reviewSubmission', () => {
    const dto = {
      status: TaskSubmissionStatus.APPROVED,
      reviewNote: 'Looks good',
    };

    it('UC106-REVIEWSUBMISSION-UTCID01 allows a client reviewer and forwards the review to the service', async () => {
      const result = {
        submission: { id: 'submission-1', status: TaskSubmissionStatus.APPROVED },
        task: { id: 'task-1', status: 'DONE' },
      };
      tasksService.reviewSubmission.mockResolvedValue(result);

      await expect(
        controller.reviewSubmission('task-1', 'submission-1', dto as any, {
          user: { id: 'client-1', role: UserRole.CLIENT },
        } as any),
      ).resolves.toEqual(result);
      expect(tasksService.reviewSubmission).toHaveBeenCalledWith(
        'task-1',
        'submission-1',
        dto,
        'client-1',
        UserRole.CLIENT,
      );
    });

    it('UC106-REVIEWSUBMISSION-UTCID02 also accepts lowercase broker roles after controller normalization', async () => {
      const result = {
        submission: { id: 'submission-1', status: TaskSubmissionStatus.REQUEST_CHANGES },
        task: { id: 'task-1', status: 'IN_PROGRESS' },
      };
      const requestDto = {
        status: TaskSubmissionStatus.REQUEST_CHANGES,
        reviewNote: 'Need another revision',
      };
      tasksService.reviewSubmission.mockResolvedValue(result);

      await expect(
        controller.reviewSubmission('task-1', 'submission-1', requestDto as any, {
          user: { id: 'broker-1', role: 'broker' },
        } as any),
      ).resolves.toEqual(result);
      expect(tasksService.reviewSubmission).toHaveBeenCalledWith(
        'task-1',
        'submission-1',
        requestDto,
        'broker-1',
        'broker',
      );
    });

    it('UC106-REVIEWSUBMISSION-UTCID03 rejects unauthenticated review requests before reaching the service', async () => {
      await expect(
        controller.reviewSubmission('task-1', 'submission-1', dto as any, {} as any),
      ).rejects.toThrow(new ForbiddenException('Authentication required'));
      expect(tasksService.reviewSubmission).not.toHaveBeenCalled();
    });

    it('UC106-REVIEWSUBMISSION-UTCID04 rejects freelancer reviewers because they cannot review their own work', async () => {
      await expect(
        controller.reviewSubmission('task-1', 'submission-1', dto as any, {
          user: { id: 'freelancer-1', role: UserRole.FREELANCER },
        } as any),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only Clients or Brokers can review submissions. Freelancers cannot review their own work.',
        ),
      );
      expect(tasksService.reviewSubmission).not.toHaveBeenCalled();
    });

    it('UC106-REVIEWSUBMISSION-UTCID05 rejects admin reviewers because the controller only allows client or broker roles', async () => {
      await expect(
        controller.reviewSubmission('task-1', 'submission-1', dto as any, {
          user: { id: 'admin-1', role: UserRole.ADMIN },
        } as any),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only Clients or Brokers can review submissions. Freelancers cannot review their own work.',
        ),
      );
      expect(tasksService.reviewSubmission).not.toHaveBeenCalled();
    });

    it('UC106-REVIEWSUBMISSION-UTCID06 propagates service failures after an allowed reviewer passes controller checks', async () => {
      tasksService.reviewSubmission.mockRejectedValue(new NotFoundException('Submission not found'));

      await expect(
        controller.reviewSubmission('task-1', 'submission-missing', dto as any, {
          user: { id: 'client-1', role: UserRole.CLIENT },
        } as any),
      ).rejects.toThrow(NotFoundException);
      expect(tasksService.reviewSubmission).toHaveBeenCalledWith(
        'task-1',
        'submission-missing',
        dto,
        'client-1',
        UserRole.CLIENT,
      );
    });
  });
});
