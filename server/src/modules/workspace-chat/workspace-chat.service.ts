import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectEntity,
  TaskEntity,
  UserRole,
  WorkspaceMessageEntity,
} from 'src/database/entities';

interface WorkspaceMessageRow {
  id: string;
  projectId: string;
  senderId: string;
  taskId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  senderUserId: string | null;
  senderFullName: string | null;
  senderRole: UserRole | null;
}

export interface WorkspaceChatMessage {
  id: string;
  projectId: string;
  senderId: string;
  taskId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    fullName: string;
    role: UserRole | null;
  } | null;
}

@Injectable()
export class WorkspaceChatService {
  constructor(
    @InjectRepository(WorkspaceMessageEntity)
    private readonly workspaceMessageRepo: Repository<WorkspaceMessageEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(TaskEntity)
    private readonly taskRepo: Repository<TaskEntity>,
  ) {}

  async assertProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      select: ['id', 'clientId', 'brokerId', 'freelancerId'],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isParticipant =
      project.clientId === userId ||
      project.brokerId === userId ||
      project.freelancerId === userId;

    if (!isParticipant) {
      throw new ForbiddenException('You do not have access to this project chat');
    }
  }

  async saveMessage(
    projectId: string,
    senderId: string,
    content: string,
    taskId?: string,
  ): Promise<WorkspaceChatMessage> {
    await this.assertProjectAccess(projectId, senderId);

    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new BadRequestException('Message content is required');
    }

    const normalizedTaskId = taskId?.trim() || null;
    if (normalizedTaskId) {
      const task = await this.taskRepo.findOne({
        where: { id: normalizedTaskId, projectId },
        select: ['id'],
      });

      if (!task) {
        throw new BadRequestException('Task not found in this project');
      }
    }

    const created = this.workspaceMessageRepo.create({
      projectId,
      senderId,
      content: trimmedContent,
      taskId: normalizedTaskId,
    });

    const saved = await this.workspaceMessageRepo.save(created);
    const hydrated = await this.getMessageById(saved.id);

    if (!hydrated) {
      throw new NotFoundException('Message could not be loaded after save');
    }

    return hydrated;
  }

  async getMessages(
    projectId: string,
    limit = 30,
    offset = 0,
    requesterId?: string,
  ): Promise<WorkspaceChatMessage[]> {
    if (requesterId) {
      await this.assertProjectAccess(projectId, requesterId);
    }

    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 30;
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;

    const rows = await this.messageSelectQuery()
      .where('message.projectId = :projectId', { projectId })
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
      .addSelect('message.content', 'content')
      .addSelect('message.createdAt', 'createdAt')
      .addSelect('message.updatedAt', 'updatedAt')
      .addSelect('sender.id', 'senderUserId')
      .addSelect('sender.fullName', 'senderFullName')
      .addSelect('sender.role', 'senderRole');
  }

  private mapRowToMessage(row: WorkspaceMessageRow): WorkspaceChatMessage {
    return {
      id: row.id,
      projectId: row.projectId,
      senderId: row.senderId,
      taskId: row.taskId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sender: row.senderUserId
        ? {
            id: row.senderUserId,
            fullName: row.senderFullName || 'Unknown',
            role: row.senderRole,
          }
        : null,
    };
  }
}

