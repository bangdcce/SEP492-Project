import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HearingService } from './hearing.service';

@Injectable()
export class HearingReminderScheduler {
  private readonly logger = new Logger(HearingReminderScheduler.name);

  constructor(private readonly hearingService: HearingService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'hearing-reminder-dispatch' })
  async dispatchDueHearingReminders(): Promise<void> {
    if (process.env.HEARING_REMINDER_CRON_ENABLED === 'false') {
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
