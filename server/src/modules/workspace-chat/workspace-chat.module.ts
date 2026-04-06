import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProjectEntity,
  TaskEntity,
  UserEntity,
  WorkspaceMessageEntity,
} from 'src/database/entities';
import { AuthModule } from '../auth';
import { WorkspaceChatController } from './workspace-chat.controller';
import { WorkspaceChatGateway } from './workspace-chat.gateway';
import { WorkspaceChatService } from './workspace-chat.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceMessageEntity, ProjectEntity, TaskEntity, UserEntity]),
    AuthModule,
    AuditLogsModule,
  ],
  controllers: [WorkspaceChatController],
  providers: [WorkspaceChatService, WorkspaceChatGateway],
  exports: [WorkspaceChatService],
})
export class WorkspaceChatModule {}
