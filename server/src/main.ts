import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { HealthService } from './modules/health/health.service';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProductionLikeNodeEnv = (): boolean => {
  const env = process.env.NODE_ENV?.trim().toLowerCase();
  return env === 'production' || env === 'staging';
};

const isStartupReadinessFailFastEnabled = (): boolean => {
  return parseBoolean(process.env.STARTUP_READINESS_FAIL_FAST, isProductionLikeNodeEnv());
};

const isLocalHostLike = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('localhost') ||
    normalized.includes('127.0.0.1') ||
    normalized.includes('0.0.0.0')
  );
};

const parseCorsOrigins = (): string[] => {
  const defaults = [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:5174',
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

  const localHints = [process.env.FRONTEND_URL, process.env.APP_URL, ...parsed]
    .filter((value): value is string => Boolean(value))
    .some((value) => isLocalHostLike(value));

  if (!localHints) {
    return parsed;
  }

  return Array.from(new Set([...parsed, ...defaults]));
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const httpsOptions =
    fs.existsSync(join(__dirname, '..', 'secrets', 'private-key.pem')) &&
    fs.existsSync(join(__dirname, '..', 'secrets', 'public-certificate.pem'))
      ? {
          key: fs.readFileSync(join(__dirname, '..', 'secrets', 'private-key.pem')),
          cert: fs.readFileSync(join(__dirname, '..', 'secrets', 'public-certificate.pem')),
        }
      : undefined;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  app.enableShutdownHooks();

  let redisAdapter: RedisIoAdapter | null = null;
  let redisAdapterClosed = false;

  const closeRedisAdapter = async (): Promise<void> => {
    if (redisAdapterClosed || !redisAdapter) {
      return;
    }

    redisAdapterClosed = true;
    try {
      await redisAdapter.close();
      logger.log('Socket.IO Redis adapter clients closed');
    } catch (error) {
      logger.warn(
        `Failed closing Socket.IO Redis adapter clients: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  };

  const socketRedisEnabled = parseBoolean(process.env.SOCKET_REDIS_ENABLED, false);
  const redisUrl = process.env.REDIS_URL?.trim();

  if (socketRedisEnabled && redisUrl) {
    try {
      redisAdapter = new RedisIoAdapter(app);
      await redisAdapter.connectToRedis(redisUrl);
      app.useWebSocketAdapter(redisAdapter);
      logger.log('Socket.IO Redis adapter enabled (multi-instance mode)');
    } catch (error) {
      logger.warn(
        `Socket.IO Redis adapter connection failed, fallback to single-instance mode: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );

      if (redisAdapter) {
        await closeRedisAdapter();
        redisAdapter = null;
      }
    }
  } else if (socketRedisEnabled && !redisUrl) {
    logger.warn(
      'SOCKET_REDIS_ENABLED=true but REDIS_URL is missing. Fallback to single-instance mode.',
    );
  } else {
    logger.log('Socket.IO Redis adapter disabled. Using single-instance mode.');
  }

  process.once('SIGINT', () => {
    void closeRedisAdapter();
  });
  process.once('SIGTERM', () => {
    void closeRedisAdapter();
  });
  process.once('SIGQUIT', () => {
    void closeRedisAdapter();
  });
  process.once('beforeExit', () => {
    void closeRedisAdapter();
  });

  const dbPoolMax = parseNumber(process.env.DB_POOL_MAX, 20);
  const dbPoolIdleMs = parseNumber(process.env.DB_POOL_IDLE_MS, 30000);
  const dbPoolConnTimeoutMs = parseNumber(process.env.DB_POOL_CONN_TIMEOUT_MS, 10000);
  logger.log(
    `DB pool env: max=${dbPoolMax}, idleTimeoutMillis=${dbPoolIdleMs}, connectionTimeoutMillis=${dbPoolConnTimeoutMs}`,
  );

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());

  const corsOrigins = parseCorsOrigins();
  if (parseBoolean(process.env.CORS_ALLOW_NULL_ORIGIN, false)) {
    corsOrigins.push('null');
  }

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Timezone'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('InterDev API')
    .setDescription('API documentation for InterDev - Freelancing Platform')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('audit-logs', 'Audit logs endpoints')
    .addBearerAuth(
      {
        description: 'Please enter your Bearer token',
        name: 'Authorization',
        bearerFormat: 'Bearer',
        scheme: 'Bearer',
        type: 'http',
        in: 'Header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  if (isStartupReadinessFailFastEnabled()) {
    try {
      await app.get(HealthService).getReadinessStatus();
      logger.log('Startup readiness fail-fast gate passed.');
    } catch (error) {
      logger.error(
        `Startup readiness fail-fast gate blocked startup: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      await closeRedisAdapter();
      await app.close();
      process.exit(1);
      return;
    }
  } else {
    logger.warn('Startup readiness fail-fast gate is disabled by configuration.');
  }

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  const protocol = httpsOptions ? 'https' : 'http';
  logger.log(`Application is running on: ${protocol}://localhost:${port}`);
  logger.log(`Swagger documentation: ${protocol}://localhost:${port}/api-docs`);
}

void bootstrap();
