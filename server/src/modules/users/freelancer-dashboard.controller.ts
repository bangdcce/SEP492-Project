import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { UsersService } from './users.service';

@Controller('freelancer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FREELANCER)
export class FreelancerDashboardController {
  constructor(private readonly usersService: UsersService) {}

  @Get('dashboard')
  async getDashboard(
    @GetUser() user: UserEntity,
    @Query('search') search?: string,
    @Query('skills') skills?: string,
  ) {
    return this.usersService.getFreelancerDashboard(user, { search, skills });
  }
}
