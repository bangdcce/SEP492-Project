import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  InternalServerErrorException,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import Decimal from 'decimal.js';
import { TaskEntity, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity, EscrowStatus } from '../../database/entities/escrow.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { UserRole } from '../../database/entities/user.entity';
import {
  CalendarEventEntity,
  EventType,
  EventStatus,
  EventPriority,
} from '../../database/entities/calendar-event.entity';
import { TaskHistoryEntity } from '../../database/entities/task-history.entity';
import { TaskCommentEntity } from '../../database/entities/task-comment.entity';
import { TaskAttachmentEntity } from './entities/task-attachment.entity';
import { TaskLinkEntity } from './entities/task-link.entity';
import { TaskSubmissionEntity, TaskSubmissionStatus } from './entities/task-submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { WorkspaceChatService } from '../workspace-chat/workspace-chat.service';
import { TasksRealtimeBridge } from './tasks.realtime';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MilestoneInteractionPolicyService } from '../projects/milestone-interaction-policy.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  type MilestoneDisputePolicy,
  resolveMilestoneDisputePolicy,
} from '../disputes/dispute-milestone-policy';

/**
 * Response type for submission review
 */
export interface SubmissionReviewResult {
  submission: TaskSubmissionEntity;
  task: TaskEntity;
  milestoneId: string;
  milestoneProgress: number;
  totalTasks: number;
  completedTasks: number;
}

export interface KanbanBoard {
  TODO: TaskEntity[];
  IN_PROGRESS: TaskEntity[];
  IN_REVIEW: TaskEntity[];
  DONE: TaskEntity[];
}

export interface WorkspaceMilestoneEscrowSummary {
  id: string;
  status: string;
  totalAmount: number;
  fundedAmount: number;
  releasedAmount: number;
  developerShare: number;
  brokerShare: number;
  platformFee: number;
  currency: string;
  fundedAt: Date | null;
  releasedAt: Date | null;
  refundedAt: Date | null;
  updatedAt: Date;
}

export interface WorkspaceMilestoneView extends MilestoneEntity {
  escrow: WorkspaceMilestoneEscrowSummary | null;
  disputePolicy: MilestoneDisputePolicy;
}

export interface BoardWithMilestones {
  tasks: KanbanBoard;
  milestones: WorkspaceMilestoneView[];
}

export type KanbanStatus =
  | TaskStatus.TODO
  | TaskStatus.IN_PROGRESS
  | TaskStatus.IN_REVIEW
  | TaskStatus.DONE;

/**
 * Response type for task status update
 * Includes the updated task AND milestone progress for real-time UI updates
 */
export interface TaskStatusUpdateResult {
  task: TaskEntity;
  milestoneId: string;
  milestoneProgress: number; // 0-100 percentage
  totalTasks: number;
  completedTasks: number;
}

export interface ProjectRecentActivityItem {
  id: string;
  taskId: string;
  actorId?: string;
  actor?: {
    id: string;
    fullName: string;
  } | null;
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  createdAt: Date;
  task: {
    id: string;
    title: string;
    status: TaskStatus;
  };
}

export interface TaskCommentItem {
  id: string;
  taskId: string;
  actorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  actor: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  } | null;
}

export interface TaskCommentMutationResult {
  comment: TaskCommentItem;
  task?: TaskEntity | null;
}

export interface TaskSubmissionCreateResult {
  submission: TaskSubmissionEntity;
  task: TaskEntity;
}

export interface ProjectTaskRealtimeEvent {
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  projectId: string;
  task?: TaskEntity | null;
  taskId?: string;
  milestoneId?: string | null;
  milestoneProgress?: number;
  totalTasks?: number;
  completedTasks?: number;
}

