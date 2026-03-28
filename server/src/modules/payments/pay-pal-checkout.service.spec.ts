import { BadRequestException } from '@nestjs/common';
import { PayPalCheckoutService } from './pay-pal-checkout.service';

describe('PayPalCheckoutService', () => {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PAYPAL_CLIENT_ID = 'client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
  });

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('treats duplicate refund ids as already refunded when PayPal capture is refunded', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            name: 'DUPLICATE_REQUEST_ID',
            message: 'The value of PayPal-Request-Id header has already been used.',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'CAPTURE-1',
          status: 'REFUNDED',
        }),
      });
    global.fetch = fetchMock as typeof fetch;

    const service = new PayPalCheckoutService({} as never);
    const result = await service.refundCapture({
      captureId: 'CAPTURE-1',
      currency: 'USD',
      amount: 100,
      requestId: 'escrow-1-cancel-refund',
    });

    expect(result).toEqual({
      refundId: null,
      status: 'REFUNDED',
      captureId: 'CAPTURE-1',
      alreadyRefunded: true,
    });
  });

  it('throws a clearer error when PayPal has the request id but capture is still not refunded', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            name: 'DUPLICATE_REQUEST_ID',
            message: 'The value of PayPal-Request-Id header has already been used.',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'CAPTURE-1',
          status: 'COMPLETED',
        }),
      });
    global.fetch = fetchMock as typeof fetch;

    const service = new PayPalCheckoutService({} as never);

    await expect(
      service.refundCapture({
        captureId: 'CAPTURE-1',
        currency: 'USD',
        amount: 100,
        requestId: 'escrow-1-cancel-refund',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
