import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HearingService } from './hearing.service';
import { isBackgroundTaskEnabled } from '../../../config/database-runtime.config';

@Injectable()
export class HearingReminderScheduler {
  private readonly logger = new Logger(HearingReminderScheduler.name);

  constructor(private readonly hearingService: HearingService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'hearing-reminder-dispatch',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async dispatchDueHearingReminders(): Promise<void> {
    if (
      !isBackgroundTaskEnabled(process.env, 'HEARING_REMINDER_CRON_ENABLED', {
        enabledByDefaultInDevelopment: false,
        enabledByDefaultInProduction: true,
      })
    ) {
      return;
    }

    try {
      const result = await this.hearingService.dispatchDueHearingReminders(new Date());
      if (result.sent > 0) {
        this.logger.log(
          `Dispatched ${result.sent} hearing reminder(s) at ${result.referenceAt} (skipped=${result.skipped})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch hearing reminders: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
