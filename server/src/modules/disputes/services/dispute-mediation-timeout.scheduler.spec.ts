import { DisputesService } from '../disputes.service';
import { DisputeMediationTimeoutScheduler } from './dispute-mediation-timeout.scheduler';

describe('DisputeMediationTimeoutScheduler', () => {
  let scheduler: DisputeMediationTimeoutScheduler;
  let disputesService: { processMediationTimeoutDisputes: jest.Mock };
  let auditLogsService: { logSystemIncident: jest.Mock };

  const envKey = 'DISPUTE_MEDIATION_TIMEOUT_CRON_ENABLED';
  const originalValue = process.env[envKey];

  beforeEach(() => {
    disputesService = {
      processMediationTimeoutDisputes: jest.fn(),
    };
    auditLogsService = {
      logSystemIncident: jest.fn().mockResolvedValue(undefined),
    };
    scheduler = new DisputeMediationTimeoutScheduler(
      disputesService as unknown as DisputesService,
      auditLogsService as never,
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

    await scheduler.handleTimeoutMediationDisputes();

    expect(disputesService.processMediationTimeoutDisputes).not.toHaveBeenCalled();
  });

  it('runs timeout scan when cron is enabled', async () => {
    process.env[envKey] = 'true';
    disputesService.processMediationTimeoutDisputes.mockResolvedValue({
      scanned: 2,
      triggered: 1,
      skipped: 1,
      failed: 0,
    });

    await scheduler.handleTimeoutMediationDisputes();

    expect(disputesService.processMediationTimeoutDisputes).toHaveBeenCalledTimes(1);
  });

  it('logs a system incident when the scheduler crashes', async () => {
    process.env[envKey] = 'true';
    disputesService.processMediationTimeoutDisputes.mockRejectedValue(new Error('boom'));

    await scheduler.handleTimeoutMediationDisputes();

    expect(auditLogsService.logSystemIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'DisputeMediationTimeoutScheduler',
        operation: 'handle-timeout-mediation-disputes',
        category: 'SCHEDULER',
      }),
    );
  });
});
