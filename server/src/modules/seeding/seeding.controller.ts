import { Controller, Post } from '@nestjs/common';
import { SeedingService } from './seeding.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Seeding')
@Controller('seeding')
export class SeedingController {
  constructor(private readonly seedingService: SeedingService) {}

  @Post('c05')
  @ApiOperation({ summary: 'Seed data for C05 (Project Specs) testing' })
  async seedC05() {
    return this.seedingService.seedC05();
  }
}
