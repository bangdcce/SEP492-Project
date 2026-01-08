import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import jwtConfig from './config/jwt.config';
import { WizardModule } from './modules/wizard/wizard.module';
import { ProjectRequestsModule } from './modules/project-requests/project-requests.module';

@Module({
  imports: [
    // 1. Cấu hình ConfigModule đọc file .env tại thư mục gốc
    ConfigModule.forRoot({
      envFilePath: '.env', // Sửa từ '../.env' thành '.env'
      isGlobal: true,
      load: [jwtConfig],
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

    AuditLogsModule,
    AuthModule,
    WizardModule,
    ProjectRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
