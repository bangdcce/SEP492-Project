import { Logger } from '@nestjs/common';
import { EscrowReleaseService } from './escrow-release.service';
import { RetentionReleaseScheduler } from './retention-release.scheduler';

describe('RetentionReleaseScheduler', () => {
  let scheduler: RetentionReleaseScheduler;
  let escrowReleaseService: { releaseDueRetentions: jest.Mock };

  const envKey = 'PAYMENTS_RETENTION_RELEASE_CRON_ENABLED';
  const originalValue = process.env[envKey];

  beforeEach(() => {
    escrowReleaseService = {
      releaseDueRetentions: jest.fn(),
    };

    scheduler = new RetentionReleaseScheduler(
      escrowReleaseService as unknown as EscrowReleaseService,
    );
    delete process.env[envKey];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (typeof originalValue === 'undefined') {
      delete process.env[envKey];
    } else {
      process.env[envKey] = originalValue;
    }
  });

  it('does not run when the cron is disabled', async () => {
    process.env[envKey] = 'false';

    await scheduler.handleRetentionRelease();

    expect(escrowReleaseService.releaseDueRetentions).not.toHaveBeenCalled();
  });

  it('logs and suppresses background job failures', async () => {
    process.env[envKey] = 'true';
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    escrowReleaseService.releaseDueRetentions.mockRejectedValue(new Error('boom'));

    await expect(scheduler.handleRetentionRelease()).resolves.toBeUndefined();

    expect(escrowReleaseService.releaseDueRetentions).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Retention release scan failed: boom');
  });
});
