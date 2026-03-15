import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { DisputeEntity } from '../../database/entities/dispute.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { ContractEntity } from '../../database/entities/contract.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MilestoneLockPolicyService } from './milestone-lock-policy.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      DisputeEntity,
      MilestoneEntity,
      TaskEntity,
      ContractEntity,
      UserEntity,
    ]),
    AuditLogsModule, // For audit logging milestone approvals
    PaymentsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, MilestoneLockPolicyService],
  exports: [ProjectsService, MilestoneLockPolicyService],
})
export class ProjectsModule {}
