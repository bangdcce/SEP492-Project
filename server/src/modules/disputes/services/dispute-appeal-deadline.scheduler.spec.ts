import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { DISPUTE_EVENTS } from '../events/dispute.events';
import { DisputeAppealDeadlineScheduler } from './dispute-appeal-deadline.scheduler';
import { VerdictService } from './verdict.service';

describe('DisputeAppealDeadlineScheduler', () => {
  let scheduler: DisputeAppealDeadlineScheduler;
  let verdictService: { listExpiredAppealDeadlineDisputeIds: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let auditLogsService: { logSystemIncident: jest.Mock };

  const envKey = 'DISPUTE_APPEAL_DEADLINE_CRON_ENABLED';
  const originalValue = process.env[envKey];

  beforeEach(() => {
    verdictService = {
      listExpiredAppealDeadlineDisputeIds: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    auditLogsService = {
      logSystemIncident: jest.fn().mockResolvedValue(undefined),
    };
    scheduler = new DisputeAppealDeadlineScheduler(
      verdictService as unknown as VerdictService,
      eventEmitter as unknown as EventEmitter2,
      auditLogsService as unknown as AuditLogsService,
    );
    delete process.env[envKey];
  });

  afterAll(() => {
    if (typeof originalValue === 'undefined') {
      delete process.env[envKey];
    } else {
      process.env[envKey] = originalValue;
    }
  });

  it('does not run scan when cron is disabled by env', async () => {
    process.env[envKey] = 'false';

    await scheduler.handleExpiredAppealDeadlines();

    expect(verdictService.listExpiredAppealDeadlineDisputeIds).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('runs scan by default in development when env is not set', async () => {
    verdictService.listExpiredAppealDeadlineDisputeIds.mockResolvedValue([]);

    await scheduler.handleExpiredAppealDeadlines();

    expect(verdictService.listExpiredAppealDeadlineDisputeIds).toHaveBeenCalledTimes(1);
  });

  it('emits finalization events for expired appeal deadlines', async () => {
    process.env[envKey] = 'true';
    verdictService.listExpiredAppealDeadlineDisputeIds.mockResolvedValue(['d-1', 'd-2']);

    await scheduler.handleExpiredAppealDeadlines();

    expect(verdictService.listExpiredAppealDeadlineDisputeIds).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      1,
      DISPUTE_EVENTS.APPEAL_DEADLINE_PASSED,
      { disputeId: 'd-1' },
    );
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      2,
      DISPUTE_EVENTS.APPEAL_DEADLINE_PASSED,
      { disputeId: 'd-2' },
    );
  });

  it('logs a system incident when the scheduler crashes', async () => {
    process.env[envKey] = 'true';
    verdictService.listExpiredAppealDeadlineDisputeIds.mockRejectedValue(new Error('boom'));

    await scheduler.handleExpiredAppealDeadlines();

    expect(auditLogsService.logSystemIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'DisputeAppealDeadlineScheduler',
        operation: 'handle-expired-appeal-deadlines',
        category: 'SCHEDULER',
      }),
    );
  });
});
