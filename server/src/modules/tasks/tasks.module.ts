import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../../database/entities/task.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { CalendarEventEntity } from '../../database/entities/calendar-event.entity';
import { TaskHistoryEntity } from '../../database/entities/task-history.entity';
import { TaskCommentEntity } from '../../database/entities/task-comment.entity';
import { TaskAttachmentEntity } from './entities/task-attachment.entity';
import { TaskLinkEntity } from './entities/task-link.entity';
import { TaskSubmissionEntity } from './entities/task-submission.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      MilestoneEntity,
      ProjectEntity,
      CalendarEventEntity,
      TaskHistoryEntity,
      TaskCommentEntity,
      TaskAttachmentEntity,
      TaskLinkEntity,
      TaskSubmissionEntity,
    ]),
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
