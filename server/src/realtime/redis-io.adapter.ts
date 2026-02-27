import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: any = null;
  private pubClient: any | null = null;
  private subClient: any | null = null;
  private degraded = false;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  private markDegraded(reason: string): void {
    if (!this.degraded) {
      this.logger.warn(`Socket.IO Redis adapter degraded: ${reason}`);
    }
    this.degraded = true;
  }

  private markHealthy(reason: string): void {
    if (this.degraded) {
      this.logger.log(`Socket.IO Redis adapter recovered: ${reason}`);
    }
    this.degraded = false;
  }

  private bindClientEvents(client: any, name: 'pub' | 'sub'): void {
    if (!client?.on) {
      return;
    }

    client.on('ready', () => {
      this.markHealthy(`${name} client ready`);
    });
    client.on('error', (error: unknown) => {
      this.markDegraded(
        `${name} client error: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
    client.on('close', () => {
      this.markDegraded(`${name} client connection closed`);
    });
    client.on('end', () => {
      this.markDegraded(`${name} client connection ended`);
    });
    client.on('reconnecting', (delay: number) => {
      this.logger.warn(`Socket.IO Redis adapter ${name} reconnecting in ${delay}ms`);
      this.degraded = true;
    });
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAdapter } = require('@socket.io/redis-adapter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis');

    this.pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.subClient = this.pubClient.duplicate();
    this.bindClientEvents(this.pubClient, 'pub');
    this.bindClientEvents(this.subClient, 'sub');

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Socket.IO Redis adapter connected');
    this.markHealthy('pub/sub connected');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async close(): Promise<void> {
    try {
      if (this.subClient) {
        await this.subClient.quit();
      }
      if (this.pubClient) {
        await this.pubClient.quit();
      }
      this.degraded = false;
    } catch (error) {
      this.logger.warn(
        `Failed to close redis adapter clients: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
