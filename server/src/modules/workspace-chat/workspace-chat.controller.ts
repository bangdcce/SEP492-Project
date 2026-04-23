import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Patch,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  UploadedFile,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { GetUser, JwtAuthGuard } from '../auth';
import { UserEntity } from 'src/database/entities';
import { WorkspaceChatService } from './workspace-chat.service';
import { MulterFile } from 'src/common/types/multer.type';
import { memoryStorage } from 'multer';

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

  @Post('projects/:projectId/export/email')
  @UseInterceptors(
    FileInterceptor('exportFile', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    }),
  )
  async emailChatExport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @GetUser() user: UserEntity,
    @UploadedFile() exportFile?: MulterFile,
  ) {
    const result = await this.workspaceChatService.emailChatExport(projectId, user, exportFile);

    return {
      success: true,
      message: result.message,
      data: {
        recipientEmail: result.recipientEmail,
        fileName: result.fileName,
      },
    };
  }
}

