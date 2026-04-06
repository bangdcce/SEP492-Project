import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FundingGateway } from '../../database/entities';
import { PaymentsController } from './payments.controller';
import { MilestoneFundingService } from './milestone-funding.service';
import { PayPalCheckoutService } from './pay-pal-checkout.service';
import { StripeCheckoutService } from './stripe-checkout.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  const milestoneFundingService = {
    fundMilestone: jest.fn(),
    createPayPalMilestoneOrder: jest.fn(),
    completePayPalMilestoneFunding: jest.fn(),
    createStripeMilestoneCheckoutSession: jest.fn(),
    completeStripeMilestoneFunding: jest.fn(),
  };
  const payPalCheckoutService = {
    getSdkConfigForUser: jest.fn(),
  };
  const stripeCheckoutService = {
    getClientConfig: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: MilestoneFundingService,
          useValue: milestoneFundingService,
        },
        {
          provide: StripeCheckoutService,
          useValue: stripeCheckoutService,
        },
        {
          provide: PayPalCheckoutService,
          useValue: payPalCheckoutService,
        },
      ],
    }).compile();

    controller = module.get(PaymentsController);
  });

  it('requires the Idempotency-Key header', async () => {
    await expect(
      controller.fundMilestone(
        { id: 'client-1' } as never,
        'milestone-1',
        { paymentMethodId: 'method-1', gateway: FundingGateway.INTERNAL_SANDBOX },
        '',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes funding input through when the Idempotency-Key header is present', async () => {
    milestoneFundingService.fundMilestone.mockResolvedValue({
      fundingIntentId: 'intent-1',
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: 'FUNDED',
      walletSnapshot: {},
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
      nextAction: null,
      gateway: FundingGateway.INTERNAL_SANDBOX,
    });

    const result = await controller.fundMilestone(
      { id: 'client-1' } as never,
      'milestone-1',
      { paymentMethodId: 'method-1', gateway: FundingGateway.INTERNAL_SANDBOX },
      'idem-1',
    );

    expect(milestoneFundingService.fundMilestone).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      idempotencyKey: 'idem-1',
    });
    expect(result.success).toBe(true);
  });

  it('propagates funding service errors after header validation succeeds', async () => {
    const error = new Error('funding failed');
    milestoneFundingService.fundMilestone.mockRejectedValue(error);

    await expect(
      controller.fundMilestone(
        { id: 'client-1' } as never,
        'milestone-1',
        { paymentMethodId: 'method-1', gateway: FundingGateway.INTERNAL_SANDBOX },
        'idem-1',
      ),
    ).rejects.toThrow(error);

    expect(milestoneFundingService.fundMilestone).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.INTERNAL_SANDBOX,
      idempotencyKey: 'idem-1',
    });
  });

  it('returns the PayPal sandbox config', async () => {
    payPalCheckoutService.getSdkConfigForUser.mockResolvedValue({
      clientId: 'client-id',
      environment: 'sandbox',
      vaultEnabled: true,
      userIdToken: 'id-token',
    });

    const result = await controller.getPayPalConfig({ id: 'client-1' } as never, 'method-1');

    expect(result).toEqual({
      success: true,
      data: {
        clientId: 'client-id',
        environment: 'sandbox',
        vaultEnabled: true,
        userIdToken: 'id-token',
      },
    });
    expect(payPalCheckoutService.getSdkConfigForUser).toHaveBeenCalledWith('client-1', 'method-1');
  });

  it('returns the Stripe checkout config', () => {
    stripeCheckoutService.getClientConfig.mockReturnValue({
      enabled: true,
      environment: 'test',
    });

    const result = controller.getStripeConfig();

    expect(result).toEqual({
      success: true,
      data: {
        enabled: true,
        environment: 'test',
      },
    });
  });

  it('passes captured PayPal orders through to the funding service', async () => {
    milestoneFundingService.completePayPalMilestoneFunding.mockResolvedValue({
      fundingIntentId: 'intent-paypal-1',
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: 'FUNDED',
      walletSnapshot: {},
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
      nextAction: { type: 'PAYPAL_CAPTURE_COMPLETED' },
      gateway: FundingGateway.PAYPAL,
    });

    const order = {
      id: 'PAYPAL-ORDER-1',
      purchase_units: [],
    };

    const result = await controller.completePayPalCapture(
      { id: 'client-1' } as never,
      'milestone-1',
      {
        paymentMethodId: 'method-1',
        order,
      },
    );

    expect(milestoneFundingService.completePayPalMilestoneFunding).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.PAYPAL,
      orderId: undefined,
      order,
    });
    expect(result.success).toBe(true);
  });

  it('passes PayPal order creation through to the funding service', async () => {
    milestoneFundingService.createPayPalMilestoneOrder.mockResolvedValue({
      orderId: 'PAYPAL-ORDER-NEW',
      status: 'PAYER_ACTION_REQUIRED',
      vaultRequested: true,
    });

    const result = await controller.createPayPalMilestoneOrder(
      { id: 'client-1' } as never,
      'milestone-1',
      {
        paymentMethodId: 'method-1',
        source: 'paypal',
        returnUrl: 'https://localhost:5173/client/workspace/project-1',
        cancelUrl: 'https://localhost:5173/client/workspace/project-1',
      },
    );

    expect(milestoneFundingService.createPayPalMilestoneOrder).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'method-1',
      gateway: FundingGateway.PAYPAL,
      source: 'paypal',
      returnUrl: 'https://localhost:5173/client/workspace/project-1',
      cancelUrl: 'https://localhost:5173/client/workspace/project-1',
    });
    expect(result.success).toBe(true);
  });

  it('passes Stripe Checkout Session creation through to the funding service', async () => {
    milestoneFundingService.createStripeMilestoneCheckoutSession.mockResolvedValue({
      sessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });

    const result = await controller.createStripeCheckoutSession(
      { id: 'client-1' } as never,
      'milestone-1',
      {
        paymentMethodId: 'card-method-1',
        returnUrl: 'https://localhost:5173/client/workspace/project-1?view=board&milestone=milestone-1',
      },
    );

    expect(milestoneFundingService.createStripeMilestoneCheckoutSession).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'card-method-1',
      gateway: FundingGateway.STRIPE,
      returnUrl:
        'https://localhost:5173/client/workspace/project-1?view=board&milestone=milestone-1',
    });
    expect(result.success).toBe(true);
  });

  it('passes completed Stripe Checkout Sessions through to the funding service', async () => {
    milestoneFundingService.completeStripeMilestoneFunding.mockResolvedValue({
      fundingIntentId: 'intent-stripe-1',
      milestoneId: 'milestone-1',
      escrowId: 'escrow-1',
      escrowStatus: 'FUNDED',
      walletSnapshot: {},
      transactions: {
        depositTransactionId: 'tx-deposit',
        holdTransactionId: 'tx-hold',
      },
      nextAction: { type: 'STRIPE_CHECKOUT_COMPLETED' },
      gateway: FundingGateway.STRIPE,
    });

    const result = await controller.completeStripeCheckout(
      { id: 'client-1' } as never,
      'milestone-1',
      {
        paymentMethodId: 'card-method-1',
        sessionId: 'cs_test_123',
      },
    );

    expect(milestoneFundingService.completeStripeMilestoneFunding).toHaveBeenCalledWith({
      milestoneId: 'milestone-1',
      payerId: 'client-1',
      paymentMethodId: 'card-method-1',
      gateway: FundingGateway.STRIPE,
      sessionId: 'cs_test_123',
    });
    expect(result.success).toBe(true);
  });
});
