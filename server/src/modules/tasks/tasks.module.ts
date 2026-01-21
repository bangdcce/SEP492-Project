import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../../database/entities/task.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { CalendarEventEntity } from '../../database/entities/calendar-event.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, MilestoneEntity, CalendarEventEntity]),
    AuditLogsModule, // For audit logging task submissions
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
