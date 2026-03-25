import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectSpecsService } from './project-specs.service';
import { ProjectSpecsController } from './project-specs.controller';
import { ProjectSpecEntity } from '../../database/entities/project-spec.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectSpecSignatureEntity } from '../../database/entities/project-spec-signature.entity';
import { ProjectRequestProposalEntity } from '../../database/entities/project-request-proposal.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectSpecEntity,
      MilestoneEntity,
      ProjectRequestEntity,
      ProjectSpecSignatureEntity,
      ProjectRequestProposalEntity,
    ]),
    AuditLogsModule, // For logging actions
    NotificationsModule,
  ],
  controllers: [ProjectSpecsController],
  providers: [ProjectSpecsService],
  exports: [ProjectSpecsService],
})
export class ProjectSpecsModule {}
