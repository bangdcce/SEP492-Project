import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { SubmitKycDto, RejectKycDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { MulterFile } from '../../common/types/multer.type';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('KYC Verification')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * User: Submit KYC verification
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit KYC verification' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'idCardFront', maxCount: 1 },
      { name: 'idCardBack', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  async submitKyc(
    @GetUser('id') userId: string,
    @Body() dto: SubmitKycDto,
    @UploadedFiles()
    files: {
      idCardFront?: MulterFile[];
      idCardBack?: MulterFile[];
      selfie?: MulterFile[];
    },
  ) {
    // Extract single files from arrays
    const fileObjects = {
      idCardFront: files.idCardFront?.[0],
      idCardBack: files.idCardBack?.[0],
      selfie: files.selfie?.[0],
    };

    return await this.kycService.submitKyc(userId, dto, fileObjects as any);
  }

  /**
   * User: Get my KYC status
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my KYC verification status' })
  async getMyKyc(@GetUser('id') userId: string) {
    return await this.kycService.getMyKyc(userId);
  }

  /**
   * Admin: Get all KYC submissions
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get all KYC submissions' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'],
    description: 'Filter by KYC status',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllKyc(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return await this.kycService.getAllKyc(status as any, page, limit);
  }

  /**
   * Admin: Get KYC by ID
   */
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get KYC verification details' })
  async getKycById(@Param('id', ParseUUIDPipe) id: string) {
    return await this.kycService.getKycById(id);
  }

  /**
   * Admin: Get KYC by ID with watermark (for viewing encrypted images)
   */
  @Get('admin/:id/watermark')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get KYC verification details with watermark' })
  async getKycByIdWithWatermark(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: any,
    @Req() req: any,
    @Query('reason') reason?: string,
    @Query('reasonDetails') reasonDetails?: string,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown IP';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const sessionId = req.headers['x-request-id']?.toString() || `${user.id}-${Date.now()}`;

    return await this.kycService.getKycByIdWithWatermark(
      id,
      user.id,
      user.email,
      user.role,
      ipAddress,
      sessionId,
      userAgent,
      reason,
      reasonDetails,
    );
  }

  /**
   * Admin: Approve KYC
   */
  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Approve KYC verification' })
  async approveKyc(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') adminId: string) {
    return await this.kycService.approveKyc(id, adminId);
  }

  /**
   * Admin: Reject KYC
   */
  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reject KYC verification' })
  async rejectKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectKycDto,
    @GetUser('id') adminId: string,
  ) {
    return await this.kycService.rejectKyc(id, adminId, dto);
  }
}
