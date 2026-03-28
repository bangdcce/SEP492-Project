import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPublicUploadUrl, extractUploadStoragePath } from '../../common/utils/public-upload-url.util';
import {
  extractRequestChatStoragePath,
  getRequestChatSignedUrl,
} from '../../common/utils/supabase-object-storage.util';
import {
  ProjectRequestEntity,
  RequestMessageEntity,
  RequestMessageType,
  type UserEntity,
  UserRole,
  type WorkspaceMessageAttachment,
  type WorkspaceMessageEditHistoryEntry,
} from 'src/database/entities';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestChatRealtimeBridge } from './request-chat.realtime';

export interface RequestChatReplySummary {
  id: string;
  messageType: RequestMessageType;
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

export interface RequestChatMessage {
  id: string;
  requestId: string;
  senderId: string | null;
  replyToId: string | null;
  messageType: RequestMessageType;
  content: string;
  attachments: WorkspaceMessageAttachment[];
  isEdited: boolean;
  editHistory: WorkspaceMessageEditHistoryEntry[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    fullName: string;
    role: UserRole | null;
  } | null;
  replyTo: RequestChatReplySummary | null;
}

@Injectable()
export class RequestChatService {
  constructor(
    @InjectRepository(RequestMessageEntity)
    private readonly requestMessageRepo: Repository<RequestMessageEntity>,
    @InjectRepository(ProjectRequestEntity)
    private readonly requestRepo: Repository<ProjectRequestEntity>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getRequestAccessContext(requestId: string): Promise<ProjectRequestEntity> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['proposals'],
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  private isAcceptedFreelancerParticipant(
    request: ProjectRequestEntity,
    userId: string,
  ): boolean {
    return Boolean(
      request.proposals?.some(
        (proposal) =>
          proposal.freelancerId === userId &&
          ['ACCEPTED', 'PENDING'].includes(String(proposal.status || '').toUpperCase()),
      ),
    );
  }

  private canReadRequestChat(
    request: ProjectRequestEntity,
    userId: string,
    role: UserRole,
  ): boolean {
    if (role === UserRole.ADMIN || role === UserRole.STAFF) {
      return true;
    }

    return (
      request.clientId === userId ||
      request.brokerId === userId ||
      this.isAcceptedFreelancerParticipant(request, userId)
    );
  }

  private canWriteRequestChat(
    request: ProjectRequestEntity,
    userId: string,
    role: UserRole,
  ): boolean {
    if (role === UserRole.ADMIN || role === UserRole.STAFF) {
      return false;
    }

    return (
      request.clientId === userId ||
      request.brokerId === userId ||
      this.isAcceptedFreelancerParticipant(request, userId)
    );
  }

  private normalizeAttachmentsForPersistence(value: unknown): WorkspaceMessageAttachment[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        const attachment = item as Partial<WorkspaceMessageAttachment>;
        const rawUrl = String(attachment?.url || '').trim();
        const objectStoragePath =
          extractRequestChatStoragePath(attachment?.storagePath) ||
          extractRequestChatStoragePath(attachment?.url);
        const localStoragePath =
          extractUploadStoragePath(attachment?.storagePath) ||
          extractUploadStoragePath(attachment?.url);
        const storagePath = objectStoragePath ?? localStoragePath;
        const name = String(attachment?.name || '').trim();
        const type = String(attachment?.type || '').trim();

        if ((!storagePath && !rawUrl) || !name || !type) {
          return null;
        }

        return {
          url: objectStoragePath || localStoragePath || rawUrl,
          storagePath,
          name,
          type,
        };
      })
      .filter((item): item is WorkspaceMessageAttachment => Boolean(item));
  }

  private async resolveAttachmentUrl(attachment: Partial<WorkspaceMessageAttachment>): Promise<string> {
    const objectStoragePath =
      extractRequestChatStoragePath(attachment?.storagePath) ||
      extractRequestChatStoragePath(attachment?.url);
    if (objectStoragePath) {
      return getRequestChatSignedUrl(objectStoragePath);
    }

    const localStoragePath =
      extractUploadStoragePath(attachment?.storagePath) ||
      extractUploadStoragePath(attachment?.url);
    if (localStoragePath) {
      return buildPublicUploadUrl(localStoragePath);
    }

    return String(attachment?.url || '').trim();
  }

