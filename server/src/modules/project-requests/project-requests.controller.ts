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
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ProjectRequestsService } from './project-requests.service';
import { RequestStatus } from '../../database/entities/project-request.entity';

import { Roles, JwtAuthGuard, RolesGuard } from '../auth';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Project Requests')
@Controller('project-requests')
export class ProjectRequestsController {
  constructor(private readonly projectRequestsService: ProjectRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all project requests with optional status filter' })
  @ApiQuery({ name: 'status', enum: RequestStatus, required: false })
  async getProjectRequests(@Query('status') status?: string) {
    return this.projectRequestsService.findAll(status as RequestStatus);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project request by ID' })
  @ApiResponse({ status: 200, description: 'Return the project request details' })
  @ApiResponse({ status: 404, description: 'Project request not found' })
  async getOne(@Param('id') id: string) {
    return this.projectRequestsService.findOne(id);
  }

  @Patch(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BROKER)
  async assignBroker(
    @Param('id') id: string,
    @GetUser('id') brokerId: string,
    @Req() req: any,
  ) {
    return this.projectRequestsService.assignBroker(id, brokerId, req);
  }
}
