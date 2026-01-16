
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectRequestsController } from './project-requests.controller';
import { ProjectRequestsService } from './project-requests.service';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectRequestAnswerEntity } from '../../database/entities/project-request-answer.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { BrokerProposalEntity } from '../../database/entities/broker-proposal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectRequestEntity, ProjectRequestAnswerEntity, BrokerProposalEntity]),
    AuditLogsModule,
  ],
  controllers: [ProjectRequestsController],
  providers: [ProjectRequestsService],
  exports: [ProjectRequestsService],
})
export class ProjectRequestsModule {}
