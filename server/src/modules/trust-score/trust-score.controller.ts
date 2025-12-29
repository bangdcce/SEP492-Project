import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';

@ApiTags('Trust Score')
@Controller('trust-score')
export class TrustScoreController {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  /**
   * Calculate trust score for a user
   */
  @Post('calculate/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate/recalculate trust score for a user' })
  async calculateScore(@Param('userId') userId: string) {
    return this.trustScoreService.calculateTrustScore(userId);
  }

  /**
   * Get trust score history for a user
   */
  @Get('history/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trust score history for a user' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of records to return',
  })
  async getHistory(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.trustScoreService.getScoreHistory(userId, limit ? parseInt(limit) : 30);
  }
}
