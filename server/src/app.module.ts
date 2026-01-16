import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ProjectsModule } from './modules/projects/projects.module';
// import { MilestonesModule } from './modules/milestones/milestones.module'; // Removed - using mock data
import jwtConfig from './config/jwt.config';
import { WizardModule } from './modules/wizard/wizard.module';
import { ProjectRequestsModule } from './modules/project-requests/project-requests.module';
import { ReviewModule } from './modules/review/review.module';
import { TrustScoreModule } from './modules/trust-score/trust-score.module';
import { ReportModule } from './modules/report/report.module';
import { ProjectSpecsModule } from './modules/project-specs/project-specs.module';
import { SeedingModule } from './modules/seeding/seeding.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { UserWarningModule } from './modules/user-warning/user-warning.module';

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
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        logging: true,

        // Sửa: Supabase BẮT BUỘC phải có SSL
        ssl: false,
      }),
    }),

    // 3. Rate Limiting - Chống spam
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    AuditLogsModule,
    AuthModule,
    TasksModule,
    ProjectsModule,
    // MilestonesModule, // Removed - using mock data in frontend
    WizardModule,
    ProjectRequestsModule,
    ReviewModule,
    TrustScoreModule,
    ReportModule,
    ProjectSpecsModule,
    SeedingModule,
    DisputesModule,
    UserWarningModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
