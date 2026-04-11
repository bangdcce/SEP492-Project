import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import * as entityExports from '../../src/database/entities';
import { NotificationEntity } from '../../src/database/entities/notification.entity';
import { ProjectEntity } from '../../src/database/entities/project.entity';
import { ProfileEntity } from '../../src/database/entities/profile.entity';
import { ReviewEntity } from '../../src/database/entities/review.entity';
import { TrustScoreHistoryEntity } from '../../src/database/entities/trust-score-history.entity';
import { UserEntity } from '../../src/database/entities/user.entity';
import { BrokerProposalEntity } from '../../src/database/entities/broker-proposal.entity';
import { TaskAttachmentEntity } from '../../src/modules/tasks/entities/task-attachment.entity';
import { TaskLinkEntity } from '../../src/modules/tasks/entities/task-link.entity';
import { TaskSubmissionEntity } from '../../src/modules/tasks/entities/task-submission.entity';
import jwtConfig from '../../src/config/jwt.config';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';
import { NotificationsController } from '../../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { TrustScoreController } from '../../src/modules/trust-score/trust-score.controller';
import { TrustScoreService } from '../../src/modules/trust-score/trust-score.service';
import { TrustProfilesController } from '../../src/modules/users/trust-profiles.controller';
import { TrustProfilesService } from '../../src/modules/users/trust-profiles.service';
import {
  ensureJwtEnv,
} from './auth-token';
import type { PostgresTestContainerHandle } from './postgres-test-container';

const entityClasses = Object.values(entityExports).filter(
  (value): value is new () => unknown => typeof value === 'function',
);

const featureTestExtraEntities = [
  BrokerProposalEntity,
  TaskAttachmentEntity,
  TaskLinkEntity,
  TaskSubmissionEntity,
];

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forFeature([
      NotificationEntity,
      ProfileEntity,
      ProjectEntity,
      ReviewEntity,
      TrustScoreHistoryEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    NotificationsController,
    TrustProfilesController,
    TrustScoreController,
  ],
  providers: [
    JwtStrategy,
    NotificationsService,
    TrustProfilesService,
    TrustScoreService,
  ],
})
class FeatureHttpTestModule {}

export interface FeatureHttpTestApp {
  app: INestApplication;
  dataSource: DataSource;
  eventEmitter: EventEmitter2;
  notificationsService: NotificationsService;
}

export const createFeatureHttpTestApp = async (
  database: PostgresTestContainerHandle,
): Promise<FeatureHttpTestApp> => {
  ensureJwtEnv();

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [jwtConfig],
      }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: database.host,
        port: database.port,
        username: database.username,
        password: database.password,
        database: database.database,
        entities: [...entityClasses, ...featureTestExtraEntities],
        synchronize: true,
        dropSchema: true,
        logging: false,
      }),
      FeatureHttpTestModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  await app.init();

  return {
    app,
    dataSource: moduleRef.get(DataSource),
    eventEmitter: moduleRef.get(EventEmitter2),
    notificationsService: moduleRef.get(NotificationsService),
  };
};
