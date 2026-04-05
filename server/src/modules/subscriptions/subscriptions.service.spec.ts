import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodType } from '../../database/entities/payment-method.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import {
  BillingCycle,
  SubscriptionStatus,
  UserSubscriptionEntity,
} from '../../database/entities/user-subscription.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { SubscriptionsService, FREE_TIER_PERKS } from './subscriptions.service';

const createRepoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn(),
});

const makePlan = (
  overrides: Partial<SubscriptionPlanEntity> = {},
): SubscriptionPlanEntity =>
  ({
    id: 'plan-client-premium',
    name: 'CLIENT_PREMIUM',
    displayName: 'Premium Client',
    description: 'Premium features for clients',
    role: UserRole.CLIENT,
    priceMonthly: 99000,
    priceQuarterly: 252000,
    priceYearly: 832000,
    perks: {
      maxActiveRequests: -1,
      aiMatchesPerDay: -1,
      invitesPerRequest: -1,
    },
    isActive: true,
    displayOrder: 1,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    subscriptions: [],
    ...overrides,
  }) as SubscriptionPlanEntity;

const makeUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
  ({
    id: 'client-1',
    email: 'client@example.com',
    role: UserRole.CLIENT,
    fullName: 'Client One',
    ...overrides,
  }) as UserEntity;

const makePaymentMethod = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'pm-paypal-1',
    userId: 'client-1',
    type: PaymentMethodType.PAYPAL_ACCOUNT,
    displayName: 'PayPal',
    paypalEmail: 'client@example.com',
    isDefault: true,
    isVerified: false,
    verifiedAt: null,
    metadata: null,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    ...overrides,
  });

const makeSubscription = (
  overrides: Partial<UserSubscriptionEntity> = {},
): UserSubscriptionEntity =>
  ({
    id: 'sub-1',
    userId: 'client-1',
    planId: 'plan-client-premium',
    status: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    currentPeriodStart: new Date('2026-03-29T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-04-28T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    cancelReason: null,
    cancelledAt: null,
    amountPaid: 99000,
    paymentReference: 'CAPTURE-123',
    paymentProvider: 'PAYPAL',
    paymentCurrency: 'USD',
    paymentCapturedAmount: 3.96,
    createdAt: new Date('2026-03-29T00:00:00.000Z'),
    updatedAt: new Date('2026-03-29T00:00:00.000Z'),
    user: makeUser(),
    plan: makePlan(),
    ...overrides,
  }) as UserSubscriptionEntity;

const makeCapturedOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'ORDER-123',
  status: 'COMPLETED',
  payer: {
    email_address: 'payer@example.com',
    payer_id: 'payer-123',
  },
  payment_source: {
    paypal: {
      attributes: {
        vault: {
          id: 'vault-123',
          status: 'VAULTED',
          customer: {
            id: 'customer-123',
          },
        },
      },
    },
  },
  purchase_units: [
    {
      custom_id: 'plan-client-premium',
      payments: {
        captures: [
          {
            id: 'CAPTURE-123',
            status: 'COMPLETED',
            amount: {
              currency_code: 'USD',
              value: '3.96',
            },
          },
        ],
      },
    },
  ],
  ...overrides,
});

