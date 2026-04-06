import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GetUser, JwtAuthGuard } from '../auth';
import { UserEntity, type WorkspaceMessageAttachment } from 'src/database/entities';
import { RequestChatService } from './request-chat.service';
import {
  getRequestChatSignedUrl,
  uploadRequestChatFile,
} from '../../common/utils/supabase-object-storage.util';

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const REQUEST_CHAT_ATTACHMENT_WHITELIST = {
  mimeTypes: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv',
  ]),
  extensions: new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.txt',
    '.csv',
  ]),
};

class RequestChatAttachmentDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsString()
  name: string;

  @IsString()
  type: string;
}

class CreateRequestMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestChatAttachmentDto)
  attachments?: RequestChatAttachmentDto[];

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

@ApiTags('Request Chat')
@Controller('request-chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RequestChatController {
  constructor(private readonly requestChatService: RequestChatService) {}

  private assertFilesAllowed(files: MulterFile[] = []) {
    for (const file of files) {
      const original = String(file.originalname || '').toLowerCase();
      const extension = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
      const mime = String(file.mimetype || '').toLowerCase();
      if (
        !REQUEST_CHAT_ATTACHMENT_WHITELIST.mimeTypes.has(mime) &&
        !REQUEST_CHAT_ATTACHMENT_WHITELIST.extensions.has(extension)
      ) {
        throw new BadRequestException(
          `Unsupported attachment type for "${file.originalname}". Allowed formats: PDF, Office, PNG, JPG, WEBP, TXT, CSV.`,
        );
      }
    }
  }

  private async persistAttachment(
    file: MulterFile,
    requestId: string,
  ): Promise<WorkspaceMessageAttachment> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing uploaded request chat file');
    }

    const storagePath = await uploadRequestChatFile(
      file.buffer,
      requestId,
      file.originalname,
      file.mimetype,
    );

    return {
      url: await getRequestChatSignedUrl(storagePath),
      storagePath,
      name: file.originalname,
      type: file.mimetype || 'application/octet-stream',
    };
  }

  @Get('requests/:requestId/messages')
  @ApiOperation({ summary: 'Get request chat messages for a request' })
  async getMessages(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @GetUser() user: UserEntity,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : 50;
    const offset = offsetRaw ? Number(offsetRaw) : 0;
    const data = await this.requestChatService.getMessages(
      requestId,
      limit,
      offset,
      user,
    );

    return {
      success: true,
      data,
      pagination: {
        limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 50,
        offset: Number.isFinite(offset) ? Math.max(0, offset) : 0,
        count: data.length,
      },
    };
  }

  @Post('requests/:requestId/messages')
  @ApiOperation({ summary: 'Create a request chat message' })
  async createMessage(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @GetUser() user: UserEntity,
    @Body() body: CreateRequestMessageDto,
  ) {
    const data = await this.requestChatService.saveMessage(
      requestId,
      user,
      body.content || '',
      body.attachments,
      body.replyToId,
    );

    return {
      success: true,
      data,
    };
  }

  @Post('requests/:requestId/attachments')
  @ApiOperation({ summary: 'Upload request chat attachments' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadAttachments(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @GetUser() user: UserEntity,
    @UploadedFiles() files: MulterFile[],
  ) {
    await this.requestChatService.assertRequestWriteAccess(requestId, user);
    this.assertFilesAllowed(files || []);

    return {
      success: true,
      data: await Promise.all((files || []).map((file) => this.persistAttachment(file, requestId))),
    };
  }
}
