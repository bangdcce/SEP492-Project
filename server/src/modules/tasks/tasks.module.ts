import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { TaskEntity } from '../../database/entities/task.entity';
import { MilestoneEntity } from '../../database/entities/milestone.entity';
import { ProjectEntity } from '../../database/entities/project.entity';
import { CalendarEventEntity } from '../../database/entities/calendar-event.entity';
import { TaskHistoryEntity } from '../../database/entities/task-history.entity';
import { TaskCommentEntity } from '../../database/entities/task-comment.entity';
import { EscrowEntity } from '../../database/entities/escrow.entity';
import { TaskAttachmentEntity } from './entities/task-attachment.entity';
import { TaskLinkEntity } from './entities/task-link.entity';
import { TaskSubmissionEntity } from './entities/task-submission.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';
import { WorkspaceChatModule } from '../workspace-chat/workspace-chat.module';
import { AuthModule } from '../auth';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ProjectsModule } from '../projects/projects.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      TaskEntity,
      MilestoneEntity,
      EscrowEntity,
      ProjectEntity,
      CalendarEventEntity,
      TaskHistoryEntity,
      TaskCommentEntity,
      TaskAttachmentEntity,
      TaskLinkEntity,
      TaskSubmissionEntity,
    ]),
    AuthModule,
    AuditLogsModule,
    WorkspaceChatModule,
    ProjectsModule,
    NotificationsModule,
  ],
  providers: [TasksService, TasksGateway],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
