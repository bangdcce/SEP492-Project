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
import { Type } from 'class-transformer';
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
import { UserEntity, UserRole } from 'src/database/entities';
import { WorkspaceChatService } from './workspace-chat.service';
import { WorkspaceChatRealtimeBridge } from './workspace-chat.realtime';

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

class JoinProjectChatDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;
}

class SendProjectMessageDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkspaceMessageAttachmentDto)
  @IsOptional()
  attachments?: WorkspaceMessageAttachmentDto[];

  @IsUUID()
  @IsOptional()
  taskId?: string;
}

class WorkspaceMessageAttachmentDto {
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

@WebSocketGateway({
  namespace: '/ws/workspace',
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  },
  pingInterval: 25000,
  pingTimeout: 30000,
})
export class WorkspaceChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WorkspaceChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly workspaceChatService: WorkspaceChatService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  afterInit(server: Server): void {
    WorkspaceChatRealtimeBridge.bindServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.resolveUser(client);
      this.logger.log(`Workspace chat connected: userId=${user.id}, socketId=${client.id}`);
    } catch (error) {
      this.logger.warn(
        `Workspace chat WS auth failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as WsUser | undefined;
    if (user) {
      this.logger.debug(`Workspace chat disconnected: ${user.id}`);
    }
  }

  @UsePipes(wsValidationPipe())
  @SubscribeMessage('joinProjectChat')
  async joinProjectChat(
    @MessageBody() data: JoinProjectChatDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: boolean; room: string }> {
    try {
      const user = await this.resolveUser(client);
      this.logger.log(
        `joinProjectChat received: projectId=${data.projectId}, userId=${user.id}, socketId=${client.id}`,
      );

      await this.workspaceChatService.assertProjectReadAccess(data.projectId, user.id);

      const room = this.projectRoom(data.projectId);
      await client.join(room);

      return { joined: true, room };
    } catch (error) {
      this.logBackendCrashDetail(error);
      const message = this.toErrorMessage(error);
      client.emit('workspaceChatError', { message });
      throw this.toWsException(error);
    }
  }

  @UsePipes(wsValidationPipe())
  @SubscribeMessage('sendProjectMessage')
  async sendProjectMessage(
    @MessageBody() dto: SendProjectMessageDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; messageId: string; projectId: string; createdAt: string }> {
    try {
      const user = await this.resolveUser(client);
      this.logger.log(
        `sendProjectMessage received: projectId=${dto.projectId}, userId=${user.id}, socketId=${client.id}`,
      );
      console.log('[WorkspaceChatGateway] sendProjectMessage payload', {
        projectId: dto.projectId,
        senderId: user.id,
        taskId: dto.taskId ?? null,
        attachmentCount: dto.attachments?.length ?? 0,
      });

      const savedMessage = await this.workspaceChatService.saveMessage(
        dto.projectId,
        user.id,
        dto.content ?? '',
        dto.attachments,
        dto.taskId,
      );

      return {
        success: true,
        messageId: savedMessage.id,
        projectId: savedMessage.projectId,
        createdAt: savedMessage.createdAt.toISOString(),
      };
    } catch (error) {
      this.logBackendCrashDetail(error);
      const message = this.toErrorMessage(error);
      client.emit('workspaceChatError', { message });
      throw this.toWsException(error);
    }
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

  private projectRoom(projectId: string): string {
    return `project_${projectId}`;
  }

  private toWsException(error: unknown): WsException {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return new WsException(response);
      }

      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        if (Array.isArray(message)) {
          return new WsException(message.join(', '));
        }
        if (typeof message === 'string') {
          return new WsException(message);
        }
      }

      return new WsException(error.message);
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('Unexpected workspace chat error');
  }

  private toErrorMessage(error: unknown): string {
    const wsError = this.toWsException(error).getError();
    if (typeof wsError === 'string') {
      return wsError;
    }
    if (wsError && typeof wsError === 'object') {
      const message = (wsError as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Unexpected workspace chat error';
  }

  private logBackendCrashDetail(error: unknown): void {
    const maybeError = error as { message?: unknown; stack?: unknown };
    console.error('🔥 BACKEND CRASH DETAIL:', maybeError?.message ?? error, maybeError?.stack);
  }
}
