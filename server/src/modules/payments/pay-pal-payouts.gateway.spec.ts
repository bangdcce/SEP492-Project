import { PayoutMethodType, PayoutRequestEntity } from '../../database/entities';
import { PayPalPayoutsGateway } from './pay-pal-payouts.gateway';

describe('PayPalPayoutsGateway', () => {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalPayoutsClientId = process.env.PAYPAL_PAYOUTS_CLIENT_ID;
  const originalPayoutsClientSecret = process.env.PAYPAL_PAYOUTS_CLIENT_SECRET;

  beforeEach(() => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_PAYOUTS_CLIENT_ID;
    delete process.env.PAYPAL_PAYOUTS_CLIENT_SECRET;
  });

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
    if (originalPayoutsClientId === undefined) delete process.env.PAYPAL_PAYOUTS_CLIENT_ID;
    else process.env.PAYPAL_PAYOUTS_CLIENT_ID = originalPayoutsClientId;
    if (originalPayoutsClientSecret === undefined) delete process.env.PAYPAL_PAYOUTS_CLIENT_SECRET;
    else process.env.PAYPAL_PAYOUTS_CLIENT_SECRET = originalPayoutsClientSecret;
  });

  it('falls back to the sandbox lane when credentials are missing', async () => {
    const gateway = new PayPalPayoutsGateway();
    const result = await gateway.payout(
      {
        id: 'payout-1',
      } as PayoutRequestEntity,
      {
        type: PayoutMethodType.PAYPAL_EMAIL,
        paypalEmail: 'cashout@example.com',
        bankName: null,
      },
      {
        currency: 'USD',
        amount: 50,
        fee: 0,
        netAmount: 50,
        note: 'Cashout',
      },
    );

    expect(result.sandboxFallback).toBe(true);
    expect(result.providerReference).toContain('sandbox:payout:payout-1');
  });

  it('returns an unavailable merchant balance when credentials are missing', async () => {
    const gateway = new PayPalPayoutsGateway();
    const result = await gateway.getMerchantBalance();

    expect(result.status).toBe('UNAVAILABLE');
    expect(result.errorCode).toBe('MISSING_CREDENTIALS');
    expect(result.balances).toEqual([]);
  });
});
