import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLive() {
    return this.healthService.getLiveStatus();
  }

  @Get('ready')
  async getReady() {
    return await this.healthService.getReadinessStatus();
  }
}
