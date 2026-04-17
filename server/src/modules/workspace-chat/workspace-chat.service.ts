import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectEntity,
  TaskEntity,
  UserEntity,
  UserRole,
  WorkspaceMessageAttachment,
  WorkspaceMessageEditHistoryEntry,
  WorkspaceMessageEntity,
  WorkspaceMessageType,
} from 'src/database/entities';
import { ProjectStaffInviteStatus } from 'src/database/entities/project.entity';
import { WorkspaceChatRealtimeBridge } from './workspace-chat.realtime';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../auth/email.service';
import { MulterFile } from 'src/common/types/multer.type';

const OFF_PLATFORM_RISK_RULES = [
  { flag: 'MOMO', pattern: /\bmomo\b/i },
  { flag: 'ZALO', pattern: /\bzalo\b/i },
  { flag: 'SKYPE', pattern: /\bskype\b/i },
  { flag: 'BANK_TRANSFER', pattern: /\bchuyen khoan\b/i },
  { flag: 'BANK', pattern: /\bbank\b/i },
  { flag: 'NGAN_HANG', pattern: /\bngan hang\b/i },
  { flag: 'OFF_PLATFORM', pattern: /\bngoai luong\b/i },
] as const;

const normalizeForRiskScan = (content: string): string =>
  content
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const escapeIlikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

interface WorkspaceMessageRow {
  id: string;
  projectId: string;
  senderId: string | null;
  taskId: string | null;
  replyToId: string | null;
  messageType: WorkspaceMessageType | string;
  content: string;
  attachments: unknown;
  isPinned: boolean;
  isEdited: boolean;
  editHistory: unknown;
  isDeleted: boolean;
  riskFlags: unknown;
  createdAt: Date;
  updatedAt: Date;
  senderUserId: string | null;
  senderFullName: string | null;
  senderRole: UserRole | null;
  replyMessageId: string | null;
  replyMessageType: WorkspaceMessageType | string | null;
  replyMessageContent: string | null;
  replyMessageAttachments: unknown;
  replyMessageIsDeleted: boolean | null;
  replyMessageCreatedAt: Date | null;
  replySenderUserId: string | null;
  replySenderFullName: string | null;
  replySenderRole: UserRole | null;
}

export interface WorkspaceChatReplySummary {
  id: string;
  messageType: WorkspaceMessageType;
  content: string;
  attachments: WorkspaceMessageAttachment[];
  isDeleted: boolean;
  createdAt: Date;
  sender: {
    id: string;
    fullName: string;
    role: UserRole | null;
  } | null;
}

export interface WorkspaceChatMessage {
  id: string;
  projectId: string;
  senderId: string | null;
  taskId: string | null;
  replyToId: string | null;
  messageType: WorkspaceMessageType;
  content: string;
  attachments: WorkspaceMessageAttachment[];
  isPinned: boolean;
  isEdited: boolean;
  editHistory: WorkspaceMessageEditHistoryEntry[];
  isDeleted: boolean;
  riskFlags: string[];
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    fullName: string;
    role: UserRole | null;
  } | null;
  replyTo: WorkspaceChatReplySummary | null;
}

@Injectable()
export class WorkspaceChatService {
  private readonly logger = new Logger(WorkspaceChatService.name);

  constructor(
    @InjectRepository(WorkspaceMessageEntity)
    private readonly workspaceMessageRepo: Repository<WorkspaceMessageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  private async getProjectAccessContext(projectId: string): Promise<ProjectEntity> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      select: [
        'id',
        'title',
        'clientId',
        'brokerId',
        'freelancerId',
        'staffId',
        'staffInviteStatus',
      ],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private isProjectParticipant(project: ProjectEntity, userId: string): boolean {
    return (
      project.clientId === userId || project.brokerId === userId || project.freelancerId === userId
    );
  }

  private isAcceptedSupervisingStaff(project: ProjectEntity, userId: string): boolean {
    return (
      project.staffId === userId && project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED
    );
  }

  async assertProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.getProjectAccessContext(projectId);

    if (!this.isProjectParticipant(project, userId)) {
      throw new ForbiddenException('You do not have write access to this project chat');
    }
  }

  async assertProjectReadAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.getProjectAccessContext(projectId);

    const canRead =
      this.isProjectParticipant(project, userId) ||
      this.isAcceptedSupervisingStaff(project, userId);

