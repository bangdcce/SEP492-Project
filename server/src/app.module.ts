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
import { MatchingModule } from './modules/matching/matching.module';
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
import { WorkspaceChatModule } from './modules/workspace-chat/workspace-chat.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { resolveDatabaseRuntimeConfig } from './config/database-runtime.config';

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
        const runtime = resolveDatabaseRuntimeConfig({
          NODE_ENV: configService.get<string>('NODE_ENV'),
          DB_HOST: configService.get<string>('DB_HOST'),
          DB_PORT: configService.get<string>('DB_PORT'),
          DB_POOL_MAX: configService.get<string>('DB_POOL_MAX'),
          DB_POOL_IDLE_MS: configService.get<string>('DB_POOL_IDLE_MS'),
          DB_POOL_CONN_TIMEOUT_MS: configService.get<string>('DB_POOL_CONN_TIMEOUT_MS'),
          DB_POOL_MAX_USES: configService.get<string>('DB_POOL_MAX_USES'),
          DB_POOL_ALLOW_EXIT_ON_IDLE: configService.get<string>('DB_POOL_ALLOW_EXIT_ON_IDLE'),
          DB_QUERY_TIMEOUT_MS: configService.get<string>('DB_QUERY_TIMEOUT_MS'),
          DB_STATEMENT_TIMEOUT_MS: configService.get<string>('DB_STATEMENT_TIMEOUT_MS'),
        });
        const dbLogging = configService.get<string>('DB_LOGGING') === 'true';

        logger.log(
          `DB pool config: max=${runtime.poolMax}, idleTimeoutMillis=${runtime.poolIdleMs}, connectionTimeoutMillis=${runtime.poolConnTimeoutMs}, maxUses=${runtime.poolMaxUses}, allowExitOnIdle=${runtime.poolAllowExitOnIdle}`,
        );
        logger.log(`DB logging: ${dbLogging ? 'enabled' : 'disabled'}`);
        if (runtime.isSupabaseSessionMode) {
          logger.warn(
            'Supabase pooler session mode detected on port 5432. Use port 6543 in shared development to avoid max client exhaustion.',
          );
        }

        return {
          type: 'postgres',
          host: runtime.host,
          port: runtime.port,
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: dbLogging,
          ssl: false,
          extra: {
            max: runtime.poolMax,
            idleTimeoutMillis: runtime.poolIdleMs,
            connectionTimeoutMillis: runtime.poolConnTimeoutMs,
            maxUses: runtime.poolMaxUses,
            allowExitOnIdle: runtime.poolAllowExitOnIdle,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
            query_timeout: runtime.queryTimeoutMs,
            statement_timeout: runtime.statementTimeoutMs,
          },
          // Retry on transient connection failures (e.g. pool exhaustion)
          retryAttempts: 3,
          retryDelay: 1000,
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
    MatchingModule,
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
    PaymentsModule,
    HealthModule,
    WorkspaceChatModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
