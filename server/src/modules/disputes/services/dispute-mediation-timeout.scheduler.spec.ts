import { DisputesService } from '../disputes.service';
import { DisputeMediationTimeoutScheduler } from './dispute-mediation-timeout.scheduler';

describe('DisputeMediationTimeoutScheduler', () => {
  let scheduler: DisputeMediationTimeoutScheduler;
  let disputesService: { processMediationTimeoutDisputes: jest.Mock };

  const envKey = 'DISPUTE_MEDIATION_TIMEOUT_CRON_ENABLED';
  const originalValue = process.env[envKey];

  beforeEach(() => {
    disputesService = {
      processMediationTimeoutDisputes: jest.fn(),
    };
    scheduler = new DisputeMediationTimeoutScheduler(disputesService as unknown as DisputesService);
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
    disputesService.processMediationTimeoutDisputes.mockResolvedValue({
      scanned: 2,
      triggered: 1,
      skipped: 1,
      failed: 0,
    });

    await scheduler.handleTimeoutMediationDisputes();

    expect(disputesService.processMediationTimeoutDisputes).toHaveBeenCalledTimes(1);
  });
});
