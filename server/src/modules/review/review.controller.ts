import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/database/entities';
import type { RequestContext } from '../audit-logs/audit-logs.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { DeleteReviewDto } from './dto/delete-review.dto';
import {
  ReviewModerationReassignDto,
  ReviewModerationVersionDto,
} from './dto/review-moderation.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  private assertDevOnlyRoute() {
    const env = (process.env.NODE_ENV || '').trim().toLowerCase();
    const allowTestRoutes =
      (process.env.ENABLE_REVIEW_TEST_ROUTES || '').trim().toLowerCase() === 'true';
    const isNonProductionEnv = env === 'development' || env === 'test';

    if (!isNonProductionEnv || !allowTestRoutes) {
      throw new NotFoundException('Route not available.');
    }
  }

  // ============ DEV TEST ENDPOINTS (REQUIRE ADMIN + EXPLICIT ENABLE FLAG) ============
  @Get('test/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[DEV] Test endpoint - Get reviews for moderation' })
  async testGetReviewsForModeration(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    this.assertDevOnlyRoute();
    return this.reviewService.getReviewsForModeration({ status, page, limit });
  }

  @Get('test/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[DEV] Test endpoint - Get all reviews' })
  async testGetAllReviews() {
    this.assertDevOnlyRoute();
    return this.reviewService.getAllReviewsForTest();
  }

  @Delete('test/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[DEV] Test endpoint - Soft delete review' })
  async testSoftDelete(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteReviewDto,
  ) {
    this.assertDevOnlyRoute();
    return this.reviewService.softDelete(id, adminId, dto.reason);
  }

  @Post('test/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[DEV] Test endpoint - Restore review' })
  async testRestore(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
  ) {
    this.assertDevOnlyRoute();
    return this.reviewService.restore(id, adminId, dto.reason);
  }

  @Post('test/:id/dismiss-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[DEV] Test endpoint - Dismiss report' })
  async testDismissReport(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason?: string },
  ) {
    this.assertDevOnlyRoute();
    return this.reviewService.dismissReport(id, adminId, dto.reason);
  }
  // ============ END DEV TEST ENDPOINTS ============

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đánh giá mới cho người dùng trong dự án' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully & Trust Score updating...',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @GetUser('id') reviewId: string,
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: RequestContext,
  ) {
    return this.reviewService.create(reviewId, createReviewDto, req);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chỉnh sửa đánh giá (Trong vòng 72h)' })
  async update(
    @GetUser('id') reviewerId: string,
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req: RequestContext,
  ) {
    return this.reviewService.update(reviewerId, id, updateReviewDto, req);
  }

  // 1. GET reviews by targetUserId (với relations)
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách reviews cho một user' })
  async findByTargetUser(
    @Query('targetUserId', new ParseUUIDPipe()) targetUserId: string,
  ) {
    return this.reviewService.findByTargetUser(targetUserId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review availability for the current user on a project target' })
  async getProjectReviewStatus(
    @GetUser('id') reviewerId: string,
    @Query('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('targetUserId', new ParseUUIDPipe()) targetUserId: string,
  ) {
    return this.reviewService.getProjectReviewStatus(reviewerId, projectId, targetUserId);
  }

  // 2. GET edit history for a review
  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem lịch sử chỉnh sửa của review' })
  async getEditHistory(@Param('id') reviewId: string) {
    return this.reviewService.getEditHistory(reviewId);
  }

  // 3. DELETE (soft delete) - Admin only
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Xóa mềm review vi phạm' })
  async softDelete(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: DeleteReviewDto,
  ) {
    return this.reviewService.softDelete(id, adminId, dto.reason);
  }

  // 4. POST restore - Admin only
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Khôi phục review đã bị xóa mềm' })
  async restore(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: { reason: string },
  ) {
    return this.reviewService.restore(id, adminId, dto.reason);
  }

  // 5. POST dismiss report - Admin only
  @Post(':id/dismiss-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Bỏ qua report của review' })
  async dismissReport(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ) {
    return this.reviewService.dismissReport(id, adminId, dto.reason);
  }

  // 6. GET flagged reviews - Admin only
  @Get('admin/flagged')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách reviews bị flag' })
  async getFlaggedReviews() {
    return this.reviewService.getFlaggedReviews();
  }

  // 7. GET all reviews for moderation - Admin only
  @Get('admin/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách reviews để moderation' })
  async getReviewsForModeration(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    return this.reviewService.getReviewsForModeration({ status, page, limit });
  }

  @Post('admin/moderation/:id/open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  async openModerationCase(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewModerationVersionDto,
  ) {
    return this.reviewService.openModerationCase(id, adminId, dto.assignmentVersion);
  }

  @Post('admin/moderation/:id/take')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  async takeModerationCase(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewModerationVersionDto,
  ) {
    return this.reviewService.takeModerationCase(id, adminId, dto.assignmentVersion);
  }

  @Post('admin/moderation/:id/release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  async releaseModerationCase(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewModerationVersionDto,
  ) {
    return this.reviewService.releaseModerationCase(id, adminId, dto.assignmentVersion);
  }

  @Post('admin/moderation/:id/reassign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  async reassignModerationCase(
    @GetUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewModerationReassignDto,
  ) {
    return this.reviewService.reassignModerationCase(
      id,
      adminId,
      dto.assigneeId,
      dto.assignmentVersion,
      dto.reason,
    );
  }
}
