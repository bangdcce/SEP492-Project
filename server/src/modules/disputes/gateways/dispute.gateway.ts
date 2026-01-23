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
import { Logger } from '@nestjs/common';
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
} from 'src/database/entities';
import { HearingService } from '../services/hearing.service';

type WsUser = {
  id: string;
  role: UserRole;
  email?: string;
};

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3001',
      'https://chantell-chemotropic-noncontroversially.ngrok-free.dev',
    ],
    credentials: true,
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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(DisputeHearingEntity)
    private readonly hearingRepo: Repository<DisputeHearingEntity>,
    @InjectRepository(HearingParticipantEntity)
    private readonly participantRepo: Repository<HearingParticipantEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      client.data.hearingIds = new Set<string>();
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
    client.join(room);
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
    client.leave(room);
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
    client.join(room);

    if (access.trackPresence) {
      await this.hearingService.markParticipantOnline(data.hearingId, user.id);
      this.trackHearing(client, data.hearingId);
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
    client.leave(room);

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
    client.join(room);
    return { joined: true, room };
  }

  @SubscribeMessage('leaveStaffDashboard')
  async leaveStaffDashboard(
    @ConnectedSocket() client: Socket,
  ): Promise<{ left: boolean; room: string }> {
    const room = this.staffDashboardRoom();
    client.leave(room);
    return { left: true, room };
  }

  emitDisputeEvent(disputeId: string, event: string, payload: Record<string, any>): void {
    if (!this.server) {
      return;
    }
    this.server.to(this.disputeRoom(disputeId)).emit(event, payload);
  }

  emitHearingEvent(hearingId: string, event: string, payload: Record<string, any>): void {
    if (!this.server) {
      return;
    }
    this.server.to(this.hearingRoom(hearingId)).emit(event, payload);
  }

  emitStaffDashboardEvent(event: string, payload: Record<string, any>): void {
    if (!this.server) {
      return;
    }
    this.server.to(this.staffDashboardRoom()).emit(event, payload);
  }

  private async authenticate(client: Socket): Promise<WsUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Missing token');
    }

    const payload = this.jwtService.verify(token) as {
      sub?: string;
      email?: string;
      role?: UserRole;
    };
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

    if (authToken) {
      return authToken;
    }
    if (queryToken) {
      return queryToken;
    }
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7);
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
      select: ['id', 'raisedById', 'defendantId', 'assignedStaffId', 'escalatedToAdminId'],
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

    if (!isParty && !isAssignedStaff && !isEscalatedAdmin) {
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

    return { trackPresence: Boolean(participant) };
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
