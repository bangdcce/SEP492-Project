import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isBackgroundTaskEnabled } from '../../config/database-runtime.config';
import { EscrowReleaseService } from './escrow-release.service';

type DueRetentionReleaseResult = {
  scanned: number;
  released: number;
  failed: number;
  failures: Array<{ milestoneId: string; reason: string }>;
};

type RetentionReleaseRunner = {
  releaseDueRetentions(now?: Date): Promise<DueRetentionReleaseResult>;
};

@Injectable()
export class RetentionReleaseScheduler {
  private readonly logger = new Logger(RetentionReleaseScheduler.name);

  constructor(
    @Inject(EscrowReleaseService)
    private readonly escrowReleaseService: RetentionReleaseRunner,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'payments-retention-release' })
  async handleRetentionRelease(): Promise<void> {
    if (
      !isBackgroundTaskEnabled(process.env, 'PAYMENTS_RETENTION_RELEASE_CRON_ENABLED', {
        enabledByDefaultInDevelopment: false,
        enabledByDefaultInProduction: true,
      })
    ) {
      return;
    }

    const result: DueRetentionReleaseResult = await this.escrowReleaseService.releaseDueRetentions(
      new Date(),
    );
    if (result.scanned > 0 || result.failed > 0) {
      this.logger.log(
        `Retention release scan: scanned=${result.scanned}, released=${result.released}, failed=${result.failed}`,
      );
    }
  }
}
