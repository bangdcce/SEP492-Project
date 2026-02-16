import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import * as fs from 'fs';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
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

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Increase payload size limit for file uploads (CV, avatars)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Enable cookie parser
  app.use(cookieParser());

  const corsOrigins = parseCorsOrigins();
  if (parseBoolean(process.env.CORS_ALLOW_NULL_ORIGIN, false)) {
    corsOrigins.push('null');
  }

  // Enable CORS for frontend and trusted tools
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Timezone'],
  });

  // Global validation pipe
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

  // Swagger configuration
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

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);

  const protocol = httpsOptions ? 'https' : 'http';
  console.log(`🚀 Application is running on: ${protocol}://localhost:${port}`);
  console.log(`📚 Swagger documentation: ${protocol}://localhost:${port}/api-docs`);
}
bootstrap();