  private async hydrateAttachments(value: unknown): Promise<WorkspaceMessageAttachment[]> {
    const attachments = this.normalizeAttachmentsForPersistence(value);
    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        url: await this.resolveAttachmentUrl(attachment),
      })),
    );
  }

  private normalizeEditHistory(value: unknown): WorkspaceMessageEditHistoryEntry[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        const candidate = item as Partial<WorkspaceMessageEditHistoryEntry>;
        const content = String(candidate?.content || '').trim();
        const editedAt = String(candidate?.editedAt || '').trim();
        if (!content || !editedAt) {
          return null;
        }

        return {
          content,
          editedAt,
          editorId: candidate?.editorId ?? null,
        };
      })
      .filter((item): item is WorkspaceMessageEditHistoryEntry => Boolean(item));
  }

  private async toReplySummary(
    message?: RequestMessageEntity | null,
  ): Promise<RequestChatReplySummary | null> {
    if (!message) {
      return null;
    }

    return {
      id: message.id,
      messageType: message.messageType,
      content: message.content,
      attachments: await this.hydrateAttachments(message.attachments),
      isDeleted: Boolean(message.isDeleted),
      createdAt: message.createdAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            fullName: message.sender.fullName,
            role: message.sender.role ?? null,
          }
        : null,
    };
  }

  private async toMessage(message: RequestMessageEntity): Promise<RequestChatMessage> {
    return {
      id: message.id,
      requestId: message.requestId,
      senderId: message.senderId,
      replyToId: message.replyToId,
      messageType: message.messageType,
      content: message.content,
      attachments: await this.hydrateAttachments(message.attachments),
      isEdited: Boolean(message.isEdited),
      editHistory: this.normalizeEditHistory(message.editHistory),
      isDeleted: Boolean(message.isDeleted),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            fullName: message.sender.fullName,
            role: message.sender.role ?? null,
          }
        : null,
      replyTo: await this.toReplySummary(message.replyTo),
    };
  }

  private async getMessageById(messageId: string): Promise<RequestChatMessage | null> {
    const message = await this.requestMessageRepo.findOne({
      where: { id: messageId },
      relations: ['sender', 'replyTo', 'replyTo.sender'],
    });

    return message ? this.toMessage(message) : null;
  }

  private async getParticipantIds(request: ProjectRequestEntity): Promise<string[]> {
    const ids = new Set<string>();
    if (request.clientId) {
      ids.add(request.clientId);
    }
    if (request.brokerId) {
      ids.add(request.brokerId);
    }

    for (const proposal of request.proposals || []) {
      if (['ACCEPTED', 'PENDING'].includes(String(proposal.status || '').toUpperCase())) {
        ids.add(proposal.freelancerId);
      }
    }

    return Array.from(ids);
  }

  async assertRequestReadAccess(requestId: string, userId: string, role: UserRole): Promise<void> {
    const request = await this.getRequestAccessContext(requestId);
    if (!this.canReadRequestChat(request, userId, role)) {
      throw new ForbiddenException('You do not have access to this request chat');
    }
  }

  async assertRequestWriteAccess(requestId: string, userId: string, role: UserRole): Promise<void> {
    const request = await this.getRequestAccessContext(requestId);
    if (!this.canWriteRequestChat(request, userId, role)) {
      throw new ForbiddenException('You do not have write access to this request chat');
    }
  }

  async getMessages(
    requestId: string,
    limit: number,
    offset: number,
    userId: string,
    role: UserRole,
  ): Promise<RequestChatMessage[]> {
    await this.assertRequestReadAccess(requestId, userId, role);

    const messages = await this.requestMessageRepo.find({
      where: { requestId },
      relations: ['sender', 'replyTo', 'replyTo.sender'],
      order: { createdAt: 'ASC' },
      take: Math.max(1, Math.min(100, limit)),
      skip: Math.max(0, offset),
    });

    return Promise.all(messages.map((message) => this.toMessage(message)));
  }

  async saveMessage(
    requestId: string,
    sender: Pick<UserEntity, 'id' | 'role'>,
    content: string,
    attachments?: WorkspaceMessageAttachment[],
    replyToId?: string,
  ): Promise<RequestChatMessage> {
    await this.assertRequestWriteAccess(requestId, sender.id, sender.role);

    const trimmedContent = String(content || '').trim();
    const normalizedAttachments = this.normalizeAttachmentsForPersistence(attachments);

    if (!trimmedContent && normalizedAttachments.length === 0) {
      throw new BadRequestException('Message content or attachments are required');
    }

    if (replyToId) {
      const replyTarget = await this.requestMessageRepo.findOne({
        where: { id: replyToId, requestId },
        select: ['id'],
      });

      if (!replyTarget) {
        throw new NotFoundException('Reply target was not found in this request chat');
      }
    }

    const message = await this.requestMessageRepo.save(
      this.requestMessageRepo.create({
        requestId,
        senderId: sender.id,
        replyToId: replyToId ?? null,
        messageType: RequestMessageType.USER,
        content: trimmedContent,
        attachments: normalizedAttachments,
      }),
    );

    const hydrated = await this.getMessageById(message.id);
    if (!hydrated) {
      throw new NotFoundException('Message could not be loaded after save');
    }

    RequestChatRealtimeBridge.emitMessage(hydrated);

    const request = await this.getRequestAccessContext(requestId);
    const participants = await this.getParticipantIds(request);
    const preview =
      trimmedContent ||
      normalizedAttachments.map((attachment) => attachment.name).join(', ').slice(0, 120);

    await this.notificationsService.createMany(
      participants
        .filter((participantId) => participantId !== sender.id)
        .map((participantId) => ({
          userId: participantId,
          title: 'New request message',
          body: `${request.title}: ${preview.slice(0, 180)}`,
          relatedType: 'ProjectRequest',
          relatedId: requestId,
        })),
    );

    return hydrated;
  }

  async createSystemMessage(requestId: string, content: string): Promise<RequestChatMessage> {
    const request = await this.getRequestAccessContext(requestId);
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('System message content is required');
    }

    const message = await this.requestMessageRepo.save(
      this.requestMessageRepo.create({
        requestId,
        senderId: null,
        replyToId: null,
        messageType: RequestMessageType.SYSTEM,
        content: trimmedContent,
        attachments: [],
      }),
    );

    const hydrated = await this.getMessageById(message.id);
    if (!hydrated) {
      throw new NotFoundException('System message could not be loaded after save');
    }

    RequestChatRealtimeBridge.emitMessage(hydrated);

    await this.notificationsService.createMany(
      (await this.getParticipantIds(request)).map((participantId) => ({
        userId: participantId,
        title: 'Request update',
        body: `${request.title}: ${trimmedContent.slice(0, 180)}`,
        relatedType: 'ProjectRequest',
        relatedId: requestId,
      })),
    );

    return hydrated;
  }
}
