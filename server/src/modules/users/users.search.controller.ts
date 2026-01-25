import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UsersSearchService, UserSearchFilters } from './users.search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../database/entities/user.entity';

@ApiTags('Users Discovery')
@Controller('discovery')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersSearchController {
  constructor(private readonly searchService: UsersSearchService) {}

  @Get('users')
  @ApiOperation({ summary: 'Search for Freelancers and Brokers' })
  @ApiQuery({ name: 'role', required: false, enumName: 'UserRole', enum: ['BROKER', 'FREELANCER'] })
  @ApiQuery({ name: 'search', required: false, description: 'Name or Bio keywords' })
  @ApiQuery({ name: 'skills', required: false, description: 'Comma separated skill names', type: String })
  @ApiQuery({ name: 'minRating', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchUsers(
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('skills') skills?: string,
    @Query('minRating') minRating?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const skillList = skills ? skills.split(',').map(s => s.trim()) : undefined;
    const filters: UserSearchFilters = {
      role,
      search,
      skills: skillList,
      minRating: Number(minRating),
      page: Number(page),
      limit: Number(limit),
    };

    return this.searchService.searchUsers(filters);
  }

  @Get('profile/:id')
  @ApiOperation({ summary: 'Get public profile of a user' })
  @ApiResponse({ status: 200, description: 'User Profile' })
  async getProfile(@Param('id') id: string) {
    return this.searchService.getPublicProfile(id);
  }
}
