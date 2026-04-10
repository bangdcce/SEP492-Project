import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { HttpException, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  UserEntity,
  UserRole,
  StaffApplicationStatus,
  type WorkspaceMessageAttachment,
} from 'src/database/entities';
import { RequestChatService } from './request-chat.service';
import { RequestChatRealtimeBridge } from './request-chat.realtime';

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
  isVerified: boolean;
  staffApplication: {
    status: StaffApplicationStatus;
  } | null;
  email?: string;
};

const wsValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => {
      const messages = errors.flatMap((error) => {
        const constraints = error.constraints ? Object.values(error.constraints) : [];
        if (constraints.length > 0) {
          return constraints;
        }
        return [`${error.property || 'payload'} is invalid`];
      });

      return new WsException(messages.join(', ') || 'Validation failed');
    },
  });

class JoinRequestChatDto {
  @IsUUID()
  requestId: string;
}

class RequestChatAttachmentDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}

class SendRequestMessageDto {
  @IsUUID()
  requestId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestChatAttachmentDto)
  attachments?: RequestChatAttachmentDto[];

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

@WebSocketGateway({
  namespace: '/ws/request-chat',
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  },
  pingInterval: 25000,
  pingTimeout: 30000,
})
export class RequestChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RequestChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly requestChatService: RequestChatService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  afterInit(server: Server): void {
    RequestChatRealtimeBridge.bindServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.resolveUser(client);
      this.logger.debug(`Request chat connected: userId=${user.id}, socketId=${client.id}`);
    } catch (error) {
      this.logger.warn(
        `Request chat WS auth failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as WsUser | undefined;
    if (user) {
      this.logger.debug(`Request chat disconnected: ${user.id}`);
    }
  }

  @UsePipes(wsValidationPipe())
  @SubscribeMessage('joinRequestChat')
  async joinRequestChat(
    @MessageBody() data: JoinRequestChatDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: boolean; room: string }> {
    try {
      const user = await this.resolveUser(client);
      await this.requestChatService.assertRequestReadAccess(data.requestId, user);
      const room = this.requestRoom(data.requestId);
      await client.join(room);
      return { joined: true, room };
    } catch (error) {
      const message = this.toErrorMessage(error);
      client.emit('requestChatError', { message });
      throw this.toWsException(error);
    }
  }

  @UsePipes(wsValidationPipe())
  @SubscribeMessage('leaveRequestChat')
  async leaveRequestChat(
    @MessageBody() data: JoinRequestChatDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ left: boolean; room: string }> {
    try {
      await this.resolveUser(client);
      const room = this.requestRoom(data.requestId);
      await client.leave(room);
      return { left: true, room };
    } catch (error) {
      const message = this.toErrorMessage(error);
      client.emit('requestChatError', { message });
      throw this.toWsException(error);
    }
  }

  @UsePipes(wsValidationPipe())
  @SubscribeMessage('sendRequestMessage')
  async sendRequestMessage(
    @MessageBody() data: SendRequestMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; messageId: string; requestId: string; createdAt: string }> {
    try {
      const user = await this.resolveUser(client);
      const saved = await this.requestChatService.saveMessage(
        data.requestId,
        user,
        data.content || '',
        data.attachments as WorkspaceMessageAttachment[] | undefined,
        data.replyToId,
      );

      return {
        success: true,
        messageId: saved.id,
        requestId: saved.requestId,
        createdAt: saved.createdAt.toISOString(),
      };
    } catch (error) {
      const message = this.toErrorMessage(error);
      client.emit('requestChatError', { message });
      throw this.toWsException(error);
    }
  }

  private requestRoom(requestId: string): string {
    return `request_${requestId}`;
  }

  private async resolveUser(client: Socket): Promise<WsUser> {
    const existingUser = client.data.user as WsUser | undefined;
    if (existingUser) {
      return existingUser;
    }

    const inFlightAuth = client.data.authPromise as Promise<WsUser> | undefined;
    if (inFlightAuth) {
      return inFlightAuth;
    }

    const authPromise = this.authenticate(client)
      .then((user) => {
        client.data.user = user;
        return user;
      })
      .finally(() => {
        delete client.data.authPromise;
      });

    client.data.authPromise = authPromise;
    return authPromise;
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

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ['staffApplication'],
    });

    if (!user || user.isBanned) {
      throw new WsException('User not found');
    }

    return {
      id: user.id,
      role: user.role,
      isVerified: user.isVerified,
      staffApplication: user.staffApplication
        ? {
            status: user.staffApplication.status,
          }
        : null,
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

  private toErrorMessage(error: unknown): string {
    if (error instanceof WsException) {
      const payload = error.getError();
      return typeof payload === 'string' ? payload : 'WebSocket request failed';
    }
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: unknown }).message;
        return Array.isArray(message) ? String(message[0]) : String(message);
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Request chat operation failed';
  }

  private toWsException(error: unknown): WsException {
    if (error instanceof WsException) {
      return error;
    }
    return new WsException(this.toErrorMessage(error));
  }
}
