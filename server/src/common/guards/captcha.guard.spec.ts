import { BadRequestException, ExecutionContext } from '@nestjs/common';

import { CaptchaGuard } from './captcha.guard';

const createExecutionContext = (body: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        body,
      }),
    }),
  }) as ExecutionContext;

describe('CaptchaGuard', () => {
  let guard: CaptchaGuard;
  let configService: { get: jest.Mock };
  let captchaService: { verifyRecaptcha: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    };
    captchaService = {
      verifyRecaptcha: jest.fn(),
    };

    guard = new CaptchaGuard(configService as any, captchaService as any);
  });

  it('skips verification when reCAPTCHA is disabled', async () => {
    configService.get.mockReturnValue('false');

    const result = await guard.canActivate(createExecutionContext({}));

    expect(result).toBe(true);
    expect(captchaService.verifyRecaptcha).not.toHaveBeenCalled();
  });

  it('rejects requests without a token when reCAPTCHA is enabled', async () => {
    configService.get.mockReturnValue('true');

    await expect(guard.canActivate(createExecutionContext({}))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(captchaService.verifyRecaptcha).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid token when reCAPTCHA is enabled', async () => {
    configService.get.mockReturnValue('true');
    captchaService.verifyRecaptcha.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          recaptchaToken: 'invalid-token',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(captchaService.verifyRecaptcha).toHaveBeenCalledWith('invalid-token');
  });

  it('allows requests with a valid token when reCAPTCHA is enabled', async () => {
    configService.get.mockReturnValue('true');
    captchaService.verifyRecaptcha.mockResolvedValue(true);

    const result = await guard.canActivate(
      createExecutionContext({
        recaptchaToken: 'valid-token',
      }),
    );

    expect(result).toBe(true);
    expect(captchaService.verifyRecaptcha).toHaveBeenCalledWith('valid-token');
  });
});
