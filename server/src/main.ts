import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

import * as fs from 'fs';

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

  // Enable CORS for frontend and tools (Figma, Make/Integromat)
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3001',
      'https://www.figma.com',
      'https://www.make.com',
      'https://eu1.make.com',
      'https://us1.make.com',
      'https://integromat.com',
      'https://chantell-chemotropic-noncontroversially.ngrok-free.dev',
      // 'null' origin is sometimes used by local plugins or sandboxed environments
      'null',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
