import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HearingService } from './hearing.service';
import { isBackgroundTaskEnabled } from '../../../config/database-runtime.config';

@Injectable()
export class HearingLifecycleScheduler {
  private readonly logger = new Logger(HearingLifecycleScheduler.name);

  constructor(private readonly hearingService: HearingService) {}

  private async runJobSafely<T>(
    jobName: string,
    run: () => Promise<T>,
    onSuccess?: (result: T) => void,
  ): Promise<T | null> {
    try {
      const result = await run();
      onSuccess?.(result);
      return result;
    } catch (error) {
      this.logger.error(
        `Hearing lifecycle job "${jobName}" failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

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

    const referenceAt = new Date();

    const confirmationTimeouts = await this.runJobSafely(
      'confirmation-timeout-reschedule',
      () => this.hearingService.autoRescheduleExpiredPendingHearings(referenceAt),
      (result) => {
        if (result.rescheduled > 0 || result.flagged > 0 || result.repaired > 0) {
          this.logger.log(
            `Hearing confirmation timeout tick: repaired=${result.repaired}, rescheduled=${result.rescheduled}, flagged=${result.flagged}, at=${result.referenceAt}`,
          );
        }
      },
    );

    const autoStartResult = await this.runJobSafely('auto-start', () =>
      this.hearingService.autoStartDueHearings(referenceAt),
    );
    if (autoStartResult && (autoStartResult.started > 0 || autoStartResult.blocked > 0)) {
      this.logger.log(
        `Hearing auto-start tick: started=${autoStartResult.started}, blocked=${autoStartResult.blocked}, at=${autoStartResult.referenceAt}`,
      );
    }

    const warningResult = await this.runJobSafely('active-hearing-time-warnings', () =>
      this.hearingService.dispatchActiveHearingTimeWarnings(referenceAt),
    );
    if (warningResult && warningResult.warnings > 0) {
      this.logger.log(
        `Hearing warning tick: warnings=${warningResult.warnings}, at=${warningResult.referenceAt}`,
      );
    }

    const pausedResult = await this.runJobSafely('paused-hearing-auto-close', () =>
      this.hearingService.autoCloseAbandonedPausedHearings(referenceAt),
    );
    if (pausedResult && (pausedResult.closed > 0 || pausedResult.failed > 0)) {
      this.logger.log(
        `Hearing paused-timeout tick: checked=${pausedResult.checked}, closed=${pausedResult.closed}, failed=${pausedResult.failed}, at=${pausedResult.referenceAt}`,
      );
    }

    const overdueResult = await this.runJobSafely('overdue-hearing-auto-close', () =>
      this.hearingService.autoCloseOverdueHearings(referenceAt),
    );
    if (overdueResult && (overdueResult.closed > 0 || overdueResult.failed > 0)) {
      this.logger.log(
        `Hearing auto-close tick: checked=${overdueResult.checked}, closed=${overdueResult.closed}, failed=${overdueResult.failed}, at=${overdueResult.referenceAt}`,
      );
    }

    const blockedStarts = autoStartResult?.blocked || 0;
    const flaggedConfirmations = confirmationTimeouts?.flagged || 0;
    if (blockedStarts > 0 || flaggedConfirmations > 0) {
      this.logger.warn(
        `Hearing auto-schedule backlog warning: blockedStarts=${blockedStarts}, flaggedPendingConfirmations=${flaggedConfirmations}, referenceAt=${referenceAt.toISOString()}`,
      );
    }
  }
}
