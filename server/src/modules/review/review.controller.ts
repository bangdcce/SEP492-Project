import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // ============ PUBLIC TEST ENDPOINTS (DEV ONLY - REMOVE IN PRODUCTION) ============
  @Get('test/moderation')
  @ApiOperation({ summary: '[DEV] Test endpoint - Get reviews for moderation without auth' })
  async testGetReviewsForModeration(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewService.getReviewsForModeration({ status, page, limit });
  }

  @Get('test/all')
  @ApiOperation({ summary: '[DEV] Test endpoint - Get all reviews without auth' })
  async testGetAllReviews() {
    return this.reviewService.getAllReviewsForTest();
  }

  @Delete('test/:id')
  @ApiOperation({ summary: '[DEV] Test endpoint - Soft delete review without auth' })
  async testSoftDelete(@Param('id') id: string, @Body() dto: DeleteReviewDto) {
    // Use fake admin ID for testing
    const fakeAdminId = '11111111-1111-1111-1111-111111111111';
    return this.reviewService.softDelete(id, fakeAdminId, dto.reason);
  }

  @Post('test/:id/restore')
  @ApiOperation({ summary: '[DEV] Test endpoint - Restore review without auth' })
  async testRestore(@Param('id') id: string, @Body() dto: { reason: string }) {
    const fakeAdminId = '11111111-1111-1111-1111-111111111111';
    return this.reviewService.restore(id, fakeAdminId, dto.reason);
  }

  @Post('test/:id/dismiss-report')
  @ApiOperation({ summary: '[DEV] Test endpoint - Dismiss report without auth' })
  async testDismissReport(@Param('id') id: string, @Body() dto: { reason?: string }) {
    const fakeAdminId = '11111111-1111-1111-1111-111111111111';
    return this.reviewService.dismissReport(id, fakeAdminId, dto.reason);
  }
  // ============ END PUBLIC TEST ENDPOINTS ============

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đánh giá mới cho người dùng trong dự án' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully & Trust Score updating...',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(@GetUser('id') reviewId: string, @Body() createReviewDto: CreateReviewDto, @Req() req: RequestContext) {
    return this.reviewService.create(reviewId, createReviewDto, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Chỉnh sửa đánh giá (Trong vòng 72h)' })
  async update(@GetUser('id') reviewerId: string, @Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto, @Req() req: RequestContext) {
    return this.reviewService.update(reviewerId, id, updateReviewDto, req);
  }

  // 1. GET reviews by targetUserId (với relations)
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách reviews cho một user' })
  async findByTargetUser(@Query('targetUserId') targetUserId: string) {
    return this.reviewService.findByTargetUser(targetUserId);
  }

  // 2. GET edit history for a review
  @Get(':id/history')
  @ApiOperation({ summary: 'Xem lịch sử chỉnh sửa của review' })
  async getEditHistory(@Param('id') reviewId: string) {
    return this.reviewService.getEditHistory(reviewId);
  }

  // 3. DELETE (soft delete) - Admin only
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Xóa mềm review vi phạm' })
  async softDelete(@GetUser('id') adminId: string, @Param('id') id: string, @Body() dto: DeleteReviewDto, @Req() req: RequestContext) {
    return this.reviewService.softDelete(id, adminId, dto.reason);
  }

  // 4. POST restore - Admin only
  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Khôi phục review đã bị xóa mềm' })
  async restore(@GetUser('id') adminId: string, @Param('id') id: string, @Body() dto: { reason: string }, @Req() req: RequestContext) {
    return this.reviewService.restore(id, adminId, dto.reason);
  }

  // 5. POST dismiss report - Admin only
  @Post(':id/dismiss-report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Bỏ qua report của review' })
  async dismissReport(@GetUser('id') adminId: string, @Param('id') id: string, @Body() dto: { reason?: string }, @Req() req: RequestContext) {
    return this.reviewService.dismissReport(id, adminId, dto.reason);
  }

  // 6. GET flagged reviews - Admin only
  @Get('admin/flagged')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách reviews bị flag' })
  async getFlaggedReviews() {
    return this.reviewService.getFlaggedReviews();
  }

  // 7. GET all reviews for moderation - Admin only
  @Get('admin/moderation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lấy danh sách reviews để moderation' })
  async getReviewsForModeration(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewService.getReviewsForModeration({ status, page, limit });
  }
}