describe('SubscriptionsService', () => {
  const originalCurrency = process.env.PAYPAL_SUBSCRIPTION_CURRENCY;
  const originalRate = process.env.PAYPAL_SUBSCRIPTION_VND_RATE;

  let service: SubscriptionsService;
  let subscriptionRepo: ReturnType<typeof createRepoMock>;
  let planRepo: ReturnType<typeof createRepoMock>;
  let userRepo: ReturnType<typeof createRepoMock>;
  let paymentMethodRepo: ReturnType<typeof createRepoMock>;
  let payPalCheckoutService: {
    getSdkConfigForUser: jest.Mock;
    createSubscriptionOrder: jest.Mock;
    captureOrder: jest.Mock;
  };
  let transactionSubscriptionRepo: ReturnType<typeof createRepoMock>;
  let transactionPaymentMethodRepo: ReturnType<typeof createRepoMock>;
  let dataSource: {
    transaction: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T00:00:00.000Z'));
    process.env.PAYPAL_SUBSCRIPTION_CURRENCY = 'USD';
    process.env.PAYPAL_SUBSCRIPTION_VND_RATE = '25000';

    subscriptionRepo = createRepoMock();
    planRepo = createRepoMock();
    userRepo = createRepoMock();
    paymentMethodRepo = createRepoMock();
    transactionSubscriptionRepo = createRepoMock();
    transactionPaymentMethodRepo = createRepoMock();

    payPalCheckoutService = {
      getSdkConfigForUser: jest.fn(),
      createSubscriptionOrder: jest.fn(),
      captureOrder: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (callback: (manager: { getRepository: (entity: unknown) => unknown }) => unknown) =>
        callback({
          getRepository: (entity: unknown) => {
            if ((entity as { name?: string })?.name === 'UserSubscriptionEntity') {
              return transactionSubscriptionRepo;
            }
            return transactionPaymentMethodRepo;
          },
        })),
    };

    service = new SubscriptionsService(
      subscriptionRepo as any,
      planRepo as any,
      userRepo as any,
      paymentMethodRepo as any,
      payPalCheckoutService as any,
      dataSource as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();

    if (originalCurrency === undefined) {
      delete process.env.PAYPAL_SUBSCRIPTION_CURRENCY;
    } else {
      process.env.PAYPAL_SUBSCRIPTION_CURRENCY = originalCurrency;
    }

    if (originalRate === undefined) {
      delete process.env.PAYPAL_SUBSCRIPTION_VND_RATE;
    } else {
      process.env.PAYPAL_SUBSCRIPTION_VND_RATE = originalRate;
    }
  });

  describe('getPlansForRole', () => {
    it('EP-265-SVC-01 returns active plans for the requested role in display order', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const plans = [
        makePlan({ id: 'plan-basic', displayOrder: 1 }),
        makePlan({ id: 'plan-pro', displayOrder: 2, name: 'CLIENT_PRO' }),
      ];

      planRepo.find.mockResolvedValue(plans);

      const result = await service.getPlansForRole(UserRole.CLIENT);

      expect(planRepo.find).toHaveBeenCalledWith({
        where: {
          role: UserRole.CLIENT,
          isActive: true,
        },
        order: {
          displayOrder: 'ASC',
        },
      });
      expect(result).toEqual(plans);
      expect(logSpy).toHaveBeenCalledWith(
        'Get Plans Successful: role="CLIENT" count=2',
      );
    });

    it('EP-265-SVC-02 returns an empty list when no active plans exist for the role', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      planRepo.find.mockResolvedValue([]);

      const result = await service.getPlansForRole(UserRole.BROKER);

      expect(result).toEqual([]);
      expect(logSpy).toHaveBeenCalledWith(
        'Get Plans Successful: role="BROKER" count=0',
      );
    });

    it('EP-265-SVC-03 logs and propagates plan-loading failures', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      planRepo.find.mockRejectedValue(new Error('Plan repository unavailable'));

      await expect(service.getPlansForRole(UserRole.CLIENT)).rejects.toThrow(
        'Plan repository unavailable',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Get Plans Failed: Plan repository unavailable',
      );
    });
  });

  describe('getMySubscription', () => {
    it('EP-266-SVC-01 returns a premium subscription snapshot with payment summary', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const subscription = makeSubscription();

      userRepo.findOne.mockResolvedValue(makeUser());
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(subscription);

      const result = await service.getMySubscription('client-1');

      expect(result).toEqual({
        isPremium: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          amountPaid: subscription.amountPaid,
          payment: {
            provider: 'PAYPAL',
            reference: 'CAPTURE-123',
            capturedAmount: 3.96,
            currency: 'USD',
            displayAmountVnd: 99000,
            exchangeRateApplied: 25000,
          },
          plan: {
            id: subscription.plan.id,
            name: subscription.plan.name,
            displayName: subscription.plan.displayName,
            description: subscription.plan.description,
            role: subscription.plan.role,
            priceMonthly: subscription.plan.priceMonthly,
            priceQuarterly: subscription.plan.priceQuarterly,
            priceYearly: subscription.plan.priceYearly,
            perks: subscription.plan.perks,
          },
        },
        perks: subscription.plan.perks,
        usage: {},
      });
      expect(logSpy).toHaveBeenCalledWith(
        'Get My Subscription Successful: user="client-1" premium=true',
      );
    });

    it('EP-266-SVC-02 returns free-tier perks when the user has no active subscription', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ role: UserRole.CLIENT }));
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);

      const result = await service.getMySubscription('client-1');

      expect(result).toEqual({
        isPremium: false,
        subscription: null,
        perks: FREE_TIER_PERKS[UserRole.CLIENT],
        usage: {},
      });
    });

    it('EP-266-SVC-03 rejects subscription lookup when the user does not exist', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getMySubscription('missing-user')).rejects.toThrow(
        NotFoundException,
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Get My Subscription Failed: User not found',
      );
    });
  });

  describe('PayPal checkout helpers', () => {
    it('EP-267-SVC-01 returns PayPal SDK config plus a converted subscription quote', async () => {
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(makePlan());
      userRepo.findOne.mockResolvedValue(makeUser());
      paymentMethodRepo.findOne.mockResolvedValue(makePaymentMethod());
      payPalCheckoutService.getSdkConfigForUser.mockResolvedValue({
        clientId: 'client-id',
        environment: 'sandbox',
        vaultEnabled: true,
        userIdToken: 'token',
      });

      const result = await service.getPayPalCheckoutConfig('client-1', {
        planId: 'plan-client-premium',
        billingCycle: BillingCycle.MONTHLY,
        paymentMethodId: 'pm-paypal-1',
      });

      expect(payPalCheckoutService.getSdkConfigForUser).toHaveBeenCalledWith(
        'client-1',
        'pm-paypal-1',
      );
      expect(result).toEqual({
        clientId: 'client-id',
        environment: 'sandbox',
        vaultEnabled: true,
        userIdToken: 'token',
        chargeAmount: 3.96,
        chargeCurrency: 'USD',
        displayAmountVnd: 99000,
        exchangeRateApplied: 25000,
      });
    });

    it('EP-267-SVC-02 creates a PayPal subscription order with converted charge metadata', async () => {
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(makePlan());
      userRepo.findOne.mockResolvedValue(makeUser());
      paymentMethodRepo.findOne.mockResolvedValue(makePaymentMethod());
      payPalCheckoutService.createSubscriptionOrder.mockResolvedValue({
        orderId: 'ORDER-123',
        status: 'CREATED',
        vaultRequested: true,
        chargeAmount: 3.96,
        chargeCurrency: 'USD',
        displayAmountVnd: 99000,
        exchangeRateApplied: 25000,
      });

      const result = await service.createPayPalSubscriptionOrder('client-1', {
        planId: 'plan-client-premium',
        billingCycle: BillingCycle.MONTHLY,
        paymentMethodId: 'pm-paypal-1',
        source: 'paypal',
        returnUrl: 'https://localhost:5173/client/subscription',
        cancelUrl: 'https://localhost:5173/client/subscription',
      });

      expect(payPalCheckoutService.createSubscriptionOrder).toHaveBeenCalledWith({
        planId: 'plan-client-premium',
        payerId: 'client-1',
        paymentMethodId: 'pm-paypal-1',
        planDisplayName: 'Premium Client',
        billingCycle: BillingCycle.MONTHLY,
        amount: 3.96,
        currency: 'USD',
        exchangeRateApplied: 25000,
        displayAmountVnd: 99000,
        source: 'paypal',
        returnUrl: 'https://localhost:5173/client/subscription',
        cancelUrl: 'https://localhost:5173/client/subscription',
      });
      expect(result.orderId).toBe('ORDER-123');
    });
  });

  describe('subscribe', () => {
    it('EP-267-SVC-03 captures the PayPal order and activates the subscription', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const plan = makePlan();
      const paymentMethod = makePaymentMethod();
      const hydratedSubscription = makeSubscription();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(plan);
      userRepo.findOne.mockResolvedValue(makeUser());
      paymentMethodRepo.findOne.mockResolvedValue(paymentMethod);
      payPalCheckoutService.captureOrder.mockResolvedValue(makeCapturedOrder());

      transactionSubscriptionRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(hydratedSubscription);
      transactionSubscriptionRepo.create.mockImplementation((value) => value);
      transactionSubscriptionRepo.save.mockImplementation(async (value) => ({
        id: 'sub-1',
        ...value,
      }));
      transactionPaymentMethodRepo.findOne.mockResolvedValue({ ...paymentMethod });
      transactionPaymentMethodRepo.save.mockImplementation(async (value) => value);

      const result = await service.subscribe('client-1', {
        planId: 'plan-client-premium',
        billingCycle: BillingCycle.MONTHLY,
        paymentMethodId: 'pm-paypal-1',
        orderId: 'ORDER-123',
      });

      expect(payPalCheckoutService.captureOrder).toHaveBeenCalledWith('ORDER-123');
      expect(transactionSubscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'client-1',
          planId: 'plan-client-premium',
          billingCycle: BillingCycle.MONTHLY,
          amountPaid: 99000,
          paymentProvider: 'PAYPAL',
        }),
      );
      expect(transactionPaymentMethodRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: true,
          paypalEmail: 'payer@example.com',
          metadata: expect.objectContaining({
            paypalVault: expect.objectContaining({
              customerId: 'customer-123',
              vaultId: 'vault-123',
              payerId: 'payer-123',
              payerEmail: 'payer@example.com',
              lastOrderId: 'ORDER-123',
              lastCaptureId: 'CAPTURE-123',
            }),
          }),
        }),
      );
      expect(transactionSubscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'client-1',
          planId: 'plan-client-premium',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          amountPaid: 99000,
          paymentReference: 'CAPTURE-123',
          paymentProvider: 'PAYPAL',
          paymentCurrency: 'USD',
          paymentCapturedAmount: 3.96,
          currentPeriodStart: new Date('2026-03-29T00:00:00.000Z'),
          currentPeriodEnd: new Date('2026-04-28T00:00:00.000Z'),
        }),
      );
      expect(result).toEqual(hydratedSubscription);
      expect(logSpy).toHaveBeenCalledWith(
        'Subscribe Successful: user="client-1" plan="plan-client-premium" cycle="MONTHLY"',
      );
    });

    it('EP-267-SVC-04 rejects the activation when the captured amount does not match the expected charge', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(makePlan());
      userRepo.findOne.mockResolvedValue(makeUser());
      paymentMethodRepo.findOne.mockResolvedValue(makePaymentMethod());
      payPalCheckoutService.captureOrder.mockResolvedValue(
        makeCapturedOrder({
          purchase_units: [
            {
              custom_id: 'plan-client-premium',
              payments: {
                captures: [
                  {
                    id: 'CAPTURE-123',
                    status: 'COMPLETED',
                    amount: {
                      currency_code: 'USD',
                      value: '4.20',
                    },
                  },
                ],
              },
            },
          ],
        }),
      );

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-client-premium',
          billingCycle: BillingCycle.MONTHLY,
          paymentMethodId: 'pm-paypal-1',
          orderId: 'ORDER-123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: Captured PayPal amount does not match the expected subscription charge.',
      );
    });

    it('EP-267-SVC-05 rejects plans that do not match the user role', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(
        makePlan({ id: 'plan-broker-premium', role: UserRole.BROKER }),
      );
      userRepo.findOne.mockResolvedValue(makeUser({ role: UserRole.CLIENT }));
      paymentMethodRepo.findOne.mockResolvedValue(makePaymentMethod());

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-broker-premium',
          billingCycle: BillingCycle.MONTHLY,
          paymentMethodId: 'pm-paypal-1',
          orderId: 'ORDER-123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: This plan is for BROKER users. Your role is CLIENT.',
      );
    });

    it('EP-267-SVC-06 rejects subscription checkout when the user already has an active plan', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(makeSubscription());

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-client-premium',
          billingCycle: BillingCycle.MONTHLY,
          paymentMethodId: 'pm-paypal-1',
          orderId: 'ORDER-123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(payPalCheckoutService.captureOrder).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: You already have an active subscription. Cancel it first before subscribing to a new plan.',
      );
    });

    it('EP-267-SVC-07 rejects subscription checkout when the selected plan no longer exists', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(null);

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-missing',
          billingCycle: BillingCycle.MONTHLY,
          paymentMethodId: 'pm-paypal-1',
          orderId: 'ORDER-123',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(payPalCheckoutService.captureOrder).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: Subscription plan not found or is no longer available.',
      );
    });

    it('EP-267-SVC-08 rejects subscription checkout when the payment method cannot be found', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(makePlan());
      userRepo.findOne.mockResolvedValue(makeUser());
      paymentMethodRepo.findOne.mockResolvedValue(null);

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-client-premium',
          billingCycle: BillingCycle.MONTHLY,
          paymentMethodId: 'pm-missing',
          orderId: 'ORDER-123',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(payPalCheckoutService.captureOrder).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: Payment method pm-missing not found',
      );
    });
  });

  describe('cancel', () => {
    it('EP-268-SVC-01 cancels an active subscription and stores the provided reason', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const subscription = makeSubscription({
        id: 'sub-cancel-1',
        cancelAtPeriodEnd: false,
        cancelReason: null,
        cancelledAt: null,
      });

      subscriptionRepo.findOne.mockResolvedValue(subscription);
      subscriptionRepo.save.mockImplementation(async (value) => value);

      const result = await service.cancel('client-1', {
        reason: 'Budget changed',
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'sub-cancel-1',
          status: SubscriptionStatus.CANCELLED,
          cancelAtPeriodEnd: true,
          cancelReason: 'Budget changed',
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Cancel Subscription Successful: user="client-1" subscription="sub-cancel-1"',
      );
    });

    it('EP-268-SVC-02 rejects cancellation when the user has no active subscription', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancel('client-1', {})).rejects.toThrow(NotFoundException);
      expect(errorSpy).toHaveBeenCalledWith(
        'Cancel Subscription Failed: No active subscription found. You are currently on the free plan.',
      );
    });

    it('EP-268-SVC-03 rejects cancellation when the subscription is already scheduled to end', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      subscriptionRepo.findOne.mockResolvedValue(
        makeSubscription({
          id: 'sub-cancel-2',
          cancelAtPeriodEnd: true,
          status: SubscriptionStatus.ACTIVE,
        }),
      );

      await expect(service.cancel('client-1', { reason: 'duplicate request' })).rejects.toThrow(
        ConflictException,
      );
      expect(subscriptionRepo.save).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Cancel Subscription Failed: Your subscription is already scheduled for cancellation at the end of the current billing period.',
      );
    });
  });
});