const COMMENT_SANITIZE_OPTIONS = {
  allowedTags: [
    'p',
    'br',
    'div',
    'label',
    'input',
    'strong',
    'em',
    's',
    'u',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'h4',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    '*': ['data-type', 'data-checked'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    code: ['class'],
    pre: ['class'],
    input: ['type', 'checked', 'disabled'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  transformTags: {
    a: (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    input: (tagName: string, attribs: Record<string, string>) => {
      const isChecked =
        attribs.checked === 'checked' || attribs.checked === 'true' || attribs.checked === '';

      return {
        tagName,
        attribs: {
          type: 'checkbox',
          checked: isChecked ? 'checked' : undefined,
          disabled: 'true',
        },
      };
    },
  },
};

const ATTACHMENT_BUCKET =
  process.env.SUPABASE_ATTACHMENTS_BUCKET || process.env.SUPABASE_BUCKET || 'task-attachments';

const TASK_CREATION_ALLOWED_MILESTONE_STATUSES = new Set<MilestoneStatus>([
  MilestoneStatus.PENDING,
  MilestoneStatus.IN_PROGRESS,
  MilestoneStatus.REVISIONS_REQUIRED,
]);

const TASK_CREATION_LOCK_MESSAGE =
  'Tasks can only be created while the milestone is pending, in progress, or revisions required.';

const TASK_WORK_LOCK_MESSAGE =
  'Task changes are locked because this milestone is in review, completed, paid, or locked.';

const FINAL_APPROVED_SUBMISSION_STATUSES = [
  TaskSubmissionStatus.APPROVED,
  TaskSubmissionStatus.AUTO_APPROVED,
] as const;

const ACTIVE_SUBMISSION_REVIEW_STATUSES = [
  TaskSubmissionStatus.PENDING,
  TaskSubmissionStatus.PENDING_CLIENT_REVIEW,
] as const;

const TASK_ESCROW_FUNDING_LOCK_MESSAGE =
  'Milestone workspace is locked until escrow is fully funded.';

const TASK_SUBMISSION_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const TASK_WORKSPACE_RELATIONS = [
  'assignee',
  'reporter',
  'attachments',
  'submissions',
  'submissions.submitter',
  'submissions.reviewer',
  'submissions.brokerReviewer',
  'submissions.clientReviewer',
] as const;

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);
  private supabase: SupabaseClient | null = null;

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(MilestoneEntity)
    private readonly milestoneRepository: Repository<MilestoneEntity>,
    @InjectRepository(EscrowEntity)
    private readonly escrowRepository: Repository<EscrowEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly calendarEventRepository: Repository<CalendarEventEntity>,
    @InjectRepository(TaskHistoryEntity)
    private readonly historyRepository: Repository<TaskHistoryEntity>,
    @InjectRepository(TaskCommentEntity)
    private readonly commentRepository: Repository<TaskCommentEntity>,
    @InjectRepository(TaskAttachmentEntity)
    private readonly attachmentRepository: Repository<TaskAttachmentEntity>,
    @InjectRepository(TaskLinkEntity)
    private readonly taskLinkRepository: Repository<TaskLinkEntity>,
    @InjectRepository(TaskSubmissionEntity)
    private readonly submissionRepository: Repository<TaskSubmissionEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AuditLogsService,
    private readonly milestoneInteractionPolicyService: MilestoneInteractionPolicyService,
    @Optional()
    private readonly workspaceChatService?: WorkspaceChatService,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTaskQueryIndexes();
  }

  private async ensureTaskQueryIndexes(): Promise<void> {
    const statements = [
      `CREATE INDEX IF NOT EXISTS "IDX_task_comments_taskId_createdAt" ON "task_comments" ("taskId", "createdAt" DESC)`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_comments_actorId" ON "task_comments" ("actorId")`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_submissions_taskId_version" ON "task_submissions" ("taskId", "version" DESC)`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_submissions_status_clientReviewDueAt" ON "task_submissions" ("status", "clientReviewDueAt")`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_attachments_taskId" ON "task_attachments" ("taskId")`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_attachments_taskId_url" ON "task_attachments" ("taskId", "url")`,
    ];

    for (const statement of statements) {
      try {
        await this.dataSource.query(statement);
      } catch (error) {
        this.logger.warn(
          `Task query index bootstrap skipped: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }

  private async recordWorkspaceSystemMessage(
    projectId: string,
    content: string,
    taskId?: string | null,
  ): Promise<void> {
    if (!this.workspaceChatService) {
      return;
    }

    try {
      await this.workspaceChatService.createSystemMessage(projectId, content, {
        taskId: taskId ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `Workspace audit message skipped for project ${projectId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async recordWorkspaceSystemMessageOnce(
    projectId: string,
    content: string,
    taskId?: string | null,
  ): Promise<boolean> {
    if (!this.workspaceChatService) {
      return false;
    }

    try {
      const message = await this.workspaceChatService.createSystemMessageOnce(projectId, content, {
        taskId: taskId ?? null,
      });
      return Boolean(message);
    } catch (error) {
      this.logger.warn(
        `Workspace one-time audit message skipped for project ${projectId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  private async getProjectParticipantIds(projectId: string): Promise<string[]> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      select: ['id', 'clientId', 'brokerId', 'freelancerId'],
    });

    if (!project) {
      return [];
    }

    return Array.from(
      new Set([project.clientId, project.brokerId, project.freelancerId].filter(Boolean)),
    ).filter((userId): userId is string => Boolean(userId));
  }

  private async notifyProjectParticipants(
    projectId: string,
    title: string,
    body: string,
    relatedType: string,
    relatedId: string,
  ): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    try {
      const recipientIds = await this.getProjectParticipantIds(projectId);
      if (recipientIds.length === 0) {
        return;
      }

      await this.notificationsService.createMany(
        recipientIds.map((userId) => ({
          userId,
          title,
          body,
          relatedType,
          relatedId,
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Project participant notification skipped for project ${projectId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private formatDeadlineForDisplay(value: Date): string {
    return `${value.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })} UTC`;
  }

  private buildNullableTimestampUpdate(value: Date | null): Date | (() => string) {
    return value ?? (() => 'NULL');
  }

  private resolveSubmissionDeadline(
    task: Pick<TaskEntity, 'dueDate'>,
    milestone?: Pick<MilestoneEntity, 'dueDate'> | null,
  ): Date | null {
    return task.dueDate ?? milestone?.dueDate ?? null;
  }

  private isSubmissionDeadlinePassed(deadline: Date | null, referenceDate = new Date()): boolean {
    return Boolean(deadline) && referenceDate.getTime() > deadline!.getTime();
  }

  private async getMilestoneSubmissionDeadlineContext(
    milestoneId: string,
  ): Promise<Pick<MilestoneEntity, 'id' | 'projectId' | 'status' | 'dueDate' | 'title'>> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: milestoneId },
      select: ['id', 'projectId', 'status', 'dueDate', 'title'],
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    return milestone;
  }

  private async hasSubmissionWorkflowStarted(taskId: string): Promise<boolean> {
    const submissionCount = await this.submissionRepository.count({
      where: {
        taskId,
        status: In([...ACTIVE_SUBMISSION_REVIEW_STATUSES, ...FINAL_APPROVED_SUBMISSION_STATUSES]),
      },
    });

    return submissionCount > 0;
  }

  private async announceSubmissionDeadlineReminder(
    task: Pick<TaskEntity, 'id' | 'title' | 'projectId'>,
    deadline: Date,
  ): Promise<void> {
    const deadlineLabel = this.formatDeadlineForDisplay(deadline);
    const message = `Reminder: Freelancer submission for task "${task.title}" is due by ${deadlineLabel}. After that deadline passes, no new submission can be sent.`;
    const created = await this.recordWorkspaceSystemMessageOnce(task.projectId, message, task.id);

    if (!created) {
      return;
    }

    await this.notifyProjectParticipants(
      task.projectId,
      'Task submission deadline approaching',
      `Task "${task.title}" must be submitted by ${deadlineLabel}. After the deadline, submissions are locked.`,
      'Task',
      task.id,
    );
  }

  private async announceSubmissionDeadlineClosed(
    task: Pick<TaskEntity, 'id' | 'title' | 'projectId'>,
    deadline: Date,
  ): Promise<void> {
    const deadlineLabel = this.formatDeadlineForDisplay(deadline);
    const message = `Submission locked: Task "${task.title}" passed its deadline at ${deadlineLabel}, so the freelancer can no longer submit a new version.`;
    const created = await this.recordWorkspaceSystemMessageOnce(task.projectId, message, task.id);

    if (!created) {
      return;
    }

    await this.notifyProjectParticipants(
      task.projectId,
      'Task submission locked after due date',
      `Task "${task.title}" passed its deadline at ${deadlineLabel}. New freelancer submissions are no longer allowed.`,
      'Task',
      task.id,
    );
  }

  private async notifyTaskStatusTransition(
    task: Pick<TaskEntity, 'id' | 'title' | 'projectId'>,
    previousStatus: TaskStatus,
    nextStatus: TaskStatus,
    actorId?: string,
  ): Promise<void> {
    if (!this.notificationsService || previousStatus === nextStatus) {
      return;
    }

    try {
      const project = await this.projectRepository.findOne({
        where: { id: task.projectId },
        select: ['id', 'clientId', 'brokerId', 'freelancerId', 'staffId'],
      });

      if (!project) {
        return;
      }

      const recipientIds = Array.from(
        new Set(
          [project.clientId, project.brokerId, project.freelancerId, project.staffId].filter(
            Boolean,
          ),
        ),
      ).filter((userId): userId is string => Boolean(userId) && userId !== actorId);

      if (recipientIds.length === 0) {
        return;
      }

      await this.notificationsService.createMany(
        recipientIds.map((userId) => ({
          userId,
          title: 'Task status updated',
          body: `Task "${task.title}" moved from ${previousStatus} to ${nextStatus}.`,
          relatedType: 'Project',
          relatedId: task.projectId,
        })),
      );
    } catch (error) {
      this.logger.warn(
        `Task status notification skipped for task ${task.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) {
      return this.supabase;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      void this.auditLogsService.logSystemIncident({
        component: 'TasksService',
        operation: 'get-supabase-client',
        summary: 'Task attachment storage is unavailable because Supabase configuration is missing',
        severity: 'CRITICAL',
        category: 'STORAGE',
        errorCode: 'SUPABASE_CONFIG_MISSING',
        target: {
          type: 'StorageBucket',
          id: ATTACHMENT_BUCKET,
          label: ATTACHMENT_BUCKET,
        },
      });
      throw new InternalServerErrorException('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return this.supabase;
  }

  private sanitizeAttachmentFileName(fileName: string): string {
    const trimmedName = path.basename(String(fileName || '').trim());
    const sanitized = Array.from(trimmedName)
      .filter((char) => char.charCodeAt(0) >= 32)
      .join('')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/\.{2,}/g, '.')
      .trim();

    return sanitized || 'attachment';
  }

  private buildAttachmentPath(fileName: string): string {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sanitizedFileName = this.sanitizeAttachmentFileName(fileName);

    return `comments/${unique}/${sanitizedFileName}`;
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; fileName: string; fileType: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    const supabase = this.getSupabaseClient();
    const bucketName = ATTACHMENT_BUCKET;
    const originalFileName = this.sanitizeAttachmentFileName(file.originalname || 'attachment');
    const fileType = file.mimetype || 'application/octet-stream';
    this.logger.log(`Uploading to bucket: ${bucketName}`);
    const storagePath = this.buildAttachmentPath(originalFileName);

    const { error } = await supabase.storage.from(bucketName).upload(storagePath, file.buffer, {
      contentType: fileType,
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      await this.auditLogsService.logSystemIncident({
        component: 'TasksService',
        operation: 'upload-file',
        summary: 'Task attachment upload failed',
        severity: 'HIGH',
        category: 'STORAGE',
        error,
        target: {
          type: 'StorageBucket',
          id: ATTACHMENT_BUCKET,
          label: ATTACHMENT_BUCKET,
        },
        context: {
          bucket: ATTACHMENT_BUCKET,
          storagePath,
          fileName: originalFileName,
          mimeType: fileType,
        },
      });
      throw new InternalServerErrorException('Failed to upload attachment');
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

    if (!data?.publicUrl) {
      throw new InternalServerErrorException('Upload succeeded, but public URL is missing');
    }

    return {
      url: data.publicUrl,
      fileName: originalFileName,
      fileType,
    };
  }

  async getTaskHistory(taskId: string): Promise<TaskHistoryEntity[]> {
    return this.historyRepository.find({
      where: { taskId },
      relations: ['actor'],
      order: { createdAt: 'DESC' },
    });
  }

  async getProjectRecentActivity(
    projectId: string,
    limit = 5,
  ): Promise<ProjectRecentActivityItem[]> {
    const history = await this.historyRepository
      .createQueryBuilder('history')
      .innerJoinAndSelect('history.task', 'task')
      .leftJoinAndSelect('history.actor', 'actor')
      .where('task.projectId = :projectId', { projectId })
      .andWhere('task.parentTaskId IS NULL')
      .orderBy('history.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return history.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      actorId: item.actorId,
      actor: item.actor
        ? {
            id: item.actor.id,
            fullName: item.actor.fullName,
          }
        : null,
      fieldChanged: item.fieldChanged,
      oldValue: item.oldValue,
      newValue: item.newValue,
      createdAt: item.createdAt,
      task: {
        id: item.task.id,
        title: item.task.title,
        status: item.task.status,
      },
    }));
  }

  private sanitizeCommentContent(content: string): string {
    return sanitizeHtml(content, COMMENT_SANITIZE_OPTIONS).trim();
  }

  private async getTaskOrThrow(taskId: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private async ensureTaskExists(taskId: string): Promise<void> {
    await this.getTaskOrThrow(taskId);
  }

  private isFinalApprovedSubmissionStatus(status?: TaskSubmissionStatus | null): boolean {
    return FINAL_APPROVED_SUBMISSION_STATUSES.includes(
      status as (typeof FINAL_APPROVED_SUBMISSION_STATUSES)[number],
    );
  }

  private assertMilestoneAllowsTaskWork(milestone: Pick<MilestoneEntity, 'status'>): void {
    if (!TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(milestone.status)) {
      throw new ForbiddenException(TASK_WORK_LOCK_MESSAGE);
    }
  }

  private async assertMilestoneInteractionAllowed(milestoneId: string): Promise<void> {
    await this.milestoneInteractionPolicyService.assertMilestoneUnlockedForWorkspace(milestoneId);
  }

  private async assertMilestoneAllowsTaskWorkById(milestoneId: string): Promise<MilestoneEntity> {
    const milestone = await this.getMilestoneSubmissionDeadlineContext(milestoneId);

    await this.assertMilestoneInteractionAllowed(milestone.id);
    this.assertMilestoneAllowsTaskWork(milestone);
    return milestone as MilestoneEntity;
  }

  private getClientReviewDueAt(referenceDate: Date): Date {
    return new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000);
  }

  private async ensureNoOpenSubmissionReview(taskId: string): Promise<void> {
    const openReviewCount = await this.submissionRepository.count({
      where: {
        taskId,
        status: In([...ACTIVE_SUBMISSION_REVIEW_STATUSES]),
      },
    });

    if (openReviewCount > 0) {
      throw new BadRequestException(
        'Cannot submit a new version while another submission is still waiting for review.',
      );
    }
  }

  private mapTaskComment(comment: TaskCommentEntity): TaskCommentItem {
    const actorProfile = comment.actor?.profile as { avatarUrl?: string | null } | undefined;

    return {
      id: comment.id,
      taskId: comment.taskId,
      actorId: comment.actorId,
      content: this.sanitizeCommentContent(comment.content),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      actor: comment.actor
        ? {
            id: comment.actor.id,
            fullName: comment.actor.fullName,
            avatarUrl: actorProfile?.avatarUrl ?? null,
          }
        : null,
    };
  }

  private async findHydratedComment(commentId: string): Promise<TaskCommentEntity | null> {
    return this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.actor', 'actor')
      .leftJoinAndSelect('actor.profile', 'profile')
      .where('comment.id = :commentId', { commentId })
      .getOne();
  }

  async getCommentsByTask(taskId: string): Promise<TaskCommentItem[]> {
    await this.ensureTaskExists(taskId);

    const comments = await this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.actor', 'actor')
      .leftJoinAndSelect('actor.profile', 'profile')
      .where('comment.taskId = :taskId', { taskId })
      .orderBy('comment.createdAt', 'DESC')
      .getMany();

    return comments.map((comment) => this.mapTaskComment(comment));
  }

  async getTaskComments(taskId: string): Promise<TaskCommentItem[]> {
    return this.getCommentsByTask(taskId);
  }

  async getTaskLinks(taskId: string): Promise<TaskLinkEntity[]> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.taskLinkRepository.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
  }

  async getTaskSubmissions(taskId: string): Promise<TaskSubmissionEntity[]> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.submissionRepository.find({
      where: { taskId },
      relations: ['submitter', 'reviewer', 'brokerReviewer', 'clientReviewer'],
      order: { version: 'DESC', createdAt: 'DESC' },
    });
  }

  async addTaskLink(
    taskId: string,
    data: { url: string; title?: string },
  ): Promise<TaskLinkEntity> {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertMilestoneInteractionAllowed(task.milestoneId);

    const link = this.taskLinkRepository.create({
      taskId,
      url: data.url.trim(),
      title: data.title?.trim() || null,
    });

    return this.taskLinkRepository.save(link);
  }

  async deleteTaskLink(taskId: string, linkId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertMilestoneInteractionAllowed(task.milestoneId);

    const link = await this.taskLinkRepository.findOne({
      where: { id: linkId, taskId },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    await this.taskLinkRepository.remove(link);
  }

  async deleteTask(taskId: string, actorId?: string, actorRole?: UserRole | string): Promise<void> {
    if (!actorId) {
      throw new ForbiddenException('Authentication required');
    }

    if (String(actorRole || '').toUpperCase() !== UserRole.BROKER) {
      throw new ForbiddenException('Only brokers can delete tasks in project workspace.');
    }

    const task = await this.getTaskOrThrow(taskId);
    await this.assertMilestoneAllowsTaskWorkById(task.milestoneId);
    await this.assertMilestoneEscrowFundedForWorkspace(task.milestoneId);

    if (task.status === TaskStatus.IN_REVIEW || task.status === TaskStatus.DONE) {
      throw new BadRequestException('Tasks in review or done cannot be deleted.');
    }

    const project = await this.projectRepository.findOne({
      where: { id: task.projectId },
      select: ['id', 'brokerId'],
    });

    if (!project) {
      throw new NotFoundException('Project not found for this task');
    }

    if (!project.brokerId || project.brokerId !== actorId) {
      throw new ForbiddenException('Only the assigned broker can delete tasks for this project.');
    }

    const subtasks = await this.taskRepository.find({
      where: { parentTaskId: taskId },
      select: ['id'],
    });
    const subtaskIds = subtasks.map((subtask) => subtask.id);

    if (subtaskIds.length > 0) {
      await this.taskRepository.delete(subtaskIds);
    }

    await this.taskRepository.delete(taskId);

    const { progress, totalTasks, completedTasks } = await this.calculateMilestoneProgress(
      task.milestoneId,
    );
    await this.syncMilestoneStatus(task.milestoneId, progress);

    if (task.parentTaskId) {
      await this.emitWorkspaceRefreshForTask(task.parentTaskId);
      return;
    }

    await this.recordWorkspaceSystemMessage(
      task.projectId,
      `Task "${task.title}" was deleted from the workspace.`,
      task.id,
    );

    this.emitTaskRealtimeEvent({
      action: 'DELETED',
      projectId: task.projectId,
      taskId: task.id,
      milestoneId: task.milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    });
  }

  async getSubtasks(taskId: string): Promise<TaskEntity[]> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.taskRepository.find({
      where: { parentTaskId: taskId },
      relations: ['assignee', 'reporter'],
      order: { createdAt: 'DESC' },
    });
  }

  async createSubtask(
    parentTaskId: string,
    data: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      assignedTo?: string;
      dueDate?: string;
    },
    actorRole?: UserRole,
  ): Promise<TaskEntity> {
    this.assertSubtaskManagementAllowed(actorRole);
    const parent = await this.getTaskOrThrow(parentTaskId);
    await this.assertMilestoneAllowsTaskWorkById(parent.milestoneId);

    await this.assertMilestoneEscrowFundedForWorkspace(parent.milestoneId);

    const subtask = this.taskRepository.create({
      title: data.title,
      description: data.description,
      projectId: parent.projectId,
      milestoneId: parent.milestoneId,
      parentTaskId,
      status: TaskStatus.TODO,
      priority: data.priority ?? parent.priority ?? TaskPriority.MEDIUM,
      assignedTo: data.assignedTo,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      reporterId: parent.reporterId,
    });

    const saved = await this.taskRepository.save(subtask);

    const created = await this.taskRepository.findOne({
      where: { id: saved.id },
      relations: ['assignee', 'reporter'],
    });

    if (!created) {
      throw new NotFoundException('Subtask not found after creation');
    }

    await this.emitWorkspaceRefreshForTask(parentTaskId);

    return created;
  }

  async linkExistingSubtask(
    parentTaskId: string,
    subtaskId: string,
    actorRole?: UserRole,
  ): Promise<TaskEntity> {
    this.assertSubtaskManagementAllowed(actorRole);
    if (parentTaskId === subtaskId) {
      throw new BadRequestException('Task cannot be linked to itself');
    }

    const parent = await this.getTaskOrThrow(parentTaskId);
    await this.assertMilestoneAllowsTaskWorkById(parent.milestoneId);

    await this.assertMilestoneEscrowFundedForWorkspace(parent.milestoneId);

    const subtask = await this.taskRepository.findOne({
      where: { id: subtaskId },
      relations: ['assignee', 'reporter'],
    });
    if (!subtask) {
      throw new NotFoundException('Subtask not found');
    }

    if (subtask.projectId !== parent.projectId) {
      throw new BadRequestException('Subtask must belong to the same project');
    }

    await this.taskRepository.update(subtaskId, {
      parentTaskId,
      milestoneId: parent.milestoneId,
    });

    const linked = await this.taskRepository.findOne({
      where: { id: subtaskId },
      relations: ['assignee', 'reporter'],
    });

    if (!linked) {
      throw new NotFoundException('Subtask not found after linking');
    }

    await this.emitWorkspaceRefreshForTask(parentTaskId);

    return linked;
  }

  private assertSubtaskManagementAllowed(actorRole?: UserRole): void {
    if (actorRole === UserRole.FREELANCER) {
      throw new ForbiddenException('Freelancers cannot create or link subtasks.');
    }
  }

  private assertSubtaskDoneTransitionAllowed(
    task: Pick<TaskEntity, 'parentTaskId'>,
    nextStatus: TaskStatus | string | undefined,
    actorRole?: UserRole | string,
  ): void {
    if (!task.parentTaskId) {
      return;
    }

    const normalizedActorRole = String(actorRole || '').toUpperCase();

    if (normalizedActorRole === UserRole.FREELANCER) {
      throw new ForbiddenException('Freelancers are not allowed to change subtask status.');
    }

    if (nextStatus === TaskStatus.DONE && normalizedActorRole !== UserRole.BROKER) {
      throw new ForbiddenException('Only brokers can move subtasks to DONE.');
    }
  }

  async createComment(
    taskId: string,
    actorId: string,
    content: string,
  ): Promise<TaskCommentMutationResult> {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertMilestoneInteractionAllowed(task.milestoneId);

    const sanitizedContent = this.sanitizeCommentContent(content);
    if (!sanitizedContent) {
      throw new BadRequestException('Content is required');
    }

    const comment = this.commentRepository.create({
      taskId,
      content: sanitizedContent,
      actorId,
      createdAt: new Date(), // Force Node.js UTC time
    });

    this.logger.log(`[Adding Comment] Saving at UTC: ${comment.createdAt.toISOString()}`);
    const saved = await this.commentRepository.save(comment);

    const fullComment = await this.findHydratedComment(saved.id);

    if (!fullComment) {
      throw new NotFoundException('Comment not found after creation');
    }

    let attachmentsUpdated = false;
    try {
      attachmentsUpdated = await this.createAttachmentsFromComment(
        taskId,
        actorId,
        sanitizedContent,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to extract task attachments: ${message}`);
    }

    let updatedTask: TaskEntity | null = null;
    if (attachmentsUpdated) {
      updatedTask = await this.findTaskWithWorkspaceRelations(taskId);
      if (updatedTask && !updatedTask.parentTaskId) {
        this.emitTaskRealtimeEvent({
          action: 'UPDATED',
          projectId: updatedTask.projectId,
          task: updatedTask,
        });
      }
    }

    return {
      comment: this.mapTaskComment(fullComment),
      task: updatedTask,
    };
  }

  async addComment(
    taskId: string,
    content: string,
    actorId: string,
  ): Promise<TaskCommentMutationResult> {
    return this.createComment(taskId, actorId, content);
  }

  async updateComment(
    commentId: string,
    actorId: string,
    content: string,
  ): Promise<TaskCommentMutationResult> {
    const sanitizedContent = this.sanitizeCommentContent(content);
    if (!sanitizedContent) {
      throw new BadRequestException('Content is required');
    }

    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.actorId !== actorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const task = await this.getTaskOrThrow(comment.taskId);
    await this.assertMilestoneInteractionAllowed(task.milestoneId);

    if (comment.content !== sanitizedContent) {
      comment.content = sanitizedContent;
      await this.commentRepository.save(comment);
    }

    let attachmentsUpdated = false;
    try {
      attachmentsUpdated = await this.createAttachmentsFromComment(
        comment.taskId,
        actorId,
        sanitizedContent,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to extract task attachments: ${message}`);
    }

    const fullComment = await this.findHydratedComment(comment.id);
    if (!fullComment) {
      throw new NotFoundException('Comment not found after update');
    }

    let updatedTask: TaskEntity | null = null;
    if (attachmentsUpdated) {
      updatedTask = await this.findTaskWithWorkspaceRelations(comment.taskId);
      if (updatedTask && !updatedTask.parentTaskId) {
        this.emitTaskRealtimeEvent({
          action: 'UPDATED',
          projectId: updatedTask.projectId,
          task: updatedTask,
        });
      }
    }

    return {
      comment: this.mapTaskComment(fullComment),
      task: updatedTask,
    };
  }

  async deleteComment(
    commentId: string,
    actorId: string,
    actorRole?: UserRole | string,
  ): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const normalizedActorRole = String(actorRole || '').toUpperCase();
    const isAdmin = normalizedActorRole === UserRole.ADMIN;
    const isAuthor = comment.actorId === actorId;

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException('You can only delete your own comments unless you are an admin');
    }

    const task = await this.getTaskOrThrow(comment.taskId);
    await this.assertMilestoneInteractionAllowed(task.milestoneId);

    await this.commentRepository.remove(comment);
  }

  async submitWork(
    taskId: string,
    dto: CreateSubmissionDto,
    submitterId?: string,
  ): Promise<TaskSubmissionCreateResult> {
    if (!submitterId) {
      throw new ForbiddenException('Authentication required');
    }

    const task = await this.getTaskOrThrow(taskId);

    await this.assertMilestoneEscrowFundedForWorkspace(task.milestoneId);
    const milestone = await this.getMilestoneSubmissionDeadlineContext(task.milestoneId);
    const submissionDeadline = this.resolveSubmissionDeadline(task, milestone);

    const project = await this.projectRepository.findOne({
      where: { id: task.projectId },
      select: ['id', 'brokerId', 'freelancerId'],
    });

    if (!project) {
      throw new NotFoundException('Project not found for this task');
    }

    if (!project.freelancerId || project.freelancerId !== submitterId) {
      throw new ForbiddenException(
        'Only the assigned project freelancer can submit work for this task.',
      );
    }

    if (task.assignedTo && task.assignedTo !== submitterId) {
      throw new ForbiddenException('Only the task assignee can submit work for this task.');
    }

    if (!project.brokerId) {
      throw new ForbiddenException(
        'Work submission is unavailable until a broker is assigned to this project.',
      );
    }

    await this.assertMilestoneInteractionAllowed(task.milestoneId);
    this.assertMilestoneAllowsTaskWork(milestone);

    if (this.isSubmissionDeadlinePassed(submissionDeadline)) {
      if (submissionDeadline) {
        await this.announceSubmissionDeadlineClosed(task, submissionDeadline);
      }

      throw new ForbiddenException(
        submissionDeadline
          ? `The submission deadline passed at ${this.formatDeadlineForDisplay(
              submissionDeadline,
            )}. New freelancer submissions are locked for this task.`
          : 'New freelancer submissions are locked for this task.',
      );
    }

    await this.ensureNoOpenSubmissionReview(taskId);

    const latestSubmission = await this.submissionRepository
      .createQueryBuilder('submission')
      .select(['submission.id', 'submission.version'])
      .where('submission.taskId = :taskId', { taskId })
      .orderBy('submission.version', 'DESC')
      .limit(1)
      .getOne();

    const nextVersion = (latestSubmission?.version ?? 0) + 1;

    const submission = this.submissionRepository.create({
      taskId,
      submitterId,
      content: dto.content,
      attachments: dto.attachments ?? [],
      version: nextVersion,
      status: TaskSubmissionStatus.PENDING,
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
    });

    const saved = await this.submissionRepository.save(submission);

    await this.taskRepository.update(taskId, {
      status: TaskStatus.IN_REVIEW,
      submittedAt: this.buildNullableTimestampUpdate(null),
    });

    const updatedTask = await this.findTaskWithWorkspaceRelations(taskId);
    if (!updatedTask) {
      throw new NotFoundException('Task not found after submission');
    }

    if (!updatedTask.parentTaskId) {
      this.emitTaskRealtimeEvent({
        action: 'UPDATED',
        projectId: updatedTask.projectId,
        task: updatedTask,
        milestoneId: updatedTask.milestoneId,
      });
    }

    await this.recordWorkspaceSystemMessage(
      task.projectId,
      `Submission V${nextVersion} was sent for broker review on task "${task.title}".`,
      task.id,
    );

    return {
      submission: saved,
      task: updatedTask,
    };
  }

  /**
   * Review a task submission (Approve or Request Changes)
   * Only CLIENT or BROKER users can review submissions
   *
   * Business Logic:
   * - If APPROVED: Task status → DONE
   * - If REQUEST_CHANGES: Task status → IN_PROGRESS (sent back to freelancer)
   *
   * @param taskId - Task ID
   * @param submissionId - Submission ID to review
   * @param dto - ReviewSubmissionDto with status and optional reviewNote
   * @param reviewerId - User ID of the reviewer (must be CLIENT)
   */
  async reviewSubmission(
    taskId: string,
    submissionId: string,
    dto: ReviewSubmissionDto,
    reviewerId: string,
    reviewerRole?: UserRole | string,
  ): Promise<SubmissionReviewResult> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId, taskId },
      relations: ['submitter', 'reviewer', 'brokerReviewer', 'clientReviewer'],
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const task = await this.getTaskOrThrow(taskId);
    await this.assertMilestoneInteractionAllowed(task.milestoneId);

    await this.assertMilestoneEscrowFundedForWorkspace(task.milestoneId);

    const project = await this.projectRepository.findOne({
      where: { id: task.projectId },
      select: ['id', 'clientId', 'brokerId'],
    });
    if (!project) {
      throw new NotFoundException('Project not found for this task');
    }

    const normalizedReviewerRole = String(reviewerRole || '').toUpperCase();
    if (normalizedReviewerRole !== UserRole.CLIENT && normalizedReviewerRole !== UserRole.BROKER) {
      throw new ForbiddenException(
        'Only the project client or assigned broker can review submissions',
      );
    }

    const canActAsClient = project.clientId === reviewerId;
    const canActAsBroker = Boolean(project.brokerId && project.brokerId === reviewerId);

    if (!canActAsClient && !canActAsBroker) {
      throw new ForbiddenException(
        'Only the project client or assigned broker can review submissions',
      );
    }

    const previousTaskStatus = task.status;
    const milestoneId = task.milestoneId;
    const reviewTimestamp = new Date();
    const trimmedReviewNote = dto.reviewNote?.trim() || null;
    let resolvedTaskStatus = task.status;
    let auditMessage = '';

    if (submission.status === TaskSubmissionStatus.PENDING) {
      if (!canActAsBroker) {
        throw new BadRequestException(
          'Broker review is required before the client can review this submission.',
        );
      }

      if (dto.status === TaskSubmissionStatus.APPROVED) {
        const unfinishedSubtasks = await this.getUnfinishedSubtasks(task.id);
        if (unfinishedSubtasks.length > 0) {
          throw new BadRequestException(
            `Cannot approve submission: ${unfinishedSubtasks.length} subtasks are still not DONE.`,
          );
        }
      }

      submission.brokerReviewerId = reviewerId;
      submission.brokerReviewedAt = reviewTimestamp;
      submission.brokerReviewNote = trimmedReviewNote;

      if (dto.status === TaskSubmissionStatus.APPROVED) {
        submission.status = TaskSubmissionStatus.APPROVED;
        submission.clientReviewDueAt = null;
        submission.clientReviewerId = null;
        submission.clientReviewedAt = null;
        submission.clientReviewNote = null;
        submission.autoApprovedAt = null;
        submission.reviewNote = trimmedReviewNote;
        submission.reviewerId = reviewerId;
        submission.reviewedAt = reviewTimestamp;
        resolvedTaskStatus = TaskStatus.DONE;
        auditMessage = `Broker approved submission V${submission.version} for task "${task.title}". The task is now marked DONE.`;
      } else {
        submission.status = TaskSubmissionStatus.REQUEST_CHANGES;
        submission.clientReviewDueAt = null;
        submission.clientReviewerId = null;
        submission.clientReviewedAt = null;
        submission.clientReviewNote = null;
        submission.autoApprovedAt = null;
        submission.reviewNote = trimmedReviewNote;
        submission.reviewerId = reviewerId;
        submission.reviewedAt = reviewTimestamp;
        resolvedTaskStatus = TaskStatus.IN_PROGRESS;
        auditMessage = `Broker requested changes for submission V${submission.version} on task "${task.title}". The task moved back to IN_PROGRESS.`;
      }
    } else if (submission.status === TaskSubmissionStatus.PENDING_CLIENT_REVIEW) {
      if (!canActAsClient) {
        throw new ForbiddenException('Only the project client can complete client review.');
      }

      submission.clientReviewerId = reviewerId;
      submission.clientReviewedAt = reviewTimestamp;
      submission.clientReviewNote = trimmedReviewNote;
      submission.reviewNote = trimmedReviewNote;
      submission.reviewerId = reviewerId;
      submission.reviewedAt = reviewTimestamp;
      submission.autoApprovedAt = null;
      submission.clientReviewDueAt = null;

      if (dto.status === TaskSubmissionStatus.APPROVED) {
        submission.status = TaskSubmissionStatus.APPROVED;
        resolvedTaskStatus = TaskStatus.DONE;
        auditMessage = `Client approved submission V${submission.version} for task "${task.title}". The task is now marked DONE.`;
      } else {
        submission.status = TaskSubmissionStatus.REQUEST_CHANGES;
        resolvedTaskStatus = TaskStatus.IN_PROGRESS;
        auditMessage = `Client requested changes for submission V${submission.version} on task "${task.title}". The task moved back to IN_PROGRESS.`;
      }
    } else {
      throw new BadRequestException('This submission is no longer waiting for review.');
    }

    await this.submissionRepository.save(submission);

    await this.taskRepository.update(taskId, {
      status: resolvedTaskStatus,
      submittedAt: this.buildNullableTimestampUpdate(
        this.isFinalApprovedSubmissionStatus(submission.status) ? reviewTimestamp : null,
      ),
    });

    if (previousTaskStatus !== resolvedTaskStatus) {
      await this.createHistory(
        taskId,
        'status',
        previousTaskStatus,
        resolvedTaskStatus,
        reviewerId,
      );
    }

    const nextTask = await this.findTaskWithWorkspaceRelations(taskId);
    if (!nextTask) {
      throw new NotFoundException('Task not found after update');
    }

    const { progress, totalTasks, completedTasks } =
      await this.calculateMilestoneProgress(milestoneId);

    await this.syncMilestoneStatus(
      milestoneId,
      progress,
      this.isFinalApprovedSubmissionStatus(submission.status) ? reviewTimestamp : undefined,
    );

    const hydratedSubmission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['submitter', 'reviewer', 'brokerReviewer', 'clientReviewer'],
    });

    await this.recordWorkspaceSystemMessage(task.projectId, auditMessage, task.id);

    await this.notifyTaskStatusTransition(
      nextTask,
      previousTaskStatus,
      resolvedTaskStatus,
      reviewerId,
    );

    this.emitTaskRealtimeEvent({
      action: 'UPDATED',
      projectId: task.projectId,
      task: nextTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    });

    return {
      submission: hydratedSubmission!,
      task: nextTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    };
  }

  private extractImageUrls(html: string): string[] {
    const urls = new Set<string>();
    const regex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    for (const match of html.matchAll(regex)) {
      const src = match[1]?.trim();
      if (!src) continue;
      if (src.startsWith('data:')) continue;
      urls.add(src);
    }
    return Array.from(urls);
  }

  private getFileNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const fileNameFromHash = new URLSearchParams(parsed.hash.replace(/^#/, '')).get('filename');
      if (fileNameFromHash?.trim()) {
        return decodeURIComponent(fileNameFromHash);
      }

      const fileNameFromQuery = parsed.searchParams.get('filename');
      if (fileNameFromQuery?.trim()) {
        return decodeURIComponent(fileNameFromQuery);
      }

      const name = path.basename(parsed.pathname);
      return name || 'attachment';
    } catch {
      const hashSegment = url.split('#')[1] || '';
      const fileNameFromHash = new URLSearchParams(hashSegment).get('filename');
      if (fileNameFromHash?.trim()) {
        return decodeURIComponent(fileNameFromHash);
      }

      const cleaned = url.split('?')[0]?.split('#')[0] || '';
      const name = path.basename(cleaned);
      return name || 'attachment';
    }
  }

  private async createAttachmentsFromComment(
    taskId: string,
    uploaderId: string,
    html: string,
  ): Promise<boolean> {
    const urls = this.extractImageUrls(html);
    if (urls.length === 0) {
      return false;
    }

    const existing = await this.attachmentRepository.find({
      where: {
        taskId,
        url: In(urls),
      },
    });

    const existingUrls = new Set(existing.map((item) => item.url));
    const newUrls = urls.filter((url) => !existingUrls.has(url));

    if (newUrls.length === 0) {
      return false;
    }

    const attachments = newUrls.map((url) =>
      this.attachmentRepository.create({
        taskId,
        uploaderId,
        url,
        fileName: this.getFileNameFromUrl(url),
        fileType: 'image',
      }),
    );

    await this.attachmentRepository.save(attachments);
    return true;
  }

  private async createHistory(
    taskId: string,
    field: string,
    oldValue: any,
    newValue: any,
    actorId?: string,
  ) {
    if (oldValue === newValue) return;

    // Helper to format values
    const formatValue = (val: any) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    const history = this.historyRepository.create({
      taskId,
      actorId,
      fieldChanged: field,
      oldValue: formatValue(oldValue),
      newValue: formatValue(newValue),
      createdAt: new Date(), // Force Node.js UTC time
    });

    // this.logger.log(`[TaskHistory] Saving history at UTC: ${history.createdAt.toISOString()}`);
    await this.historyRepository.save(history);
  }

  private sortAttachments(task: TaskEntity | null): TaskEntity | null {
    if (!task?.attachments) {
      return task;
    }

    task.attachments = [...task.attachments].sort((a: any, b: any) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return task;
  }

  private sortSubmissions(task: TaskEntity | null): TaskEntity | null {
    if (!task?.submissions) {
      return task;
    }

    task.submissions = [...task.submissions].sort((a: any, b: any) => {
      const versionDelta = (b?.version ?? 0) - (a?.version ?? 0);
      if (versionDelta !== 0) {
        return versionDelta;
      }

      const aTimeSource =
        a?.clientReviewedAt ??
        a?.autoApprovedAt ??
        a?.reviewedAt ??
        a?.brokerReviewedAt ??
        a?.createdAt;
      const bTimeSource =
        b?.clientReviewedAt ??
        b?.autoApprovedAt ??
        b?.reviewedAt ??
        b?.brokerReviewedAt ??
        b?.createdAt;
      const aTime = aTimeSource ? new Date(aTimeSource).getTime() : 0;
      const bTime = bTimeSource ? new Date(bTimeSource).getTime() : 0;

      return bTime - aTime;
    });

    return task;
  }

  private prepareTaskForWorkspace(task: TaskEntity | null): TaskEntity | null {
    if (!task) {
      return task;
    }

    this.sortAttachments(task);
    this.sortSubmissions(task);
    return task;
  }

  private async findTaskWithWorkspaceRelations(id: string): Promise<TaskEntity | null> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: [...TASK_WORKSPACE_RELATIONS],
    });

    return this.prepareTaskForWorkspace(task);
  }

  private emitTaskRealtimeEvent(event: ProjectTaskRealtimeEvent): void {
    TasksRealtimeBridge.emitProjectTaskChanged(event);
  }

  private async getUnfinishedSubtasks(taskId: string): Promise<TaskEntity[]> {
    const subtasks = await this.taskRepository.find({
      where: { parentTaskId: taskId },
      select: ['id', 'title', 'status'],
      order: { createdAt: 'ASC' },
    });

    return subtasks.filter((subtask) => subtask.status !== TaskStatus.DONE);
  }

  private async emitWorkspaceRefreshForTask(taskId: string): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      select: ['id', 'projectId', 'milestoneId', 'parentTaskId'],
    });

    if (!task) {
      return;
    }

    const rootTaskId = task.parentTaskId ?? task.id;
    const rootTask = await this.findTaskWithWorkspaceRelations(rootTaskId);
    if (!rootTask || rootTask.parentTaskId) {
      return;
    }

    const milestoneProgressSummary = await this.calculateMilestoneProgress(rootTask.milestoneId);
    this.emitTaskRealtimeEvent({
      action: 'UPDATED',
      projectId: rootTask.projectId,
      task: rootTask,
      milestoneId: rootTask.milestoneId,
      milestoneProgress: milestoneProgressSummary.progress,
      totalTasks: milestoneProgressSummary.totalTasks,
      completedTasks: milestoneProgressSummary.completedTasks,
    });
  }

  async getKanbanBoard(projectId: string): Promise<BoardWithMilestones> {
    // Fetch all tasks for the project
    const tasks = await this.taskRepository.find({
      where: { projectId, parentTaskId: IsNull() },
      relations: [...TASK_WORKSPACE_RELATIONS],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    const milestoneTaskSnapshots = await this.taskRepository.find({
      where: { projectId },
      select: ['id', 'milestoneId', 'status'],
    });

    // Fetch all milestones for the project
    const milestones = await this.milestoneRepository.find({
      where: { projectId },
      order: { startDate: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });

    const escrows =
      milestones.length > 0
        ? await this.escrowRepository.find({
            where: { milestoneId: In(milestones.map((milestone) => milestone.id)) },
          })
        : [];
    const escrowMap = new Map(
      escrows.map((escrow) => [escrow.milestoneId, this.toMilestoneEscrowSummary(escrow)]),
    );

    // Group tasks by status
    const board: KanbanBoard = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };

    for (const task of tasks) {
      this.prepareTaskForWorkspace(task);
      if (task.status === TaskStatus.TODO) {
        board.TODO.push(task);
      } else if (task.status === TaskStatus.IN_PROGRESS) {
        board.IN_PROGRESS.push(task);
      } else if (task.status === TaskStatus.IN_REVIEW) {
        board.IN_REVIEW.push(task);
      } else if (task.status === TaskStatus.DONE) {
        board.DONE.push(task);
      }
    }

    const milestoneProgressMap = new Map<
      string,
      { progress: number; totalTasks: number; completedTasks: number }
    >();
    for (const task of milestoneTaskSnapshots) {
      if (!task.milestoneId) {
        continue;
      }
      const currentSummary = milestoneProgressMap.get(task.milestoneId) ?? {
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
      };
      currentSummary.totalTasks += 1;
      if (task.status === TaskStatus.DONE) {
        currentSummary.completedTasks += 1;
      }
      milestoneProgressMap.set(task.milestoneId, currentSummary);
    }

    return {
      tasks: board,
      milestones: milestones.map((milestone) => ({
        ...milestone,
        progress: milestoneProgressMap.get(milestone.id)?.totalTasks
          ? Math.round(
              (milestoneProgressMap.get(milestone.id)!.completedTasks /
                milestoneProgressMap.get(milestone.id)!.totalTasks) *
                100,
            )
          : 0,
        totalTasks: milestoneProgressMap.get(milestone.id)?.totalTasks ?? 0,
        completedTasks: milestoneProgressMap.get(milestone.id)?.completedTasks ?? 0,
        escrow: escrowMap.get(milestone.id) ?? null,
        disputePolicy: resolveMilestoneDisputePolicy({
          milestoneStatus: milestone.status,
          escrowStatus: escrowMap.get(milestone.id)?.status ?? null,
          releasedAt: escrowMap.get(milestone.id)?.releasedAt ?? null,
          dueDate: milestone.dueDate,
        }),
      })),
    };
  }

  private toMilestoneEscrowSummary(escrow: EscrowEntity): WorkspaceMilestoneEscrowSummary {
    return {
      id: escrow.id,
      status: escrow.status,
      totalAmount: Number(escrow.totalAmount || 0),
      fundedAmount: Number(escrow.fundedAmount || 0),
      releasedAmount: Number(escrow.releasedAmount || 0),
      developerShare: Number(escrow.developerShare || 0),
      brokerShare: Number(escrow.brokerShare || 0),
      platformFee: Number(escrow.platformFee || 0),
      currency: escrow.currency,
      fundedAt: escrow.fundedAt || null,
      releasedAt: escrow.releasedAt || null,
      refundedAt: escrow.refundedAt || null,
      updatedAt: escrow.updatedAt,
    };
  }

  /**
   * Returns both the updated task AND the new milestone progress for real-time UI updates
   */
  async updateStatus(
    id: string,
    status: KanbanStatus,
    actorId?: string,
    actorRole?: UserRole | string,
  ): Promise<TaskStatusUpdateResult> {
    // Step 1: Get the task to find its milestoneId
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    this.assertSubtaskDoneTransitionAllowed(task, status, actorRole);

    await this.assertMilestoneAllowsTaskWorkById(task.milestoneId);

    const previousStatus = task.status;
    const milestoneId = task.milestoneId;

    await this.assertMilestoneEscrowFundedForWorkspace(milestoneId);

    const approvedSubmissionCount = await this.submissionRepository.count({
      where: {
        taskId: id,
        status: In([...FINAL_APPROVED_SUBMISSION_STATUSES]),
      },
    });

    if (
      status === TaskStatus.DONE &&
      previousStatus !== TaskStatus.DONE &&
      approvedSubmissionCount === 0
    ) {
      throw new BadRequestException('Cannot move to DONE without an approved submission.');
    }

    if (
      previousStatus === TaskStatus.DONE &&
      status !== TaskStatus.DONE &&
      approvedSubmissionCount > 0
    ) {
      throw new BadRequestException('Approved tasks cannot be moved out of DONE.');
    }

    // [HISTORY] Record status change
    if (previousStatus !== status) {
      // ideally updateStatus should accept actorId optional param
      await this.createHistory(id, 'status', previousStatus, status, actorId);
    }

    // Step 2: Update the task status
    await this.taskRepository.update(id, {
      status,
      submittedAt: this.buildNullableTimestampUpdate(
        status === TaskStatus.DONE ? new Date() : null,
      ),
    });

    // Step 3: Refetch the updated task
    const updatedTask = await this.findTaskWithWorkspaceRelations(id);

    if (!updatedTask) {
      throw new NotFoundException('Task not found after update');
    }

    this.logger.log(
      `Task ${id} status changed: ${previousStatus} → ${status} (Milestone: ${milestoneId})`,
    );

    // Step 4: Recalculate milestone progress
    const { progress, totalTasks, completedTasks } =
      await this.calculateMilestoneProgress(milestoneId);

    this.logger.log(
      `Milestone ${milestoneId} progress: ${completedTasks}/${totalTasks} = ${progress}%`,
    );

    await this.syncMilestoneStatus(milestoneId, progress);

    await this.notifyTaskStatusTransition(updatedTask, previousStatus, status, actorId);

    this.emitTaskRealtimeEvent({
      action: 'UPDATED',
      projectId: updatedTask.projectId,
      task: updatedTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    });

    return {
      task: updatedTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    };
  }

  /**
   * Calculate milestone progress based on completed tasks
   * Formula: (DONE tasks / Total tasks) * 100
   */
  private async calculateMilestoneProgress(milestoneId: string): Promise<{
    progress: number;
    totalTasks: number;
    completedTasks: number;
  }> {
    // Count all tasks for this milestone
    const totalTasks = await this.taskRepository.count({
      where: { milestoneId },
    });

    if (totalTasks === 0) {
      return { progress: 0, totalTasks: 0, completedTasks: 0 };
    }

    // Count completed (DONE) tasks
    const completedTasks = await this.taskRepository.count({
      where: { milestoneId, status: TaskStatus.DONE },
    });

    // Calculate percentage (rounded to integer)
    const progress = Math.round((completedTasks / totalTasks) * 100);

    return { progress, totalTasks, completedTasks };
  }

  private async syncMilestoneStatus(
    milestoneId: string,
    progress: number,
    submittedAt?: Date,
  ): Promise<void> {
    const milestone = await this.milestoneRepository.findOne({ where: { id: milestoneId } });
    if (!milestone) {
      return;
    }

    const nonUpdatableStatuses = [
      MilestoneStatus.COMPLETED,
      MilestoneStatus.PAID,
      MilestoneStatus.LOCKED,
    ];
    if (nonUpdatableStatuses.includes(milestone.status)) {
      return;
    }

    let shouldSave = false;

    if (progress > 0 && milestone.status === MilestoneStatus.PENDING) {
      milestone.status = MilestoneStatus.IN_PROGRESS;
      shouldSave = true;
    }

    if (progress >= 100) {
      if (
        submittedAt &&
        [
          MilestoneStatus.SUBMITTED,
          MilestoneStatus.PENDING_STAFF_REVIEW,
          MilestoneStatus.PENDING_CLIENT_APPROVAL,
        ].includes(milestone.status)
      ) {
        milestone.submittedAt = submittedAt;
        shouldSave = true;
      }

      if (shouldSave) {
        await this.milestoneRepository.save(milestone);
      }
      return;
    }

    if (
      [
        MilestoneStatus.SUBMITTED,
        MilestoneStatus.PENDING_STAFF_REVIEW,
        MilestoneStatus.PENDING_CLIENT_APPROVAL,
      ].includes(milestone.status)
    ) {
      milestone.status = progress === 0 ? MilestoneStatus.PENDING : MilestoneStatus.IN_PROGRESS;
      milestone.submittedAt = null as never;
      milestone.reviewedByStaffId = null;
      milestone.staffRecommendation = null;
      milestone.staffReviewNote = null;
      shouldSave = true;
    } else if (progress === 0 && milestone.status === MilestoneStatus.IN_PROGRESS) {
      milestone.status = MilestoneStatus.PENDING;
      shouldSave = true;
    }

    if (shouldSave) {
      await this.milestoneRepository.save(milestone);
    }
  }

  private async assertMilestoneEscrowFundedForWorkspace(milestoneId: string): Promise<void> {
    const escrow = await this.escrowRepository.findOne({
      where: { milestoneId },
      select: ['id', 'status', 'fundedAmount', 'totalAmount'],
    });

    if (!escrow) {
      throw new ConflictException(
        'Cannot operate on this milestone workspace before escrow is prepared.',
      );
    }

    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new ForbiddenException(TASK_ESCROW_FUNDING_LOCK_MESSAGE);
    }

    const fundedAmount = new Decimal(escrow.fundedAmount ?? 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const totalAmount = new Decimal(escrow.totalAmount ?? 0).toDecimalPlaces(
      2,
      Decimal.ROUND_HALF_UP,
    );

    if (!fundedAmount.equals(totalAmount)) {
      throw new ForbiddenException(
        'Milestone workspace requires full escrow funding before task operations are allowed.',
      );
    }
  }

  async createTask(data: {
    title: string;
    description?: string;
    projectId: string;
    milestoneId: string;
    specFeatureId?: string;
    startDate?: string;
    dueDate?: string;
    organizerId?: string;
    priority?: TaskPriority;
    storyPoints?: number;
    labels?: string[];
    reporterId?: string;
    requesterId: string;
    requesterRole?: UserRole | string;
  }): Promise<TaskEntity> {
    const milestone = await this.milestoneRepository.findOne({
      where: { id: data.milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.projectId !== data.projectId) {
      throw new BadRequestException('Milestone does not belong to this project');
    }

    await this.assertMilestoneEscrowFundedForWorkspace(data.milestoneId);

    const normalizedRequesterRole = String(data.requesterRole || '').toUpperCase();
    if (normalizedRequesterRole !== UserRole.BROKER) {
      throw new ForbiddenException('Only brokers can create tasks in project workspace.');
    }

    const project = await this.projectRepository.findOne({
      where: { id: data.projectId },
      select: ['id', 'brokerId'],
    });

    if (!project) {
      throw new NotFoundException('Project not found for this milestone');
    }

    if (!project.brokerId || project.brokerId !== data.requesterId) {
      throw new ForbiddenException('Only the assigned broker can create tasks for this project.');
    }

    await this.assertMilestoneInteractionAllowed(data.milestoneId);

    if (!TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(milestone.status)) {
      throw new ForbiddenException(TASK_CREATION_LOCK_MESSAGE);
    }

    // Step A: Create the task
    const newTask = this.taskRepository.create({
      title: data.title,
      description: data.description,
      projectId: data.projectId,
      milestoneId: data.milestoneId,
      status: TaskStatus.TODO,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      priority: data.priority ?? TaskPriority.MEDIUM,
      storyPoints: data.storyPoints,
      labels: data.labels,
      reporterId: data.reporterId ?? data.requesterId,
    });

    const saved = await this.taskRepository.save(newTask);
    this.logger.log(`Task created: ${saved.id} - ${saved.title}`);

    // Step B: Sync with Calendar (create calendar event if dates provided)
    if (data.startDate || data.dueDate) {
      await this.syncTaskToCalendar(saved, data.startDate, data.dueDate, data.organizerId);
    }

    const created = await this.findTaskWithWorkspaceRelations(saved.id);

    if (!created) {
      throw new NotFoundException('Task not found after creation');
    }

    await this.recordWorkspaceSystemMessage(
      data.projectId,
      `Task "${created.title}" was created in milestone "${milestone.title}".`,
      created.id,
    );

    const { progress, totalTasks, completedTasks } = await this.calculateMilestoneProgress(
      data.milestoneId,
    );

    this.emitTaskRealtimeEvent({
      action: 'CREATED',
      projectId: data.projectId,
      task: created,
      milestoneId: data.milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    });

    return created;
  }

  async updateTask(
    id: string,
    data: Partial<TaskEntity>,
    actorId?: string,
    actorRole?: UserRole | string,
  ): Promise<TaskEntity> {
    this.logger.log(`Updating task ${id} with actor: ${actorId || 'SYSTEM'}`);
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    this.assertSubtaskDoneTransitionAllowed(task, data.status, actorRole);

    await this.assertMilestoneAllowsTaskWorkById(task.milestoneId);
    await this.assertMilestoneEscrowFundedForWorkspace(task.milestoneId);

    // [HISTORY] Check for changes
    if (data.title && data.title !== task.title) {
      await this.createHistory(id, 'title', task.title, data.title, actorId);
    }
    if (data.priority && data.priority !== task.priority) {
      await this.createHistory(id, 'priority', task.priority, data.priority, actorId);
    }
    if (data.storyPoints !== undefined && data.storyPoints !== task.storyPoints) {
      await this.createHistory(id, 'story points', task.storyPoints, data.storyPoints, actorId);
    }
    if (data.description && data.description !== task.description) {
      // Don't log full description, just that it changed
      await this.createHistory(id, 'description', '...', 'Updated', actorId);
    }
    if (data.assignedTo && data.assignedTo !== task.assignedTo) {
      await this.createHistory(
        id,
        'assignee',
        task.assignedTo || 'Unassigned',
        data.assignedTo,
        actorId,
      );
    }
    if (data.labels) {
      const oldLabels = JSON.stringify(task.labels || []);
      const newLabels = JSON.stringify(data.labels || []);
      if (oldLabels !== newLabels) {
        await this.createHistory(
          id,
          'labels',
          task.labels?.join(', ') || '',
          data.labels.join(', '),
          actorId,
        );
      }
    }

    await this.taskRepository.update(id, data);

    const updated = await this.findTaskWithWorkspaceRelations(id);

    if (!updated) {
      throw new NotFoundException('Task not found after update');
    }

    if (updated.parentTaskId) {
      await this.emitWorkspaceRefreshForTask(updated.id);
    } else {
      const milestoneProgressSummary = await this.calculateMilestoneProgress(updated.milestoneId);
      this.emitTaskRealtimeEvent({
        action: 'UPDATED',
        projectId: updated.projectId,
        task: updated,
        milestoneId: updated.milestoneId,
        milestoneProgress: milestoneProgressSummary.progress,
        totalTasks: milestoneProgressSummary.totalTasks,
        completedTasks: milestoneProgressSummary.completedTasks,
      });
    }

    return updated;
  }

  @Cron('*/5 * * * *')
  async remindUpcomingTaskSubmissionDeadlines(): Promise<void> {
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + TASK_SUBMISSION_REMINDER_WINDOW_MS);
    const upcomingTasks = await this.taskRepository
      .createQueryBuilder('task')
      .select(['task.id', 'task.title', 'task.projectId', 'task.milestoneId', 'task.dueDate'])
      .where('task.parentTaskId IS NULL')
      .andWhere('task.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate > :now', { now })
      .andWhere('task.dueDate <= :reminderCutoff', { reminderCutoff })
      .orderBy('task.dueDate', 'ASC')
      .take(100)
      .getMany();

    for (const task of upcomingTasks) {
      try {
        const milestone = await this.getMilestoneSubmissionDeadlineContext(task.milestoneId);
        if (!TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(milestone.status)) {
          continue;
        }

        const submissionDeadline = this.resolveSubmissionDeadline(task, milestone);
        if (!submissionDeadline || this.isSubmissionDeadlinePassed(submissionDeadline, now)) {
          continue;
        }

        const hasLockedSubmissionFlow = await this.hasSubmissionWorkflowStarted(task.id);
        if (hasLockedSubmissionFlow) {
          continue;
        }

        await this.announceSubmissionDeadlineReminder(task, submissionDeadline);
      } catch (error) {
        this.logger.warn(
          `Upcoming submission reminder skipped for task ${task.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  @Cron('*/5 * * * *')
  async lockExpiredTaskSubmissionWindows(): Promise<void> {
    const now = new Date();
    const overdueTasks = await this.taskRepository
      .createQueryBuilder('task')
      .select(['task.id', 'task.title', 'task.projectId', 'task.milestoneId', 'task.dueDate'])
      .where('task.parentTaskId IS NULL')
      .andWhere('task.status != :doneStatus', { doneStatus: TaskStatus.DONE })
      .andWhere('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate <= :now', { now })
      .orderBy('task.dueDate', 'ASC')
      .take(100)
      .getMany();

    for (const task of overdueTasks) {
      try {
        const milestone = await this.getMilestoneSubmissionDeadlineContext(task.milestoneId);
        const submissionDeadline = this.resolveSubmissionDeadline(task, milestone);
        if (!submissionDeadline || !this.isSubmissionDeadlinePassed(submissionDeadline, now)) {
          continue;
        }

        const hasLockedSubmissionFlow = await this.hasSubmissionWorkflowStarted(task.id);
        if (hasLockedSubmissionFlow) {
          continue;
        }

        await this.announceSubmissionDeadlineClosed(task, submissionDeadline);
      } catch (error) {
        this.logger.warn(
          `Submission lock announcement skipped for task ${task.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  @Cron('*/5 * * * *')
  async autoApproveExpiredClientReviews(): Promise<void> {
    const now = new Date();
    const dueSubmissions = await this.submissionRepository.find({
      select: ['id'],
      where: {
        status: TaskSubmissionStatus.PENDING_CLIENT_REVIEW,
        clientReviewDueAt: LessThanOrEqual(now),
      },
      order: { clientReviewDueAt: 'ASC' },
      take: 50,
    });

    for (const candidate of dueSubmissions) {
      try {
        const finalized = await this.finalizeAutoApprovedSubmission(candidate.id, now);
        if (!finalized) {
          continue;
        }

        if (finalized.previousTaskStatus !== finalized.newTaskStatus) {
          await this.createHistory(
            finalized.taskId,
            'status',
            finalized.previousTaskStatus,
            finalized.newTaskStatus,
          );
        }

        const updatedTask = await this.findTaskWithWorkspaceRelations(finalized.taskId);
        if (!updatedTask) {
          continue;
        }

        const { progress, totalTasks, completedTasks } = await this.calculateMilestoneProgress(
          finalized.milestoneId,
        );

        await this.syncMilestoneStatus(finalized.milestoneId, progress, now);
        await this.recordWorkspaceSystemMessage(
          finalized.projectId,
          `Submission V${finalized.version} for task "${finalized.taskTitle}" was auto-approved after 24 hours without client response.`,
          finalized.taskId,
        );

        await this.notifyTaskStatusTransition(
          updatedTask,
          finalized.previousTaskStatus,
          finalized.newTaskStatus,
        );

        this.emitTaskRealtimeEvent({
          action: 'UPDATED',
          projectId: finalized.projectId,
          task: updatedTask,
          milestoneId: finalized.milestoneId,
          milestoneProgress: progress,
          totalTasks,
          completedTasks,
        });
      } catch (error) {
        this.logger.warn(
          `Auto-approve skipped for submission ${candidate.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }
  }

  private async finalizeAutoApprovedSubmission(
    submissionId: string,
    approvedAt: Date,
  ): Promise<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    milestoneId: string;
    version: number;
    previousTaskStatus: TaskStatus;
    newTaskStatus: TaskStatus;
  } | null> {
    return this.dataSource.transaction(async (manager) => {
      const submissionRepo = manager.getRepository(TaskSubmissionEntity);
      const taskRepo = manager.getRepository(TaskEntity);

      const submission = await submissionRepo.findOne({
        where: { id: submissionId },
        select: ['id', 'taskId', 'version', 'status', 'clientReviewDueAt'],
      });

      if (
        !submission ||
        submission.status !== TaskSubmissionStatus.PENDING_CLIENT_REVIEW ||
        !submission.clientReviewDueAt ||
        submission.clientReviewDueAt.getTime() > approvedAt.getTime()
      ) {
        return null;
      }

      const autoApprovalNote = 'Automatically approved after 24 hours without client response.';

      const updateResult = await submissionRepo
        .createQueryBuilder()
        .update(TaskSubmissionEntity)
        .set({
          status: TaskSubmissionStatus.AUTO_APPROVED,
          autoApprovedAt: approvedAt,
          clientReviewedAt: approvedAt,
          clientReviewNote: autoApprovalNote,
          reviewNote: autoApprovalNote,
          reviewerId: null,
          reviewedAt: approvedAt,
          clientReviewDueAt: null,
        })
        .where('id = :submissionId', { submissionId })
        .andWhere('status = :pendingStatus', {
          pendingStatus: TaskSubmissionStatus.PENDING_CLIENT_REVIEW,
        })
        .andWhere('"clientReviewDueAt" IS NOT NULL')
        .andWhere('"clientReviewDueAt" <= :approvedAt', { approvedAt })
        .execute();

      if (!updateResult.affected) {
        return null;
      }

      const task = await taskRepo.findOne({
        where: { id: submission.taskId },
        select: ['id', 'title', 'projectId', 'milestoneId', 'status'],
      });

      if (!task) {
        throw new NotFoundException('Task not found for auto-approved submission');
      }

      await taskRepo.update(task.id, {
        status: TaskStatus.DONE,
        submittedAt: approvedAt,
      });

      return {
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
        version: submission.version,
        previousTaskStatus: task.status,
        newTaskStatus: TaskStatus.DONE,
      };
    });
  }

  /**
   * Sync Task to Calendar - Creates a CalendarEvent for the task
   * This enables the task to appear in Calendar views
   */
  private async syncTaskToCalendar(
    task: TaskEntity,
    startDate?: string,
    dueDate?: string,
    organizerId?: string,
  ): Promise<CalendarEventEntity | null> {
    try {
      // Determine start and end times
      const startTime = startDate ? new Date(startDate) : new Date();
      const endTime = dueDate ? new Date(dueDate) : new Date(startTime);

      // If only dueDate provided, set startTime to same day at 9 AM
      if (!startDate && dueDate) {
        startTime.setTime(endTime.getTime());
        startTime.setHours(9, 0, 0, 0);
        endTime.setHours(17, 0, 0, 0); // End at 5 PM
      }

      // Calculate duration in minutes
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      // Create calendar event linked to this task
      const calendarEvent = this.calendarEventRepository.create({
        type: EventType.TASK_DEADLINE,
        title: `Task: ${task.title}`,
        description: task.description || `Deadline for task: ${task.title}`,
        priority: EventPriority.MEDIUM,
        status: EventStatus.SCHEDULED,
        startTime,
        endTime,
        durationMinutes: Math.max(durationMinutes, 60), // Minimum 1 hour
        organizerId: organizerId || 'system', // Fallback to 'system' if no user
        referenceType: 'Task',
        referenceId: task.id,
        isAutoScheduled: true,
        metadata: {
          projectId: task.projectId,
          milestoneId: task.milestoneId,
          taskStatus: task.status,
        },
      });

      const savedEvent = await this.calendarEventRepository.save(calendarEvent);
      this.logger.log(`Calendar event created for task ${task.id}: ${savedEvent.id}`);

      return savedEvent;
    } catch (error: unknown) {
      // Log error but don't fail task creation
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to sync task to calendar: ${errorMessage}`, errorStack);
      await this.auditLogsService.logSystemIncident({
        component: 'TasksService',
        operation: 'sync-task-to-calendar',
        summary: 'Task-to-calendar sync failed',
        severity: 'HIGH',
        category: 'INTEGRATION',
        error,
        target: {
          type: 'Task',
          id: task.id,
          label: task.title,
        },
        context: {
          projectId: task.projectId,
          milestoneId: task.milestoneId,
        },
      });
      return null;
    }
  }
}
