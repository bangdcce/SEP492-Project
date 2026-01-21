import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from '../../database/entities/project.entity';
import { DisputeEntity } from '../../database/entities/dispute.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity, DisputeEntity, MilestoneEntity, TaskEntity]),
    AuditLogsModule, // For audit logging milestone approvals
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