    if (!canRead) {
      throw new ForbiddenException('You do not have access to this project chat');
    }
  }

  async emailChatExport(
    projectId: string,
    requester: Pick<UserEntity, 'id' | 'email' | 'fullName'>,
    exportFile?: MulterFile,
  ): Promise<{ message: string; recipientEmail: string; fileName: string }> {
    const recipientEmail = requester.email?.trim();
    if (!recipientEmail || !this.isValidEmail(recipientEmail)) {
      throw new BadRequestException('Authenticated user does not have a valid email address');
    }

    if (!exportFile?.buffer?.length) {
      throw new BadRequestException('Export file is required');
    }

    if (!this.isSupportedExportFile(exportFile)) {
      throw new BadRequestException('Only XLSX workspace chat exports can be emailed');
    }

    const project = await this.getReadableProjectContext(projectId, requester.id);
    const fileName = exportFile.originalname?.trim() || `WorkspaceChat_${projectId}.xlsx`;

    this.logger.log(
      `Workspace chat export email requested (${JSON.stringify({
        userId: requester.id,
        email: recipientEmail,
        projectId,
        fileName,
      })})`,
    );

    try {
      await this.emailService.sendWorkspaceChatExportEmail({
        email: recipientEmail,
        recipientName: requester.fullName,
        projectTitle: project.title,
        fileName,
        fileBuffer: exportFile.buffer,
        mimeType:
          exportFile.mimetype ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        exportedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Workspace chat export email failed (${JSON.stringify({
          userId: requester.id,
          email: recipientEmail,
          projectId,
          fileName,
          error: message,
        })})`,
        error instanceof Error ? error.stack : undefined,
      );
      this.auditLogsService
        .logCustom(
          'WORKSPACE_CHAT_EXPORT_EMAIL_FAILED',
          'Project',
          projectId,
          {
            userId: requester.id,
            email: recipientEmail,
            projectId,
            fileName,
            error: message,
          },
          undefined,
          requester.id,
        )
        .catch(() => {});
      throw new InternalServerErrorException('Failed to email chat export');
    }

    this.logger.log(
      `Workspace chat export email sent (${JSON.stringify({
        userId: requester.id,
        email: recipientEmail,
        projectId,
        fileName,
      })})`,
    );
    this.auditLogsService
      .logCustom(
        'WORKSPACE_CHAT_EXPORT_EMAIL_SENT',
        'Project',
        projectId,
        {
          userId: requester.id,
          email: recipientEmail,
          projectId,
          fileName,
        },
        undefined,
        requester.id,
      )
      .catch(() => {});

    return {
      message: 'Your chat log export has been emailed to you.',
      recipientEmail,
      fileName,
    };
  }

  async saveMessage(
    projectId: string,
    senderId: string,
    content: string,
    attachments?: WorkspaceMessageAttachment[],
    taskId?: string,
    replyToId?: string,
  ): Promise<WorkspaceChatMessage> {
    await this.assertProjectAccess(projectId, senderId);

    return this.persistMessage({
      projectId,
      senderId,
      content,
      attachments,
      taskId,
      replyToId,
      messageType: WorkspaceMessageType.USER,
    });
  }

  async createSystemMessage(
    projectId: string,
    content: string,
    options?: { taskId?: string | null },
  ): Promise<WorkspaceChatMessage> {
    await this.assertProjectExists(projectId);

    return this.persistMessage({
      projectId,
      senderId: null,
      content,
      attachments: [],
      taskId: options?.taskId ?? null,
      messageType: WorkspaceMessageType.SYSTEM,
    });
  }

  async togglePin(
    projectId: string,
    messageId: string,
    userId: string,
    isPinned?: boolean,
  ): Promise<WorkspaceChatMessage> {
    await this.assertProjectAccess(projectId, userId);

    const message = await this.workspaceMessageRepo.findOne({
      where: { id: messageId, projectId },
      select: ['id', 'projectId', 'messageType', 'isPinned', 'isDeleted'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.messageType !== WorkspaceMessageType.USER) {
      throw new BadRequestException('Only user messages can be pinned');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Deleted messages cannot be pinned');
    }

    message.isPinned = typeof isPinned === 'boolean' ? isPinned : !message.isPinned;
    await this.workspaceMessageRepo.save(message);

    const hydrated = await this.getMessageById(message.id);
    if (!hydrated) {
      throw new NotFoundException('Message could not be loaded after pin update');
    }

    WorkspaceChatRealtimeBridge.emitMessage(hydrated);
    return hydrated;
  }

  async editMessage(
    projectId: string,
    messageId: string,
    userId: string,
    content: string,
  ): Promise<WorkspaceChatMessage> {
    await this.assertProjectAccess(projectId, userId);

    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Message content is required');
    }

    const message = await this.workspaceMessageRepo.findOne({
      where: { id: messageId, projectId },
      select: [
        'id',
        'projectId',
        'senderId',
        'messageType',
        'content',
        'isDeleted',
        'isEdited',
        'editHistory',
      ],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.messageType !== WorkspaceMessageType.USER) {
      throw new BadRequestException('Only user messages can be edited');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Deleted messages cannot be edited');
    }

    if (message.content.trim() === trimmedContent) {
      const current = await this.getMessageById(message.id);
      if (!current) {
        throw new NotFoundException('Message not found');
      }
      return current;
    }

    const editHistory = this.normalizeEditHistory(message.editHistory);
    editHistory.push({
      content: message.content,
      editedAt: new Date().toISOString(),
      editorId: userId,
    });

    await this.workspaceMessageRepo.update(
      { id: message.id, projectId },
      {
        content: trimmedContent,
        isEdited: true,
        editHistory,
        riskFlags: this.detectRiskFlags(trimmedContent),
      },
    );

    const hydrated = await this.getMessageById(message.id);
    if (!hydrated) {
      throw new NotFoundException('Message could not be loaded after edit');
    }

    WorkspaceChatRealtimeBridge.emitMessage(hydrated);
    return hydrated;
  }

  async softDeleteMessage(
    projectId: string,
    messageId: string,
    userId: string,
  ): Promise<WorkspaceChatMessage> {
    await this.assertProjectAccess(projectId, userId);

    const message = await this.workspaceMessageRepo.findOne({
      where: { id: messageId, projectId },
      select: ['id', 'projectId', 'senderId', 'messageType', 'isDeleted'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.messageType !== WorkspaceMessageType.USER) {
      throw new BadRequestException('Only user messages can be deleted');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    if (!message.isDeleted) {
      await this.workspaceMessageRepo.update(
        { id: message.id, projectId },
        { isDeleted: true, isPinned: false },
      );
    }

    const hydrated = await this.getMessageById(message.id);
    if (!hydrated) {
      throw new NotFoundException('Message could not be loaded after delete');
    }

    WorkspaceChatRealtimeBridge.emitMessage(hydrated);
    return hydrated;
  }

  async getMessages(
    projectId: string,
    limit = 30,
    offset = 0,
    query?: string,
    requesterId?: string,
  ): Promise<WorkspaceChatMessage[]> {
    if (requesterId) {
      await this.assertProjectReadAccess(projectId, requesterId);
    }

    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 30;
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const normalizedQuery = query?.trim() ?? '';

    const queryBuilder = this.messageSelectQuery().where('message.projectId = :projectId', {
      projectId,
    });

    if (normalizedQuery) {
      queryBuilder
        .andWhere('message.isDeleted = false')
        .andWhere(`message.content ILIKE :searchQuery ESCAPE '\\'`, {
          searchQuery: `%${escapeIlikePattern(normalizedQuery)}%`,
        });
    }

    const rows = await queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .take(normalizedLimit)
      .skip(normalizedOffset)
      .getRawMany<WorkspaceMessageRow>();

    return rows.map((row) => this.mapRowToMessage(row));
  }

  private async getMessageById(messageId: string): Promise<WorkspaceChatMessage | null> {
    const row = await this.messageSelectQuery()
      .where('message.id = :messageId', { messageId })
      .getRawOne<WorkspaceMessageRow>();

    return row ? this.mapRowToMessage(row) : null;
  }

  private messageSelectQuery() {
    return this.workspaceMessageRepo
      .createQueryBuilder('message')
      .leftJoin('message.sender', 'sender')
      .select('message.id', 'id')
      .addSelect('message.projectId', 'projectId')
      .addSelect('message.senderId', 'senderId')
      .addSelect('message.taskId', 'taskId')
      .addSelect('message.replyToId', 'replyToId')
      .addSelect('message.messageType', 'messageType')
      .addSelect('message.content', 'content')
      .addSelect('message.attachments', 'attachments')
      .addSelect('message.isPinned', 'isPinned')
      .addSelect('message.isEdited', 'isEdited')
      .addSelect('message.editHistory', 'editHistory')
      .addSelect('message.isDeleted', 'isDeleted')
      .addSelect('message.riskFlags', 'riskFlags')
      .addSelect('message.createdAt', 'createdAt')
      .addSelect('message.updatedAt', 'updatedAt')
      .addSelect('sender.id', 'senderUserId')
      .addSelect('sender.fullName', 'senderFullName')
      .addSelect('sender.role', 'senderRole')
      .leftJoin('message.replyTo', 'replyTo')
      .leftJoin('replyTo.sender', 'replySender')
      .addSelect('replyTo.id', 'replyMessageId')
      .addSelect('replyTo.messageType', 'replyMessageType')
      .addSelect('replyTo.content', 'replyMessageContent')
      .addSelect('replyTo.attachments', 'replyMessageAttachments')
      .addSelect('replyTo.isDeleted', 'replyMessageIsDeleted')
      .addSelect('replyTo.createdAt', 'replyMessageCreatedAt')
      .addSelect('replySender.id', 'replySenderUserId')
      .addSelect('replySender.fullName', 'replySenderFullName')
      .addSelect('replySender.role', 'replySenderRole');
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      select: ['id'],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async getReadableProjectContext(
    projectId: string,
    userId: string,
  ): Promise<ProjectEntity> {
    const project = await this.getProjectAccessContext(projectId);

    const canRead =
      this.isProjectParticipant(project, userId) ||
      this.isAcceptedSupervisingStaff(project, userId);

    if (!canRead) {
      throw new ForbiddenException('You do not have access to this project chat');
    }

    return project;
  }

  private isSupportedExportFile(file: MulterFile): boolean {
    const normalizedMimeType = `${file.mimetype || ''}`.trim().toLowerCase();
    const normalizedName = `${file.originalname || ''}`.trim().toLowerCase();
    return (
      normalizedName.endsWith('.xlsx') &&
      (normalizedMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        normalizedMimeType === 'application/octet-stream' ||
        normalizedMimeType === '')
    );
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async persistMessage(data: {
    projectId: string;
    senderId: string | null;
    taskId?: string | null;
    replyToId?: string | null;
    content: string;
    attachments?: WorkspaceMessageAttachment[];
    messageType: WorkspaceMessageType;
  }): Promise<WorkspaceChatMessage> {
    const trimmedContent = data.content?.trim() ?? '';
    const attachments = this.normalizeAttachments(data.attachments);
    if (!trimmedContent && attachments.length === 0) {
      throw new BadRequestException('Message content or attachments are required');
    }

    const normalizedTaskId = data.taskId?.trim() || null;
    const normalizedReplyToId = data.replyToId?.trim() || null;
    if (normalizedTaskId) {
      const task = await this.taskRepo.findOne({
        where: { id: normalizedTaskId, projectId: data.projectId },
        select: ['id'],
      });

      if (!task) {
        throw new BadRequestException('Task not found in this project');
      }
    }

    if (normalizedReplyToId) {
      const replyTarget = await this.workspaceMessageRepo.findOne({
        where: { id: normalizedReplyToId, projectId: data.projectId },
        select: ['id'],
      });

      if (!replyTarget) {
        throw new BadRequestException('Reply target not found in this project');
      }
    }

    const created = this.workspaceMessageRepo.create({
      projectId: data.projectId,
      senderId: data.senderId,
      taskId: normalizedTaskId,
      replyToId: normalizedReplyToId,
      content: trimmedContent,
      attachments,
      messageType: data.messageType,
      riskFlags: trimmedContent ? this.detectRiskFlags(trimmedContent) : [],
    });

    const saved = await this.workspaceMessageRepo.save(created);
    const hydrated = await this.getMessageById(saved.id);

    if (!hydrated) {
      throw new NotFoundException('Message could not be loaded after save');
    }

    WorkspaceChatRealtimeBridge.emitMessage(hydrated);
    return hydrated;
  }

  private detectRiskFlags(content: string): string[] {
    const normalized = normalizeForRiskScan(content);
    return OFF_PLATFORM_RISK_RULES.filter((rule) => rule.pattern.test(normalized)).map(
      (rule) => rule.flag,
    );
  }

  private parseRiskFlags(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string');
        }
      } catch {
        return [];
      }
    }

    return [];
  }

  private normalizeAttachments(value: unknown): WorkspaceMessageAttachment[] {
    if (Array.isArray(value)) {
      return value
        .map((attachment) => this.sanitizeAttachment(attachment))
        .filter((attachment): attachment is WorkspaceMessageAttachment => Boolean(attachment));
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return this.normalizeAttachments(parsed);
      } catch {
        return [];
      }
    }

    return [];
  }

  private sanitizeAttachment(value: unknown): WorkspaceMessageAttachment | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!url) {
      return null;
    }

    const name =
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : this.inferAttachmentName(url);
    const type =
      typeof record.type === 'string' && record.type.trim()
        ? record.type.trim()
        : 'application/octet-stream';

    return { url, name, type };
  }

  private inferAttachmentName(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const fileNameFromHash = new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).get(
        'filename',
      );
      if (fileNameFromHash?.trim()) {
        return decodeURIComponent(fileNameFromHash);
      }

      const fileNameFromQuery = parsedUrl.searchParams.get('filename');
      if (fileNameFromQuery?.trim()) {
        return decodeURIComponent(fileNameFromQuery);
      }

      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        return decodeURIComponent(lastSegment);
      }
    } catch {
      const hashSegment = url.split('#')[1] || '';
      const fileNameFromHash = new URLSearchParams(hashSegment).get('filename');
      if (fileNameFromHash?.trim()) {
        return decodeURIComponent(fileNameFromHash);
      }

      const segments = url.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        return decodeURIComponent(lastSegment.split('?')[0]);
      }
    }

    return 'attachment';
  }

  private normalizeEditHistory(value: unknown): WorkspaceMessageEditHistoryEntry[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.sanitizeEditHistoryEntry(entry))
        .filter((entry): entry is WorkspaceMessageEditHistoryEntry => Boolean(entry));
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return this.normalizeEditHistory(parsed);
      } catch {
        return [];
      }
    }

    return [];
  }

  private sanitizeEditHistoryEntry(value: unknown): WorkspaceMessageEditHistoryEntry | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const content = typeof record.content === 'string' ? record.content : '';
    const editedAt = typeof record.editedAt === 'string' ? record.editedAt : '';
    const editorId = typeof record.editorId === 'string' ? record.editorId : null;

    if (!content || !editedAt) {
      return null;
    }

    return {
      content,
      editedAt,
      editorId,
    };
  }

  private mapRowToMessage(row: WorkspaceMessageRow): WorkspaceChatMessage {
    return {
      id: row.id,
      projectId: row.projectId,
      senderId: row.senderId,
      taskId: row.taskId,
      replyToId: row.replyToId,
      messageType:
        row.messageType === WorkspaceMessageType.SYSTEM
          ? WorkspaceMessageType.SYSTEM
          : WorkspaceMessageType.USER,
      content: row.content,
      attachments: this.normalizeAttachments(row.attachments),
      isPinned: Boolean(row.isPinned),
      isEdited: Boolean(row.isEdited),
      editHistory: this.normalizeEditHistory(row.editHistory),
      isDeleted: Boolean(row.isDeleted),
      riskFlags: this.parseRiskFlags(row.riskFlags),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sender: row.senderUserId
        ? {
            id: row.senderUserId,
            fullName: row.senderFullName || 'Unknown',
            role: row.senderRole,
          }
        : null,
      replyTo: row.replyMessageId
        ? {
            id: row.replyMessageId,
            messageType:
              row.replyMessageType === WorkspaceMessageType.SYSTEM
                ? WorkspaceMessageType.SYSTEM
                : WorkspaceMessageType.USER,
            content: row.replyMessageContent || '',
            attachments: this.normalizeAttachments(row.replyMessageAttachments),
            isDeleted: Boolean(row.replyMessageIsDeleted),
            createdAt: row.replyMessageCreatedAt ?? row.createdAt,
            sender: row.replySenderUserId
              ? {
                  id: row.replySenderUserId,
                  fullName: row.replySenderFullName || 'Unknown',
                  role: row.replySenderRole,
                }
              : null,
          }
        : null,
    };
  }
}
