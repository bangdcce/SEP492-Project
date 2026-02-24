import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser, JwtAuthGuard } from '../auth';
import { UserEntity } from 'src/database/entities';
import { WorkspaceChatService } from './workspace-chat.service';

@Controller('workspace-chat')
@UseGuards(JwtAuthGuard)
export class WorkspaceChatController {
  constructor(private readonly workspaceChatService: WorkspaceChatService) {}

  @Get('projects/:projectId/messages')
  async getMessages(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @GetUser() user: UserEntity,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 30;
    const offset = offsetRaw ? Number(offsetRaw) : 0;

    const messages = await this.workspaceChatService.getMessages(projectId, limit, offset, user.id);

    return {
      success: true,
      data: messages,
      pagination: {
        limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 30,
        offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
        count: messages.length,
      },
    };
  }
}

