import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { BanUserDto, UnbanUserDto, ResetUserPasswordDto, UserFilterDto } from './dto/admin-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Users (Admin)')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Admin: Get all users with filters
   */
  @Get()
  @ApiOperation({ summary: '[ADMIN] Get all users with filters' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isBanned', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllUsers(@Query() filters: UserFilterDto) {
    return await this.usersService.getAllUsers(filters);
  }

  /**
   * Admin: Get user detail by ID
   */
  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Get user detail by ID' })
  async getUserDetail(@Param('id') userId: string) {
    return await this.usersService.getUserDetail(userId);
  }

  /**
   * Admin: Ban user
   */
  @Patch(':id/ban')
  @ApiOperation({ summary: '[ADMIN] Ban user' })
  async banUser(@Param('id') userId: string, @Body() dto: BanUserDto, @Req() req: any) {
    const adminId = req.user.id;
    return await this.usersService.banUser(userId, adminId, dto);
  }

  /**
   * Admin: Unban user
   */
  @Patch(':id/unban')
  @ApiOperation({ summary: '[ADMIN] Unban user' })
  async unbanUser(@Param('id') userId: string, @Body() dto: UnbanUserDto, @Req() req: any) {
    const adminId = req.user.id;
    return await this.usersService.unbanUser(userId, adminId, dto);
  }

  /**
   * Admin: Reset user password
   */
  @Post(':id/reset-password')
  @ApiOperation({ summary: '[ADMIN] Reset user password' })
  async resetUserPassword(
    @Param('id') userId: string,
    @Body() dto: ResetUserPasswordDto,
    @Req() req: any,
  ) {
    const adminId = req.user.id;
    return await this.usersService.resetUserPassword(userId, adminId, dto);
  }

  /**
   * Admin: Get user statistics
   */
  @Get('admin/statistics')
  @ApiOperation({ summary: '[ADMIN] Get user statistics' })
  async getUserStatistics() {
    return await this.usersService.getUserStatistics();
  }
}
