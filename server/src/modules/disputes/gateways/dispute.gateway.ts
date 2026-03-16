import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import {
  UserEntity,
  UserRole,
  DisputeEntity,
  DisputeHearingEntity,
  HearingParticipantEntity,
  DisputeInternalMembershipEntity,
  DisputePartyEntity,
} from 'src/database/entities';
import { HearingService } from '../services/hearing.service';
import { DisputesService } from '../disputes.service';
import { SendDisputeMessageDto } from '../dto/message.dto';
import { ResolveObjectionDto } from '../dto/hearing.dto';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
};

const parseWsCorsOrigins = (): string[] => {
  const defaults = [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:5174',
    'https://localhost:5174',
    'http://localhost:3001',
  ];
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return defaults;
  const parsed = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (parsed.length === 0) {
    return defaults;
  }
  return Array.from(new Set([...defaults, ...parsed]));
};

type WsUser = {
  id: string;
  role: UserRole;
  email?: string;
};

type SendDisputeMessageAck =
  | {
      success: true;
      messageId: string;
      disputeId: string;
      hearingId?: string | null;
      createdAt: string;
    }
  | {
      success: false;
      error: string;
      errorCode?:
        | 'CHAT_NOT_ALLOWED'
        | 'HEARING_INVITE_DECLINED'
        | 'HEARING_NOT_ACTIVE'
        | 'SPEAKER_BLOCKED'
        | 'DISPUTE_ACCESS_DENIED';
      retryable?: boolean;
    };

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  },
  pingInterval: 25000,
  pingTimeout: 30000,
})
export class DisputeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DisputeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly hearingService: HearingService,
    private readonly disputesService: DisputesService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly participantRepo: Repository<HearingParticipantEntity>,
    @InjectRepository(DisputeInternalMembershipEntity)
    private readonly internalMembershipRepo: Repository<DisputeInternalMembershipEntity>,
    @InjectRepository(DisputePartyEntity)
    private readonly disputePartyRepo: Repository<DisputePartyEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      client.data.hearingIds = new Set<string>();
      await client.join(this.userRoom(user.id));
      this.logger.log(`WS connected: ${user.email} (${user.role}) sid=${client.id}`);
    } catch (error) {
      this.logger.warn(`WS auth failed: ${error instanceof Error ? error.message : 'unknown'}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as WsUser | undefined;
    if (!user) {
      return;
    }

    const hearingIds = client.data.hearingIds as Set<string> | undefined;
    this.logger.log(
      `WS disconnected: ${user.email} sid=${client.id} hearings=${hearingIds?.size ?? 0}`,
    );

    if (!hearingIds || hearingIds.size === 0) {
      return;
    }

    for (const hearingId of hearingIds) {
      try {
        await this.hearingService.markParticipantOffline(hearingId, user.id);
      } catch (error) {
        this.logger.warn(
          `Failed to mark offline for hearing ${hearingId}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
  }

  @SubscribeMessage('joinDispute')
  async joinDispute(
    @MessageBody() data: { disputeId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: boolean; room: string }> {
    if (!data?.disputeId) {
      throw new WsException('disputeId is required');
    }

    const user = this.getUser(client);
    await this.ensureDisputeAccess(data.disputeId, user);

    const room = this.disputeRoom(data.disputeId);
    await client.join(room);
    return { joined: true, room };
  }

  @SubscribeMessage('leaveDispute')
  async leaveDispute(
    @MessageBody() data: { disputeId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ left: boolean; room: string }> {
    if (!data?.disputeId) {
      throw new WsException('disputeId is required');
    }

    const room = this.disputeRoom(data.disputeId);
    await client.leave(room);
    return { left: true, room };
  }

  @SubscribeMessage('joinHearing')
  async joinHearing(
    @MessageBody() data: { hearingId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: boolean; room: string }> {
    if (!data?.hearingId) {
      throw new WsException('hearingId is required');
    }

    const user = this.getUser(client);
    const access = await this.ensureHearingAccess(data.hearingId, user);

    const room = this.hearingRoom(data.hearingId);
    await client.join(room);

    if (access.trackPresence) {
      await this.hearingService.markParticipantOnline(data.hearingId, user.id);
      this.trackHearing(client, data.hearingId);
    }

    this.logger.log(
      `joinHearing: ${user.email} joined ${data.hearingId.slice(0, 8)}... track=${access.trackPresence}`,
    );

    // Send the current presence state of ALL participants to the joining
    // client so it can reconcile any stale data from the initial REST fetch.
    try {
      const presenceSnapshot = await this.hearingService.getParticipantsPresence(data.hearingId);
      client.emit('HEARING_PRESENCE_SYNC', {
        hearingId: data.hearingId,
        participants: presenceSnapshot,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to emit HEARING_PRESENCE_SYNC: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    return { joined: true, room };
  }

  @SubscribeMessage('leaveHearing')
  async leaveHearing(
    @MessageBody() data: { hearingId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ left: boolean; room: string }> {
    if (!data?.hearingId) {
      throw new WsException('hearingId is required');
    }

    const user = this.getUser(client);
    const room = this.hearingRoom(data.hearingId);
    await client.leave(room);

    const hearingIds = client.data.hearingIds as Set<string> | undefined;
    if (hearingIds?.has(data.hearingId)) {
      await this.hearingService.markParticipantOffline(data.hearingId, user.id);
      this.untrackHearing(client, data.hearingId);
    }

    return { left: true, room };
  }

  @SubscribeMessage('joinStaffDashboard')
  async joinStaffDashboard(
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: boolean; room: string }> {
    const user = this.getUser(client);
    if (![UserRole.STAFF, UserRole.ADMIN].includes(user.role)) {
      throw new WsException('Only staff or admin can join staff dashboard');
    }

    const room = this.staffDashboardRoom();
    await client.join(room);
    return { joined: true, room };
  }

  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @SubscribeMessage('sendDisputeMessage')
  async sendDisputeMessage(
    @MessageBody() dto: SendDisputeMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<SendDisputeMessageAck> {
    const user = this.getUser(client);

    try {
      await this.ensureDisputeAccess(dto.disputeId, user);
      if (dto.hearingId) {
        await this.ensureHearingAccess(dto.hearingId, user);
      }

      const saved = await this.disputesService.sendDisputeMessage(dto, user.id, user.role, user);

      return {
        success: true,
        messageId: saved.id,
        disputeId: saved.disputeId,
        hearingId: saved.hearingId,
        createdAt: saved.createdAt.toISOString(),
      };
    } catch (error) {
      const mapped = this.mapSendDisputeMessageError(error);
      if (!mapped) {
        throw error;
      }

      this.logger.warn(
        `sendDisputeMessage rejected disputeId=${dto.disputeId} hearingId=${dto.hearingId ?? 'none'} userId=${user.id} code=${mapped.errorCode} retryable=${mapped.retryable}`,
      );

      return {
        success: false,
        error: mapped.error,
        errorCode: mapped.errorCode,
        retryable: mapped.retryable,
      };
    }
  }

  @SubscribeMessage('leaveStaffDashboard')
  async leaveStaffDashboard(
    @ConnectedSocket() client: Socket,
  ): Promise<{ left: boolean; room: string }> {
    const room = this.staffDashboardRoom();
    await client.leave(room);
    return { left: true, room };
  }

  @SubscribeMessage('HEARING_TYPING')
  handleHearingTyping(
    @MessageBody() data: { hearingId: string; isTyping?: boolean },
    @ConnectedSocket() client: Socket,
  ): void {
    if (!data?.hearingId) return;
    const user = this.getUser(client);
    const room = this.hearingRoom(data.hearingId);
    // Broadcast to everyone in the room EXCEPT the sender.
    this.emitToRoomSafely(
      room,
      'HEARING_TYPING',
      {
        userId: user.id,
        isTyping: data.isTyping ?? true,
      },
      client.id,
    );
  }

  @SubscribeMessage('resolveObjection')
  async resolveObjection(
    @MessageBody()
    data: { hearingId: string; statementId: string; ruling: 'SUSTAINED' | 'OVERRULED' },
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; statementId?: string; ruling?: string; error?: string }> {
    if (!data?.hearingId) {
      throw new WsException('hearingId is required');
    }
    if (!data?.statementId) {
      throw new WsException('statementId is required');
    }
    if (!data?.ruling || !['SUSTAINED', 'OVERRULED'].includes(data.ruling)) {
      throw new WsException('ruling must be SUSTAINED or OVERRULED');
    }

    const user = this.getUser(client);

    try {
      await this.ensureHearingAccess(data.hearingId, user);

      const dto = new ResolveObjectionDto();
      dto.statementId = data.statementId;
      dto.ruling = data.ruling;

      const result = await this.hearingService.resolveObjection(data.hearingId, dto, user.id);

      return {
        success: true,
        statementId: result.id,
        ruling: result.objectionStatus,
      };
    } catch (error) {
      const message =
        error instanceof WsException
          ? error.getError()
          : error instanceof Error
            ? error.message
            : 'Failed to resolve objection';
      const errorMessage = typeof message === 'string' ? message : 'Failed to resolve objection';

      this.logger.warn(
        `resolveObjection failed hearingId=${data.hearingId} statementId=${data.statementId} userId=${user.id}: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  emitDisputeEvent(disputeId: string, event: string, payload: Record<string, any>): void {
    if (!this.server) {
      return;
    }
    this.emitToRoomSafely(this.disputeRoom(disputeId), event, payload);
  }

  emitHearingEvent(hearingId: string, event: string, payload: Record<string, any>): void {
    if (!this.server) {
      return;
    }
    this.emitToRoomSafely(this.hearingRoom(hearingId), event, payload);
  }

  emitStaffDashboardEvent(event: string, payload: Record<string, any>): void {
    if (!this.server) {
      return;
    }
    this.emitToRoomSafely(this.staffDashboardRoom(), event, payload);
  }

  emitUserEvent(userId: string, event: string, payload: Record<string, any>): void {
    if (!this.server || !userId) {
      return;
    }
    this.emitToRoomSafely(this.userRoom(userId), event, payload);
  }

  private async authenticate(client: Socket): Promise<WsUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Missing token');
    }

    const payload = this.jwtService.verify(token);
    if (!payload?.sub) {
      throw new WsException('Invalid token payload');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.isBanned) {
      throw new WsException('User not found or banned');
    }

    return {
      id: user.id,
      role: user.role,
      email: user.email,
    };
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = (client.handshake.auth as { token?: string } | undefined)?.token;
    const queryToken = (client.handshake.query as { token?: string } | undefined)?.token;
    const header = client.handshake.headers?.authorization;
    const cookieToken = this.extractTokenFromCookie(client.handshake.headers?.cookie);

    if (authToken) {
      return authToken;
    }
    if (cookieToken) {
      return cookieToken;
    }
    if (queryToken) {
      return queryToken;
    }
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }

  private extractTokenFromCookie(cookieHeader: string | string[] | undefined): string | undefined {
    const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
    if (!rawCookie) {
      return undefined;
    }

    const cookies = rawCookie
      .split(';')
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (const cookie of cookies) {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const name = cookie.slice(0, separatorIndex).trim();
      const value = cookie.slice(separatorIndex + 1).trim();
      if (name === 'accessToken' && value) {
        return decodeURIComponent(value);
      }
    }

    return undefined;
  }

  private getUser(client: Socket): WsUser {
    const user = client.data.user as WsUser | undefined;
    if (!user) {
      throw new WsException('Unauthorized socket');
    }
    return user;
  }

  private async ensureDisputeAccess(disputeId: string, user: WsUser): Promise<void> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      select: [
        'id',
        'groupId',
        'raisedById',
        'defendantId',
        'assignedStaffId',
        'escalatedToAdminId',
      ],
    });

    if (!dispute) {
      throw new WsException('Dispute not found');
    }

    if (user.role === UserRole.ADMIN) {
      return;
    }

    const isParty = user.id === dispute.raisedById || user.id === dispute.defendantId;
    const isAssignedStaff = user.role === UserRole.STAFF && user.id === dispute.assignedStaffId;
    const isEscalatedAdmin = user.id === dispute.escalatedToAdminId;
    const hasInternalAccess =
      user.role === UserRole.STAFF
        ? await this.internalMembershipRepo.findOne({
            where: { disputeId: dispute.id, userId: user.id },
            select: ['id'],
          })
        : null;
    const groupId = dispute.groupId || dispute.id;
    const isGroupPartyMember = await this.disputePartyRepo.findOne({
      where: { groupId, userId: user.id },
      select: ['id'],
    });

    if (
      !isParty &&
      !isAssignedStaff &&
      !isEscalatedAdmin &&
      !hasInternalAccess &&
      !isGroupPartyMember
    ) {
      throw new WsException('Access denied');
    }
  }

  private async ensureHearingAccess(
    hearingId: string,
    user: WsUser,
  ): Promise<{ trackPresence: boolean }> {
    const hearing = await this.hearingRepo.findOne({
      where: { id: hearingId },
      select: ['id', 'moderatorId'],
    });

    if (!hearing) {
      throw new WsException('Hearing not found');
    }

    const participant = await this.participantRepo.findOne({
      where: { hearingId, userId: user.id },
      select: ['id'],
    });

    const isModerator = hearing.moderatorId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!participant && !isModerator && !isAdmin) {
      throw new WsException('Access denied');
    }

    const hasDeclined = await this.hearingService.isHearingInviteDeclined(hearingId, user.id);
    if (hasDeclined && !isModerator && !isAdmin) {
      throw new WsException('You declined this hearing invitation');
    }

    // Track presence for anyone who has a participant record
    // (moderators/admins may also have one)
    return { trackPresence: Boolean(participant) || isModerator || isAdmin };
  }

  private mapSendDisputeMessageError(error: unknown): {
    error: string;
    errorCode: NonNullable<Extract<SendDisputeMessageAck, { success: false }>['errorCode']>;
    retryable: boolean;
  } | null {
    const rawMessage =
      error instanceof WsException
        ? error.getError()
        : error instanceof Error
          ? error.message
          : 'Message delivery failed';
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : typeof rawMessage === 'object' && rawMessage && 'message' in rawMessage
          ? String((rawMessage as { message?: unknown }).message ?? 'Message delivery failed')
          : 'Message delivery failed';
    const normalized = message.toLowerCase();

    if (
      error instanceof WsException ||
      error instanceof ForbiddenException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      if (normalized.includes('declined this hearing invitation')) {
        return {
          error: message,
          errorCode: 'HEARING_INVITE_DECLINED',
          retryable: false,
        };
      }
      if (normalized.includes('not allowed to speak')) {
        return {
          error: message,
          errorCode: 'SPEAKER_BLOCKED',
          retryable: false,
        };
      }
      if (
        normalized.includes('chat room is not active') ||
        normalized.includes('hearing is paused')
      ) {
        return {
          error: message,
          errorCode: 'HEARING_NOT_ACTIVE',
          retryable: false,
        };
      }
      if (normalized.includes('access denied') || normalized.includes('unauthorized socket')) {
        return {
          error: message,
          errorCode: 'DISPUTE_ACCESS_DENIED',
          retryable: false,
        };
      }
      return {
        error: message,
        errorCode: 'CHAT_NOT_ALLOWED',
        retryable: false,
      };
    }

    return null;
  }

  private disputeRoom(disputeId: string): string {
    return `/ws/disputes/${disputeId}`;
  }

  private hearingRoom(hearingId: string): string {
    return `/ws/hearings/${hearingId}`;
  }

  private staffDashboardRoom(): string {
    return '/ws/staff/dashboard';
  }

  private userRoom(userId: string): string {
    return `/ws/users/${userId}`;
  }

  private emitToRoomSafely(
    room: string,
    event: string,
    payload: Record<string, any>,
    excludeSocketId?: string,
  ): void {
    if (!this.server) {
      return;
    }

    try {
      if (excludeSocketId) {
        this.server.except(excludeSocketId).to(room).emit(event, payload);
      } else {
        this.server.to(room).emit(event, payload);
      }
      return;
    } catch (error) {
      this.logger.warn(
        `Socket emit failed (room=${room}, event=${event}). Falling back to local sockets only: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    this.emitToLocalRoom(room, event, payload, excludeSocketId);
  }

  private emitToLocalRoom(
    room: string,
    event: string,
    payload: Record<string, any>,
    excludeSocketId?: string,
  ): void {
    if (!this.server) {
      return;
    }

    const socketIds = this.server.sockets.adapter.rooms.get(room);
    if (!socketIds || socketIds.size === 0) {
      return;
    }

    for (const socketId of socketIds) {
      if (excludeSocketId && socketId === excludeSocketId) {
        continue;
      }
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(event, payload);
      }
    }
  }

  private trackHearing(client: Socket, hearingId: string): void {
    const hearingIds = client.data.hearingIds as Set<string> | undefined;
    if (hearingIds) {
      hearingIds.add(hearingId);
    }
  }

  private untrackHearing(client: Socket, hearingId: string): void {
    const hearingIds = client.data.hearingIds as Set<string> | undefined;
    if (hearingIds) {
      hearingIds.delete(hearingId);
    }
  }
}
