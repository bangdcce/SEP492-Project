# Redis Configuration

## Installation

```bash
cd server
yarn add @nestjs/cache-manager cache-manager redis
```

## Usage

### 1. Import RedisModule vào AppModule

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        password: configService.get('redis.password'),
        ttl: configService.get('redis.ttl'),
        db: configService.get('redis.db'),
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. Inject vào Services

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CatsService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getCats() {
    // Try to get from cache
    const catsInCache = await this.cacheManager.get('cats');
    if (catsInCache) {
      return catsInCache;
    }

    // Get from database
    const cats = await this.catsRepository.find();

    // Store in cache
    await this.cacheManager.set('cats', cats, 60 * 60 * 1000); // 1 hour

    return cats;
  }

  async invalidateCache() {
    await this.cacheManager.del('cats');
  }
}
```

### 3. Sử dụng Decorators

```typescript
import { Cacheable, CacheEvict } from '@nestjs/cache-manager';

@Cacheable('cats')
async getCats() {
  // This result will be cached automatically
  return await this.catsRepository.find();
}

@CacheEvict('cats')
async updateCat(id: number, data: any) {
  return await this.catsRepository.update(id, data);
}
```

## Common Redis Commands

### Via Docker
```bash
# Connect to Redis
docker-compose exec redis redis-cli -a redis123

# Commands
KEYS *                    # Get all keys
GET key                   # Get value
SET key value             # Set value
DEL key                   # Delete key
INCR key                  # Increment
EXPIRE key 3600           # Set expiration (seconds)
TTL key                   # Get TTL
FLUSHDB                   # Clear current database
FLUSHALL                  # Clear all databases
INFO                      # Server info
MONITOR                   # Monitor commands
```

## Best Practices

1. **Naming Convention**: Use descriptive cache keys
   ```typescript
   `user:${userId}:profile`
   `cats:all`
   `session:${sessionId}`
   ```

2. **Cache Invalidation**: Clear cache khi data berubah
   ```typescript
   await this.cacheManager.del('cats:all');
   ```

3. **Expiration**: Set TTL untuk prevent stale data
   ```typescript
   await this.cacheManager.set('key', value, 3600000); // 1 hour
   ```

4. **Monitoring**: Use Redis Commander untuk monitor
   - Access: http://localhost:8081

5. **Error Handling**: Handle cache failures gracefully
   ```typescript
   try {
     const cached = await this.cacheManager.get('key');
     if (cached) return cached;
   } catch (error) {
     // Fallback to database
   }
   ```
