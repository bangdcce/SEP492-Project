import { HttpException, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
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
import { IsNotEmpty, IsString } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ProjectEntity, ProjectStaffInviteStatus } from '../../database/entities/project.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { TasksRealtimeBridge } from './tasks.realtime';

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

class JoinProjectTasksDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;
}

@WebSocketGateway({
  namespace: '/ws/tasks',
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  },
  pingInterval: 25000,
  pingTimeout: 30000,
})
export class TasksGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TasksGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
  ) {}

  afterInit(server: Server): void {
    TasksRealtimeBridge.bindServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.resolveUser(client);
      this.logger.debug(`Task realtime connected: userId=${user.id}, socketId=${client.id}`);
    } catch (error) {
      this.logger.warn(
        `Task realtime auth failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as WsUser | undefined;
    if (user) {
      this.logger.debug(`Task realtime disconnected: ${user.id}`);
    }
  }

  @UsePipes(wsValidationPipe())
  @SubscribeMessage('joinProjectTasks')
  async joinProjectTasks(
    @MessageBody() data: JoinProjectTasksDto,
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: boolean; room: string }> {
    try {
      const user = await this.resolveUser(client);
      this.logger.log(
        `joinProjectTasks received: projectId=${data.projectId}, userId=${user.id}, socketId=${client.id}`,
      );
      await this.assertProjectAccess(data.projectId, user.id);

      const room = this.projectRoom(data.projectId);
      await client.join(room);

      return { joined: true, room };
    } catch (error) {
      const message = this.toErrorMessage(error);
      client.emit('taskBoardError', { message });
      throw this.toWsException(error);
    }
  }

  private async assertProjectAccess(projectId: string, userId: string): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      select: ['id', 'clientId', 'brokerId', 'freelancerId', 'staffId', 'staffInviteStatus'],
    });

    if (!project) {
      throw new WsException('Project not found');
    }

    const isParticipant =
      project.clientId === userId ||
      project.brokerId === userId ||
      project.freelancerId === userId ||
      (project.staffId === userId &&
        project.staffInviteStatus === ProjectStaffInviteStatus.ACCEPTED);

    if (!isParticipant) {
      throw new WsException('You do not have access to this project board');
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
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    for (const cookie of cookies) {
      const [name, ...rest] = cookie.split('=');
      if (!name || rest.length === 0) continue;
      if (name === 'accessToken' || name === 'access_token') {
        return decodeURIComponent(rest.join('='));
      }
    }

    return undefined;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof WsException) {
      const wsError = error.getError();
      if (typeof wsError === 'string') {
        return wsError;
      }
      if (
        typeof wsError === 'object' &&
        wsError !== null &&
        typeof (wsError as { message?: unknown }).message === 'string'
      ) {
        return (wsError as { message: string }).message;
      }
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        typeof (response as { message?: unknown }).message === 'string'
      ) {
        return (response as { message: string }).message;
      }
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Task realtime error';
  }

  private toWsException(error: unknown): WsException {
    if (error instanceof WsException) {
      return error;
    }
    return new WsException(this.toErrorMessage(error));
  }

  private projectRoom(projectId: string): string {
    return `project_${projectId}`;
  }
}
