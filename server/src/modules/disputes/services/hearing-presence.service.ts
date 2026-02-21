import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

type PresenceCounterResult = {
  count: number;
  transitioned: boolean;
};

@Injectable()
export class HearingPresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(HearingPresenceService.name);
  private readonly inMemoryCounters = new Map<string, number>();
  private readonly counterTtlSeconds = 6 * 60 * 60;
  private redisClient: any | null = null;
  private redisReady = false;

  constructor() {
    this.initializeRedisClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        this.logger.warn(
          `Failed to close hearing presence redis client: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
  }

  async incrementPresence(hearingId: string, userId: string): Promise<PresenceCounterResult> {
    const key = this.buildKey(hearingId, userId);
    if (this.redisReady && this.redisClient) {
      try {
        const countRaw = await this.redisClient.incr(key);
        await this.redisClient.expire(key, this.counterTtlSeconds);
        const count = Math.max(0, Number(countRaw) || 0);
        return {
          count,
          transitioned: count === 1,
        };
      } catch (error) {
        this.logger.warn(
          `Redis increment failed for ${key}, fallback to in-memory: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    const next = (this.inMemoryCounters.get(key) || 0) + 1;
    this.inMemoryCounters.set(key, next);
    return {
      count: next,
      transitioned: next === 1,
    };
  }

  async decrementPresence(hearingId: string, userId: string): Promise<PresenceCounterResult> {
    const key = this.buildKey(hearingId, userId);
    if (this.redisReady && this.redisClient) {
      try {
        const countRaw = await this.redisClient.decr(key);
        let count = Number(countRaw) || 0;
        if (count <= 0) {
          await this.redisClient.del(key);
          count = 0;
        }
        return {
          count,
          transitioned: count === 0,
        };
      } catch (error) {
        this.logger.warn(
          `Redis decrement failed for ${key}, fallback to in-memory: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    const current = this.inMemoryCounters.get(key) || 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.inMemoryCounters.delete(key);
    } else {
      this.inMemoryCounters.set(key, next);
    }
    return {
      count: next,
      transitioned: next === 0,
    };
  }

  private buildKey(hearingId: string, userId: string): string {
    return `presence:hearing:${hearingId}:user:${userId}`;
  }

  private initializeRedisClient(): void {
    const redisEnabled = (process.env.SOCKET_REDIS_ENABLED || 'false').toLowerCase() === 'true';
    const redisUrl = process.env.REDIS_URL;
    if (!redisEnabled || !redisUrl) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      void this.redisClient
        .connect()
        .then(() => {
          this.redisReady = true;
          this.logger.log('Hearing presence redis client connected');
        })
        .catch((error: unknown) => {
          this.redisReady = false;
          this.redisClient = null;
          this.logger.warn(
            `Failed to connect hearing presence redis client: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          );
        });
    } catch (error) {
      this.redisReady = false;
      this.redisClient = null;
      this.logger.warn(
        `ioredis is unavailable; fallback to in-memory hearing presence counters. ${
          error instanceof Error ? error.message : ''
        }`,
      );
    }
  }
}
