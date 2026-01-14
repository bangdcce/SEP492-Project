import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { UserWarningService } from './user-warning.service';
import { CreateUserFlagDto, UpdateUserFlagDto, AppealFlagDto } from './dto';
import { FlagStatus } from './types';

// Interface for authenticated request
interface AuthenticatedRequest {
  user?: { id: string };
}

// TODO: Thêm guards khi có AuthModule
// @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('user-warnings')
export class UserWarningController {
  constructor(private readonly warningService: UserWarningService) {}

  // =============================================================================
  // ADMIN ENDPOINTS
  // =============================================================================

  /**
   * Lấy thống kê flags cho dashboard
   */
  @Get('statistics')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getStatistics() {
    return this.warningService.getFlagStatistics();
  }

  /**
   * Lấy danh sách users bị flag
   */
  @Get('flagged-users')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getFlaggedUsers(
    @Query('status') status?: string, // Use string to avoid Swagger enum issue
    @Query('minSeverity', new DefaultValuePipe(1), ParseIntPipe) minSeverity?: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    const parsedStatus = status as FlagStatus | undefined;
    return this.warningService.getFlaggedUsers(parsedStatus, minSeverity, page, limit);
  }

  /**
   * Lấy danh sách appeals cần review
   */
  @Get('pending-appeals')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async getPendingAppeals(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.warningService.getPendingAppeals(page, limit);
  }

  /**
   * Admin tạo flag cho user
   */
  @Post('users/:userId/flags')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async createFlag(
    @Param('userId') userId: string,
    @Body() dto: CreateUserFlagDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id || 'system';
    return this.warningService.createManualFlag(adminId, userId, dto);
  }

  /**
   * Admin update flag
   */
  @Put('flags/:flagId')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async updateFlag(
    @Param('flagId') flagId: string,
    @Body() dto: UpdateUserFlagDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id || 'system';
    return this.warningService.updateFlag(adminId, flagId, dto);
  }

  /**
   * Admin resolve appeal
   */
  @Put('flags/:flagId/resolve-appeal')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async resolveAppeal(
    @Param('flagId') flagId: string,
    @Body() body: { accepted: boolean; resolution: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user?.id || 'system';
    return this.warningService.resolveAppeal(adminId, flagId, body.accepted, body.resolution);
  }

  // =============================================================================
  // USER ENDPOINTS
  // =============================================================================

  /**
   * Lấy flags của user hiện tại
   */
  @Get('my-flags')
  async getMyFlags(
    @Req() req: AuthenticatedRequest,
    @Query('includeResolved', new DefaultValuePipe(false), ParseBoolPipe) includeResolved: boolean,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return { flags: [], hasWarning: false };
    }
    const flags = await this.warningService.getUserFlags(userId, includeResolved);
    const hasWarning = await this.warningService.hasActiveWarning(userId);
    return { flags, hasWarning };
  }

  /**
   * User gửi appeal cho flag
   */
  @Post('flags/:flagId/appeal')
  async appealFlag(
    @Param('flagId') flagId: string,
    @Body() dto: AppealFlagDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      return { error: 'Unauthorized', message: 'User not authenticated' };
    }
    return this.warningService.appealFlag(userId, flagId, dto);
  }

  // =============================================================================
  // PUBLIC ENDPOINTS (cho kiểm tra badge)
  // =============================================================================

  /**
   * Lấy flags của một user (chỉ active, không internal)
   */
  @Get('users/:userId/flags')
  async getUserFlags(
    @Param('userId') userId: string,
    @Query('includeResolved', new DefaultValuePipe(false), ParseBoolPipe) includeResolved: boolean,
  ) {
    const flags = await this.warningService.getUserFlags(userId, includeResolved);
    const hasWarning = await this.warningService.hasActiveWarning(userId);
    const highestSeverity = await this.warningService.getHighestSeverity(userId);

    return {
      flags,
      hasWarning,
      highestSeverity,
    };
  }

  /**
   * Check nhanh warning status của user
   */
  @Get('users/:userId/warning-status')
  async getWarningStatus(@Param('userId') userId: string) {
    const hasWarning = await this.warningService.hasActiveWarning(userId);
    const severity = await this.warningService.getHighestSeverity(userId);
    return {
      hasWarning,
      severity,
      warningLevel: this.getWarningLevel(severity),
    };
  }

  private getWarningLevel(severity: number): string {
    if (severity >= 5) return 'SEVERE';
    if (severity >= 4) return 'CRITICAL';
    if (severity >= 3) return 'HIGH';
    if (severity >= 2) return 'MEDIUM';
    if (severity >= 1) return 'LOW';
    return 'NONE';
  }

  // =============================================================================
  // ADMIN: Manual checks
  // =============================================================================

  /**
   * Trigger kiểm tra performance flags cho user (admin manual trigger)
   */
  @Post('users/:userId/check-performance')
  // @Roles(UserRole.ADMIN, UserRole.STAFF)
  async checkPerformanceFlags(@Param('userId') userId: string) {
    const flags = await this.warningService.checkPerformanceFlags(userId);
    return {
      message: `Checked performance for user ${userId}`,
      newFlags: flags.length,
      flags,
    };
  }

  /**
   * Trigger expire old flags (admin manual trigger, normally runs via cron)
   */
  @Post('expire-old-flags')
  // @Roles(UserRole.ADMIN)
  async expireOldFlags() {
    const count = await this.warningService.expireOldFlags();
    return { message: `Expired ${count} old flags` };
  }
}
