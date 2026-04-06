import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { isBackgroundTaskEnabled } from '../../../config/database-runtime.config';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { DISPUTE_EVENTS } from '../events/dispute.events';
import { VerdictService } from './verdict.service';

@Injectable()
export class DisputeAppealDeadlineScheduler {
  private readonly logger = new Logger(DisputeAppealDeadlineScheduler.name);

  constructor(
    private readonly verdictService: VerdictService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'dispute-appeal-deadline' })
  async handleExpiredAppealDeadlines(): Promise<void> {
    if (
      !isBackgroundTaskEnabled(process.env, 'DISPUTE_APPEAL_DEADLINE_CRON_ENABLED', {
        enabledByDefaultInDevelopment: false,
        enabledByDefaultInProduction: true,
      })
    ) {
      return;
    }

    try {
      const disputeIds = await this.verdictService.listExpiredAppealDeadlineDisputeIds(new Date());
      disputeIds.forEach((disputeId) => {
        this.eventEmitter.emit(DISPUTE_EVENTS.APPEAL_DEADLINE_PASSED, { disputeId });
      });

      if (disputeIds.length > 0) {
        this.logger.log(`Appeal deadline finalization scan triggered ${disputeIds.length} dispute(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Failed appeal deadline finalization scan: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      await this.auditLogsService.logSystemIncident({
        component: 'DisputeAppealDeadlineScheduler',
        operation: 'handle-expired-appeal-deadlines',
        summary: 'Dispute appeal deadline finalization scan failed',
        severity: 'HIGH',
        category: 'SCHEDULER',
        error,
        target: {
          type: 'SchedulerJob',
          id: 'dispute-appeal-deadline',
          label: 'dispute-appeal-deadline',
        },
      });
    }
  }
}
