import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

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
  if (!raw) {
    return defaults;
  }

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

@WebSocketGateway({
  namespace: '/ws/staff-applications',
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  },
  pingInterval: 25000,
  pingTimeout: 30000,
})
export class StaffApplicationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(StaffApplicationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      await client.join(this.userRoom(user.id));
      this.logger.debug(`Staff application socket connected: ${user.id}`);
    } catch (error) {
      this.logger.warn(
        `Staff application WS auth failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as WsUser | undefined;
    if (user) {
      this.logger.debug(`Staff application socket disconnected: ${user.id}`);
    }
  }

  emitApplicationUpdated(
    userId: string,
    payload: {
      applicationId: string;
      status: string;
      reviewedAt: Date | null;
      rejectionReason: string | null;
    },
  ): void {
    if (!this.server || !userId) {
      return;
    }

    this.server.to(this.userRoom(userId)).emit('staffApplicationUpdated', payload);
  }

  private async authenticate(client: Socket): Promise<WsUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Missing token');
    }

    const payload = this.jwtService.verify(token) as { sub?: string };
    if (!payload?.sub) {
      throw new WsException('Invalid token payload');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || user.isBanned) {
      throw new WsException('User not found');
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
      if ((name === 'accessToken' || name === 'access_token') && value) {
        return decodeURIComponent(value);
      }
    }

    return undefined;
  }

  private userRoom(userId: string): string {
    return `staff_application_user_${userId}`;
  }
}
