import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { TrustProfilesService } from './trust-profiles.service';

@ApiTags('Trust Profiles')
@Controller('trust-profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrustProfilesController {
  constructor(private readonly trustProfilesService: TrustProfilesService) {}

  @Get(':userId')
  @ApiOperation({ summary: 'Get trust profile details for a user' })
  async getTrustProfile(@Param('userId') userId: string, @GetUser('id') viewerUserId?: string) {
    return this.trustProfilesService.getTrustProfile(userId, viewerUserId);
  }
}
