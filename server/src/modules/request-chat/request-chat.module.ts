import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProjectRequestEntity,
  RequestMessageEntity,
  UserEntity,
} from 'src/database/entities';
import { AuthModule } from '../auth';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestChatController } from './request-chat.controller';
import { RequestChatGateway } from './request-chat.gateway';
import { RequestChatService } from './request-chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestMessageEntity, ProjectRequestEntity, UserEntity]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [RequestChatController],
  providers: [RequestChatService, RequestChatGateway],
  exports: [RequestChatService],
})
export class RequestChatModule {}
