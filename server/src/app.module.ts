import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    // 1. Cấu hình ConfigModule đọc file .env tại thư mục gốc
    ConfigModule.forRoot({
      envFilePath: '.env', // Sửa từ '../.env' thành '.env'
      isGlobal: true,
      load: [jwtConfig], // Load JWT config
    }),

    // 2. Cấu hình TypeORM lấy đúng key từ .env
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',

        // Sửa: Lấy host từ env, không hardcode localhost
        host: configService.get<string>('DB_HOST'),

        port: parseInt(configService.get<string>('DB_PORT') || '5432'),

        // Sửa: Key đúng là DB_USERNAME (khớp với .env)
        username: configService.get<string>('DB_USERNAME'),

        // Password
        password: configService.get<string>('DB_PASSWORD'),

        // Sửa: Key đúng là DB_DATABASE (khớp với .env)
        database: configService.get<string>('DB_DATABASE'),

        entities: [__dirname + '/**/*.entity{.ts,.js}'],

        // Development settings
        synchronize: false, // Tắt sync vì bạn đang dùng migration
        logging: true,

        // Sửa: Supabase BẮT BUỘC phải có SSL
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),

    // 3. Rate Limiting - Chống spam
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3,  // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20,  // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    AuditLogsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
