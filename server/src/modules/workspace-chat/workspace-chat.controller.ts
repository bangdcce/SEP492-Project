import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { GetUser, JwtAuthGuard } from '../auth';
import { UserEntity } from 'src/database/entities';
import { WorkspaceChatService } from './workspace-chat.service';

class UpdatePinMessageDto {
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}

class EditWorkspaceMessageDto {
  @IsString()
  content: string;
}

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
    @Query('query') query?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 30;
    const offset = offsetRaw ? Number(offsetRaw) : 0;

    const messages = await this.workspaceChatService.getMessages(
      projectId,
      limit,
      offset,
      query,
      user.id,
    );

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

  @Patch('projects/:projectId/messages/:messageId/pin')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updatePinnedState(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @GetUser() user: UserEntity,
    @Body() body: UpdatePinMessageDto,
  ) {
    const message = await this.workspaceChatService.togglePin(
      projectId,
      messageId,
      user.id,
      body.isPinned,
    );

    return {
      success: true,
      data: message,
    };
  }

  @Patch('projects/:projectId/messages/:messageId')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async editMessage(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @GetUser() user: UserEntity,
    @Body() body: EditWorkspaceMessageDto,
  ) {
    const message = await this.workspaceChatService.editMessage(
      projectId,
      messageId,
      user.id,
      body.content,
    );

    return {
      success: true,
      data: message,
    };
  }

  @Delete('projects/:projectId/messages/:messageId')
  async deleteMessage(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @GetUser() user: UserEntity,
  ) {
    const message = await this.workspaceChatService.softDeleteMessage(
      projectId,
      messageId,
      user.id,
    );

    return {
      success: true,
      data: message,
    };
  }
}

