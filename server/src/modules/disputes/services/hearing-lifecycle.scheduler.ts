import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HearingService } from './hearing.service';
import { isBackgroundTaskEnabled } from '../../../config/database-runtime.config';

@Injectable()
export class HearingLifecycleScheduler {
  private readonly logger = new Logger(HearingLifecycleScheduler.name);

  constructor(private readonly hearingService: HearingService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'hearing-auto-start' })
  async autoStartDueHearings(): Promise<void> {
    if (
      !isBackgroundTaskEnabled(process.env, 'HEARING_AUTO_START_ENABLED', {
        enabledByDefaultInDevelopment: true,
        enabledByDefaultInProduction: true,
      })
    ) {
      return;
    }

    try {
      const referenceAt = new Date();
      const confirmationTimeouts =
        await this.hearingService.autoRescheduleExpiredPendingHearings(referenceAt);
      if (
        confirmationTimeouts.rescheduled > 0 ||
        confirmationTimeouts.flagged > 0 ||
        confirmationTimeouts.repaired > 0
      ) {
        this.logger.log(
          `Hearing confirmation timeout tick: repaired=${confirmationTimeouts.repaired}, rescheduled=${confirmationTimeouts.rescheduled}, flagged=${confirmationTimeouts.flagged}, at=${confirmationTimeouts.referenceAt}`,
        );
      }

      const result = await this.hearingService.autoStartDueHearings(referenceAt);
      if (result.started > 0 || result.blocked > 0) {
        this.logger.log(
          `Hearing auto-start tick: started=${result.started}, blocked=${result.blocked}, at=${result.referenceAt}`,
        );
      }

      const warningResult = await this.hearingService.dispatchActiveHearingTimeWarnings(referenceAt);
      if (warningResult.warnings > 0) {
        this.logger.log(
          `Hearing warning tick: warnings=${warningResult.warnings}, at=${warningResult.referenceAt}`,
        );
      }

      const pausedResult = await this.hearingService.autoCloseAbandonedPausedHearings(referenceAt);
      if (pausedResult.closed > 0 || pausedResult.failed > 0) {
        this.logger.log(
          `Hearing paused-timeout tick: checked=${pausedResult.checked}, closed=${pausedResult.closed}, failed=${pausedResult.failed}, at=${pausedResult.referenceAt}`,
        );
      }

      const overdueResult = await this.hearingService.autoCloseOverdueHearings(referenceAt);
      if (overdueResult.closed > 0 || overdueResult.failed > 0) {
        this.logger.log(
          `Hearing auto-close tick: checked=${overdueResult.checked}, closed=${overdueResult.closed}, failed=${overdueResult.failed}, at=${overdueResult.referenceAt}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-start due hearings: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
