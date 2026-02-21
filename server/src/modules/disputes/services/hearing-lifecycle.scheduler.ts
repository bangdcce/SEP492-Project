import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HearingService } from './hearing.service';

@Injectable()
export class HearingLifecycleScheduler {
  private readonly logger = new Logger(HearingLifecycleScheduler.name);

  constructor(private readonly hearingService: HearingService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'hearing-auto-start' })
  async autoStartDueHearings(): Promise<void> {
    if (process.env.HEARING_AUTO_START_ENABLED === 'false') {
      return;
    }

    try {
      const result = await this.hearingService.autoStartDueHearings(new Date());
      if (result.started > 0 || result.blocked > 0) {
        this.logger.log(
          `Hearing auto-start tick: started=${result.started}, blocked=${result.blocked}, at=${result.referenceAt}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-start due hearings: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
