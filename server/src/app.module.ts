import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ProjectsModule } from './modules/projects/projects.module';
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
import { KycModule } from './modules/kyc/kyc.module';
import { UsersModule } from './modules/users/users.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LeaveModule } from './modules/leave/leave.module';
import { HealthModule } from './modules/health/health.module';
import { MatchingModule } from './modules/matching/matching.module';
import { WorkspaceChatModule } from './modules/workspace-chat/workspace-chat.module';

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [jwtConfig],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('TypeOrmConfig');
        const poolMax = parseNumberEnv(configService.get<string>('DB_POOL_MAX'), 20);
        const poolIdleMs = parseNumberEnv(configService.get<string>('DB_POOL_IDLE_MS'), 30000);
        const poolConnTimeoutMs = parseNumberEnv(
          configService.get<string>('DB_POOL_CONN_TIMEOUT_MS'),
          10000,
        );
        const dbLogging = configService.get<string>('DB_LOGGING') === 'true';

        logger.log(
          `DB pool config: max=${poolMax}, idleTimeoutMillis=${poolIdleMs}, connectionTimeoutMillis=${poolConnTimeoutMs}`,
        );
        logger.log(`DB logging: ${dbLogging ? 'enabled' : 'disabled'}`);

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: parseNumberEnv(configService.get<string>('DB_PORT'), 5432),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: dbLogging,
          ssl: false,
          extra: {
            max: poolMax,
            idleTimeoutMillis: poolIdleMs,
            connectionTimeoutMillis: poolConnTimeoutMs,
            keepAlive: true,
          },
        };
      },
    }),

    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    ScheduleModule.forRoot(),

    AuditLogsModule,
    AuthModule,
    TasksModule,
    ProjectsModule,
    WizardModule,
    ProjectRequestsModule,
    ReviewModule,
    TrustScoreModule,
    ReportModule,
    ProjectSpecsModule,
    SeedingModule,
    DisputesModule,
    CalendarModule,
    LeaveModule,
    NotificationsModule,
    UserWarningModule,
    KycModule,
    UsersModule,
    ContractsModule,
    HealthModule,
    MatchingModule,
    WorkspaceChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
