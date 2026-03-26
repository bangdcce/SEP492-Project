import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrustProfilesService } from './trust-profiles.service';

@ApiTags('Trust Profiles')
@Controller('trust-profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrustProfilesController {
  constructor(private readonly trustProfilesService: TrustProfilesService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Get trust profile details for a user' })
  async getTrustProfile(@Param('userId') userId: string) {
    return this.trustProfilesService.getTrustProfile(userId);
  }
}
