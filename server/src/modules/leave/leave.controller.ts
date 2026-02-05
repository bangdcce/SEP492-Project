import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserEntity, UserRole } from 'src/database/entities';
import {
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  LeaveBalanceQueryDto,
  ListLeaveRequestsQueryDto,
  ProcessLeaveRequestDto,
  UpdateLeavePolicyDto,
} from './dto/leave.dto';
import { LeaveService } from './leave.service';

@ApiTags('Leave')
@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('requests')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create leave request (short-term or long-term)' })
  async createLeaveRequest(@Body() dto: CreateLeaveRequestDto, @GetUser() user: UserEntity) {
    return this.leaveService.createLeaveRequest(dto, user);
  }

  @Get('requests')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'List leave requests' })
  async listLeaveRequests(
    @Query() query: ListLeaveRequestsQueryDto,
    @GetUser() user: UserEntity,
  ) {
    return this.leaveService.listLeaveRequests(query, user);
  }

  @Patch('requests/:id/process')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject leave request (admin)' })
  async processLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessLeaveRequestDto,
    @GetUser() user: UserEntity,
  ) {
    return this.leaveService.processLeaveRequest(id, dto, user);
  }

  @Patch('requests/:id/cancel')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel leave request' })
  async cancelLeaveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelLeaveRequestDto,
    @GetUser() user: UserEntity,
  ) {
    return this.leaveService.cancelLeaveRequest(id, dto, user);
  }

  @Get('balance')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get leave balance for month' })
  async getLeaveBalance(
    @Query() query: LeaveBalanceQueryDto,
    @GetUser() user: UserEntity,
  ) {
    return this.leaveService.getLeaveBalance(query, user, query.staffId);
  }

  @Patch('policy/:staffId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set monthly leave allowance for staff' })
  async updateLeavePolicy(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateLeavePolicyDto,
    @GetUser() user: UserEntity,
  ) {
    return this.leaveService.updateLeavePolicy(staffId, dto, user);
  }
}
