import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { UserRole, UserEntity } from '../../../database/entities';

import {
  EvidenceService,
  UploadEvidenceResult,
  EvidenceWithSignedUrl,
} from '../services/evidence.service';

// =============================================================================
// EVIDENCE CONTROLLER
// =============================================================================

@ApiTags('Dispute Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  // ===========================================================================
  // POST /disputes/:disputeId/evidence - Upload Evidence
  // ===========================================================================
  @Post(':disputeId/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload evidence for a dispute',
    description:
      'Upload a file as evidence for a dispute. Only participants (raiser/defendant) and staff/admin can upload. Max 20 files per user per dispute.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'disputeId', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50MB)',
        },
        description: {
          type: 'string',
          description: 'Optional description/caption for the evidence',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Evidence uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        evidence: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            fileName: { type: 'string' },
            fileSize: { type: 'number' },
            mimeType: { type: 'string' },
            uploadedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or validation error',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate file already uploaded',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded (max 20 files per dispute)',
  })
  @HttpCode(HttpStatus.CREATED)
  async uploadEvidence(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,

    @UploadedFile() file: any,
    @Body('description') description: string,
    @GetUser() user: UserEntity,
  ): Promise<UploadEvidenceResult> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.evidenceService.uploadEvidence({
      disputeId,
      uploaderId: user.id,
      uploaderRole: user.role,
      fileBuffer: file.buffer as Buffer,
      fileName: file.originalname as string,
      fileSize: file.size as number,
      mimeType: file.mimetype as string,
      description,
    });

    if (!result.success) {
      if (result.isDuplicate) {
        throw new BadRequestException({
          statusCode: HttpStatus.CONFLICT,
          message: result.error,
          existingEvidenceId: result.existingEvidenceId,
        });
      }
      throw new BadRequestException(result.error);
    }

    return result;
  }

  // ===========================================================================
  // GET /disputes/:disputeId/evidence - List Evidence
  // ===========================================================================
  @Get(':disputeId/evidence')
  @ApiOperation({
    summary: 'Get evidence list for a dispute',
    description:
      'Get all evidence files for a dispute with signed download URLs. Staff/admin can see flagged items, regular users cannot.',
  })
  @ApiParam({ name: 'disputeId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evidence list retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fileName: { type: 'string' },
          fileSize: { type: 'number' },
          mimeType: { type: 'string' },
          description: { type: 'string' },
          uploadedAt: { type: 'string', format: 'date-time' },
          signedUrl: { type: 'string', description: 'Temporary download URL (expires in 1 hour)' },
          uploader: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          isFlagged: { type: 'boolean', description: 'Only visible to staff/admin' },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have access to this dispute',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Dispute not found',
  })
  async getEvidenceList(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @GetUser() user: UserEntity,
  ): Promise<EvidenceWithSignedUrl[]> {
    return this.evidenceService.getEvidenceList(disputeId, user.id, user.role);
  }

  // ===========================================================================
  // GET /disputes/:disputeId/evidence/quota - Get Upload Quota
  // ===========================================================================
  @Get(':disputeId/evidence/quota')
  @ApiOperation({
    summary: 'Get remaining upload quota for a dispute',
    description: 'Check how many more files the current user can upload to this dispute.',
  })
  @ApiParam({ name: 'disputeId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Quota information retrieved',
    schema: {
      type: 'object',
      properties: {
        remaining: { type: 'number', example: 15, description: 'Files remaining' },
        used: { type: 'number', example: 5, description: 'Files already uploaded' },
        total: { type: 'number', example: 20, description: 'Maximum allowed files' },
      },
    },
  })
  async getQuota(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @GetUser() user: UserEntity,
  ): Promise<{ remaining: number; used: number; total: number }> {
    return this.evidenceService.getRemainingQuota(disputeId, user.id);
  }

  // ===========================================================================
  // GET /disputes/:disputeId/evidence/:evidenceId - Get Single Evidence
  // ===========================================================================
  @Get(':disputeId/evidence/:evidenceId')
  @ApiOperation({
    summary: 'Get a single evidence file with download URL',
    description: 'Get details and signed download URL for a specific evidence file.',
  })
  @ApiParam({ name: 'disputeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'evidenceId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evidence retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Evidence not found',
  })
  async getEvidence(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @GetUser() user: UserEntity,
  ): Promise<EvidenceWithSignedUrl> {
    const evidence = await this.evidenceService.getEvidenceById(evidenceId, user.id, user.role);

    if (!evidence) {
      throw new BadRequestException('Evidence not found');
    }

    // Verify evidence belongs to the dispute
    if (evidence.disputeId !== disputeId) {
      throw new BadRequestException('Evidence does not belong to this dispute');
    }

    return evidence;
  }

  // ===========================================================================
  // POST /disputes/:disputeId/evidence/:evidenceId/flag - Flag Evidence
  // ===========================================================================
  @Post(':disputeId/evidence/:evidenceId/flag')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Flag evidence as inappropriate (Staff/Admin only)',
    description:
      'Soft-hide evidence that violates policies. The evidence is not deleted (WORM compliance) but hidden from regular users.',
  })
  @ApiParam({ name: 'disputeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'evidenceId', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        flagReason: {
          type: 'string',
          description: 'Reason for flagging this evidence',
          example: 'Contains inappropriate content / Fake evidence',
        },
      },
      required: ['flagReason'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Evidence flagged successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only staff/admin can flag evidence',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Evidence not found',
  })
  @HttpCode(HttpStatus.OK)
  async flagEvidence(
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() body: { flagReason: string },
    @GetUser() user: UserEntity,
  ) {
    if (!body.flagReason || body.flagReason.trim().length === 0) {
      throw new BadRequestException('Flag reason is required');
    }

    const flagged = await this.evidenceService.flagEvidence(
      evidenceId,
      user.id,
      body.flagReason.trim(),
    );

    // Verify evidence belongs to the dispute
    if (flagged.disputeId !== disputeId) {
      throw new BadRequestException('Evidence does not belong to this dispute');
    }

    return {
      success: true,
      message: 'Evidence flagged successfully',
      evidence: {
        id: flagged.id,
        isFlagged: flagged.isFlagged,
        flagReason: flagged.flagReason,
        flaggedAt: flagged.flaggedAt,
      },
    };
  }
}
