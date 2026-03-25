import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DisputesService } from '../disputes.service';
import { isBackgroundTaskEnabled } from '../../../config/database-runtime.config';

@Injectable()
export class DisputeMediationTimeoutScheduler {
  private readonly logger = new Logger(DisputeMediationTimeoutScheduler.name);

  constructor(private readonly disputesService: DisputesService) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'dispute-mediation-timeout' })
  async handleTimeoutMediationDisputes(): Promise<void> {
    if (
      !isBackgroundTaskEnabled(process.env, 'DISPUTE_MEDIATION_TIMEOUT_CRON_ENABLED', {
        enabledByDefaultInDevelopment: false,
        enabledByDefaultInProduction: true,
      })
    ) {
      return;
    }

    try {
      const result = await this.disputesService.processMediationTimeoutDisputes(new Date());
      if (result.triggered > 0 || result.failed > 0) {
        this.logger.log(
          `Mediation timeout scan: scanned=${result.scanned}, triggered=${result.triggered}, skipped=${result.skipped}, failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed mediation timeout scan: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
