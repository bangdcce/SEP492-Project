import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StaffApplicationStatus } from '../../database/entities/staff-application.entity';
import { UserRole } from '../../database/entities/user.entity';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListStaffApplicationsDto, RejectStaffApplicationDto } from './dto';
import { StaffApplicationsService } from './staff-applications.service';
import type { Request } from 'express';

@ApiTags('Staff Applications')
@Controller('staff-applications')
export class StaffApplicationsController {
  constructor(private readonly staffApplicationsService: StaffApplicationsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current staff account approval status' })
  async getMyApplication(@GetUser('id') userId: string) {
    return this.staffApplicationsService.getMyApplication(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get staff applications' })
  @ApiQuery({ name: 'status', required: false, enum: StaffApplicationStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getApplications(@Query(new ValidationPipe({ transform: true })) query: ListStaffApplicationsDto) {
    return this.staffApplicationsService.getAllApplications(query);
  }

  @Get(':id/review-assets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get review assets for one staff application' })
  async getApplicationReviewAssets(
    @Param('id') id: string,
    @GetUser() reviewer: { id: string; email: string; role: UserRole },
    @Req() req: Request,
  ) {
    return this.staffApplicationsService.getApplicationReviewAssets(id, {
      reviewerId: reviewer.id,
      reviewerEmail: reviewer.email,
      reviewerRole: reviewer.role === UserRole.STAFF ? 'STAFF' : 'ADMIN',
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      sessionId:
        typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get one staff application' })
  async getApplicationById(@Param('id') id: string) {
    return this.staffApplicationsService.getApplicationById(id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Approve a staff application' })
  async approveApplication(@Param('id') id: string, @GetUser('id') adminId: string) {
    return this.staffApplicationsService.approveApplication(id, adminId);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reject a staff application' })
  async rejectApplication(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) dto: RejectStaffApplicationDto,
    @GetUser('id') adminId: string,
  ) {
    return this.staffApplicationsService.rejectApplication(id, adminId, dto);
  }
}
