import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: any = null;
  private pubClient: any | null = null;
  private subClient: any | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
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

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Socket.IO Redis adapter connected');
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
    } catch (error) {
      this.logger.warn(
        `Failed to close redis adapter clients: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
