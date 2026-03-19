import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { ProjectRequestsController } from './project-requests.controller';
import { ProjectRequestsService } from './project-requests.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthModule } from '../auth/auth.module';
import { MatchingModule } from '../matching/matching.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractsModule } from '../contracts/contracts.module';

import { BrokerProposalEntity } from '../../database/entities/broker-proposal.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { ContractEntity } from '../../database/entities/contract.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectRequestEntity,
      ProjectRequestAnswerEntity,
      BrokerProposalEntity,
      ProjectRequestProposalEntity,
      ProjectEntity,
      ContractEntity,
    ]),
    AuditLogsModule,
    AuthModule,
    MatchingModule,
    SubscriptionsModule,
    NotificationsModule,
    ContractsModule,
  ],
  controllers: [ProjectRequestsController],
  providers: [ProjectRequestsService],
  exports: [ProjectRequestsService],
})
export class ProjectRequestsModule {}
