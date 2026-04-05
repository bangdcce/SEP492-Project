import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import { TaskEntity, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { MilestoneEntity, MilestoneStatus } from '../../database/entities/milestone.entity';
import { EscrowEntity } from '../../database/entities/escrow.entity';
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

export interface ProjectTaskRealtimeEvent {
  action: 'CREATED' | 'UPDATED';
  projectId: string;
  task: TaskEntity;
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

const TASK_WORKSPACE_RELATIONS = [
  'assignee',
  'reporter',
  'attachments',
  'submissions',
  'submissions.submitter',
  'submissions.reviewer',
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
    @Optional()
    private readonly workspaceChatService?: WorkspaceChatService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTaskQueryIndexes();
  }

  private async ensureTaskQueryIndexes(): Promise<void> {
    const statements = [
      `CREATE INDEX IF NOT EXISTS "IDX_task_comments_taskId_createdAt" ON "task_comments" ("taskId", "createdAt" DESC)`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_comments_actorId" ON "task_comments" ("actorId")`,
      `CREATE INDEX IF NOT EXISTS "IDX_task_submissions_taskId_version" ON "task_submissions" ("taskId", "version" DESC)`,
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

  private buildAttachmentPath(fileName: string): string {
    const ext = path.extname(fileName || '').toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    return `comments/${unique}${ext}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('File is required');
    }

    const supabase = this.getSupabaseClient();
    const bucketName = ATTACHMENT_BUCKET;
    this.logger.log(`Uploading to bucket: ${bucketName}`);
    const storagePath = this.buildAttachmentPath(file.originalname || 'attachment');

    const { error } = await supabase.storage.from(bucketName).upload(storagePath, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
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
          fileName: file.originalname || 'attachment',
          mimeType: file.mimetype || 'application/octet-stream',
        },
      });
      throw new InternalServerErrorException('Failed to upload attachment');
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

    if (!data?.publicUrl) {
      throw new InternalServerErrorException('Upload succeeded, but public URL is missing');
    }

    return { url: data.publicUrl };
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

  private async ensureTaskExists(taskId: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
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
      relations: ['submitter'],
      order: { version: 'DESC', createdAt: 'DESC' },
    });
  }

  async addTaskLink(
    taskId: string,
    data: { url: string; title?: string },
  ): Promise<TaskLinkEntity> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const link = this.taskLinkRepository.create({
      taskId,
      url: data.url.trim(),
      title: data.title?.trim() || null,
    });

    return this.taskLinkRepository.save(link);
  }

  async deleteTaskLink(taskId: string, linkId: string): Promise<void> {
    const link = await this.taskLinkRepository.findOne({
      where: { id: linkId, taskId },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    await this.taskLinkRepository.remove(link);
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
  ): Promise<TaskEntity> {
    const parent = await this.taskRepository.findOne({ where: { id: parentTaskId } });
    if (!parent) {
      throw new NotFoundException('Parent task not found');
    }

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

    return created;
  }

  async linkExistingSubtask(parentTaskId: string, subtaskId: string): Promise<TaskEntity> {
    if (parentTaskId === subtaskId) {
      throw new BadRequestException('Task cannot be linked to itself');
    }

    const parent = await this.taskRepository.findOne({ where: { id: parentTaskId } });
    if (!parent) {
      throw new NotFoundException('Parent task not found');
    }

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

    return linked;
  }

  async createComment(taskId: string, actorId: string, content: string): Promise<TaskCommentItem> {
    await this.ensureTaskExists(taskId);

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

    try {
      await this.createAttachmentsFromComment(taskId, actorId, sanitizedContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to extract task attachments: ${message}`);
    }

    return this.mapTaskComment(fullComment);
  }

  async addComment(taskId: string, content: string, actorId: string): Promise<TaskCommentItem> {
    return this.createComment(taskId, actorId, content);
  }

  async updateComment(
    commentId: string,
    actorId: string,
    content: string,
  ): Promise<TaskCommentItem> {
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

    if (comment.content !== sanitizedContent) {
      comment.content = sanitizedContent;
      await this.commentRepository.save(comment);
    }

    try {
      await this.createAttachmentsFromComment(comment.taskId, actorId, sanitizedContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to extract task attachments: ${message}`);
    }

    const fullComment = await this.findHydratedComment(comment.id);
    if (!fullComment) {
      throw new NotFoundException('Comment not found after update');
    }

    return this.mapTaskComment(fullComment);
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

    await this.commentRepository.remove(comment);
  }

  async submitWork(
    taskId: string,
    dto: CreateSubmissionDto,
    submitterId?: string,
  ): Promise<TaskSubmissionEntity> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

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
      submitterId: submitterId || null,
      content: dto.content,
      attachments: dto.attachments ?? [],
      version: nextVersion,
      status: TaskSubmissionStatus.PENDING,
    });

    const saved = await this.submissionRepository.save(submission);

    await this.taskRepository.update(taskId, {
      status: TaskStatus.IN_REVIEW,
      submittedAt: null,
    });

    return saved;
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
    // Step 1: Find the submission
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId, taskId },
      relations: ['submitter'],
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Step 2: Check if submission is still pending
    if (submission.status !== TaskSubmissionStatus.PENDING) {
      throw new BadRequestException(
        `Submission has already been reviewed (status: ${submission.status})`,
      );
    }

    // Step 3: Get the task
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['assignee'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const project = await this.projectRepository.findOne({
      where: { id: task.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found for this task');
    }

    const normalizedReviewerRole = String(reviewerRole || '').toUpperCase();
    if (normalizedReviewerRole === UserRole.CLIENT) {
      if (project.clientId !== reviewerId) {
        throw new ForbiddenException('Only the project client can review submissions');
      }
    } else if (normalizedReviewerRole === UserRole.BROKER) {
      if (project.brokerId !== reviewerId) {
        throw new ForbiddenException(
          'Only the assigned broker can review submissions for this project',
        );
      }
    } else {
      throw new ForbiddenException(
        'Only the project client or assigned broker can review submissions',
      );
    }

    const previousTaskStatus = task.status;
    const milestoneId = task.milestoneId;

    // Step 4: Update submission with review data
    submission.status = dto.status;
    submission.reviewNote = dto.reviewNote ?? null;
    submission.reviewerId = reviewerId;
    submission.reviewedAt = new Date();

    await this.submissionRepository.save(submission);

    // Step 5: Update task status based on review decision
    let newTaskStatus: TaskStatus;

    if (dto.status === TaskSubmissionStatus.APPROVED) {
      newTaskStatus = TaskStatus.DONE;
      this.logger.log(`Submission ${submissionId} APPROVED → Task ${taskId} marked as DONE`);
    } else {
      // REQUEST_CHANGES - send back to freelancer
      newTaskStatus = TaskStatus.IN_PROGRESS;
      this.logger.log(
        `Submission ${submissionId} REQUEST_CHANGES → Task ${taskId} sent back to IN_PROGRESS`,
      );
    }

    await this.taskRepository.update(taskId, {
      status: newTaskStatus,
      submittedAt: dto.status === TaskSubmissionStatus.APPROVED ? submission.reviewedAt : null,
    });

    // Step 6: Record history
    if (previousTaskStatus !== newTaskStatus) {
      await this.createHistory(taskId, 'status', previousTaskStatus, newTaskStatus, reviewerId);
    }

    // Step 7: Refetch updated task
    const updatedTask = await this.findTaskWithWorkspaceRelations(taskId);

    if (!updatedTask) {
      throw new NotFoundException('Task not found after update');
    }

    // Step 8: Recalculate milestone progress
    const { progress, totalTasks, completedTasks } =
      await this.calculateMilestoneProgress(milestoneId);

    this.logger.log(
      `Milestone ${milestoneId} progress after review: ${completedTasks}/${totalTasks} = ${progress}%`,
    );

    // Step 9: Sync milestone status for both approval and request-changes flows.
    await this.syncMilestoneStatus(milestoneId, progress);

    // Refetch submission with reviewer relation
    const updatedSubmission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['submitter', 'reviewer'],
    });

    const reviewAuditMessage =
      dto.status === TaskSubmissionStatus.APPROVED
        ? `Submission approved for task "${task.title}". The task is now marked DONE.`
        : `Changes requested for task "${task.title}". The task has been moved back to IN_PROGRESS.`;
    await this.recordWorkspaceSystemMessage(task.projectId, reviewAuditMessage, task.id);

    this.emitTaskRealtimeEvent({
      action: 'UPDATED',
      projectId: task.projectId,
      task: updatedTask,
      milestoneId,
      milestoneProgress: progress,
      totalTasks,
      completedTasks,
    });

    return {
      submission: updatedSubmission!,
      task: updatedTask,
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
      const name = path.basename(parsed.pathname);
      return name || 'attachment';
    } catch {
      const cleaned = url.split('?')[0]?.split('#')[0] || '';
      const name = path.basename(cleaned);
      return name || 'attachment';
    }
  }

  private async createAttachmentsFromComment(
    taskId: string,
    uploaderId: string,
    html: string,
  ): Promise<void> {
    const urls = this.extractImageUrls(html);
    if (urls.length === 0) {
      return;
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
      return;
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

      const aTime = a?.reviewedAt
        ? new Date(a.reviewedAt).getTime()
        : a?.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
      const bTime = b?.reviewedAt
        ? new Date(b.reviewedAt).getTime()
        : b?.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;

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

  async getKanbanBoard(projectId: string): Promise<BoardWithMilestones> {
    // Fetch all tasks for the project
    const tasks = await this.taskRepository.find({
      where: { projectId, parentTaskId: IsNull() },
      relations: [...TASK_WORKSPACE_RELATIONS],
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
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

    return {
      tasks: board,
      milestones: milestones.map((milestone) => ({
        ...milestone,
        escrow: escrowMap.get(milestone.id) ?? null,
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
  ): Promise<TaskStatusUpdateResult> {
    // Step 1: Get the task to find its milestoneId
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignee'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const previousStatus = task.status;
    const milestoneId = task.milestoneId;

    if (status === TaskStatus.DONE && previousStatus !== TaskStatus.DONE) {
      const approvedSubmissionCount = await this.submissionRepository.count({
        where: {
          taskId: id,
          status: TaskSubmissionStatus.APPROVED,
        },
      });

      if (approvedSubmissionCount === 0) {
        throw new BadRequestException('Cannot move to DONE without an approved submission.');
      }
    }

    // [HISTORY] Record status change
    if (previousStatus !== status) {
      // ideally updateStatus should accept actorId optional param
      await this.createHistory(id, 'status', previousStatus, status, actorId);
    }

    // Step 2: Update the task status
    await this.taskRepository.update(id, {
      status,
      submittedAt: status === TaskStatus.DONE ? new Date() : null,
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
      where: { milestoneId, parentTaskId: IsNull() },
    });

    if (totalTasks === 0) {
      return { progress: 0, totalTasks: 0, completedTasks: 0 };
    }

    // Count completed (DONE) tasks
    const completedTasks = await this.taskRepository.count({
      where: { milestoneId, status: TaskStatus.DONE, parentTaskId: IsNull() },
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
      milestone.submittedAt = null;
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
      reporterId: data.reporterId,
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

  async updateTask(id: string, data: Partial<TaskEntity>, actorId?: string): Promise<TaskEntity> {
    this.logger.log(`Updating task ${id} with actor: ${actorId || 'SYSTEM'}`);
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

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

    if (!updated.parentTaskId) {
      this.emitTaskRealtimeEvent({
        action: 'UPDATED',
        projectId: updated.projectId,
        task: updated,
      });
    }

    return updated;
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
