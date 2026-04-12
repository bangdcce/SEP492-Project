import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { DisputeEntity } from '../../database/entities/dispute.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { TaskHistoryEntity } from '../../database/entities/task-history.entity';
import { ContractEntity } from '../../database/entities/contract.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ReviewEntity } from '../../database/entities/review.entity';
import { EscrowEntity } from '../../database/entities/escrow.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MilestoneLockPolicyService } from './milestone-lock-policy.service';
import { MilestoneInteractionPolicyService } from './milestone-interaction-policy.service';
import { PaymentsModule } from '../payments/payments.module';
import { WorkspaceChatModule } from '../workspace-chat/workspace-chat.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      DisputeEntity,
      MilestoneEntity,
      TaskEntity,
      TaskHistoryEntity,
      ContractEntity,
      UserEntity,
      ReviewEntity,
      EscrowEntity,
      ProjectRequestEntity,
    ]),
    AuditLogsModule, // For audit logging milestone approvals
    PaymentsModule,
    WorkspaceChatModule,
    NotificationsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, MilestoneLockPolicyService, MilestoneInteractionPolicyService],
  exports: [ProjectsService, MilestoneLockPolicyService, MilestoneInteractionPolicyService],
})
export class ProjectsModule {}
