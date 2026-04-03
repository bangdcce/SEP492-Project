import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { BillingCycle, SubscriptionStatus } from '../../database/entities/user-subscription.entity';
import { UserRole } from '../../database/entities/user.entity';
import { SubscriptionsController } from './subscriptions.controller';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let subscriptionsService: {
    getPlansForRole: jest.Mock;
    getMySubscription: jest.Mock;
    subscribe: jest.Mock;
    cancel: jest.Mock;
  };
  let quotaService: {
    getUsageSummary: jest.Mock;
  };

  beforeEach(() => {
    subscriptionsService = {
      getPlansForRole: jest.fn(),
      getMySubscription: jest.fn(),
      subscribe: jest.fn(),
      cancel: jest.fn(),
    };
    quotaService = {
      getUsageSummary: jest.fn(),
    };

    controller = new SubscriptionsController(
      subscriptionsService as any,
      quotaService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('EP-265-CTRL-01 wraps active plans into the endpoint response with numeric prices', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const req = { user: { id: 'client-1', role: UserRole.CLIENT } };
    const plans = [
      {
        id: 'plan-1',
        name: 'CLIENT_PREMIUM',
        displayName: 'Premium Client',
        description: 'Premium features',
        role: UserRole.CLIENT,
        priceMonthly: '99000',
        priceQuarterly: '252000',
        priceYearly: '832000',
        perks: { maxActiveRequests: -1 },
      },
    ];

    subscriptionsService.getPlansForRole.mockResolvedValue(plans);

    const result = await controller.getPlans(req);

    expect(subscriptionsService.getPlansForRole).toHaveBeenCalledWith(UserRole.CLIENT);
    expect(result).toEqual({
      success: true,
      data: [
        {
          ...plans[0],
          priceMonthly: 99000,
          priceQuarterly: 252000,
          priceYearly: 832000,
        },
      ],
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Get Plans Endpoint Successful: user="client-1" role="CLIENT" count=1',
    );
  });

  it('EP-265-CTRL-02 returns an empty data list when no plans are available', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const req = { user: { id: 'broker-1', role: UserRole.BROKER } };

    subscriptionsService.getPlansForRole.mockResolvedValue([]);

    const result = await controller.getPlans(req);

    expect(result).toEqual({ success: true, data: [] });
    expect(logSpy).toHaveBeenCalledWith(
      'Get Plans Endpoint Successful: user="broker-1" role="BROKER" count=0',
    );
  });

  it('EP-265-CTRL-03 logs and propagates plan-loading failures', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const req = { user: { id: 'freelancer-1', role: UserRole.FREELANCER } };

    subscriptionsService.getPlansForRole.mockRejectedValue(new Error('plan store offline'));

    await expect(controller.getPlans(req)).rejects.toThrow('plan store offline');
    expect(errorSpy).toHaveBeenCalledWith(
      'Get Plans Endpoint Failed: plan store offline',
    );
  });

  it('EP-266-CTRL-01 merges subscription data with quota usage into the endpoint response', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const req = { user: { id: 'client-1', role: UserRole.CLIENT } };
    const subscriptionData = {
      isPremium: true,
      subscription: {
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        currentPeriodStart: new Date('2026-03-29T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-04-28T00:00:00.000Z'),
        cancelAtPeriodEnd: false,
        amountPaid: 99000,
        plan: {
          id: 'plan-1',
          name: 'CLIENT_PREMIUM',
        },
      },
      perks: { maxActiveRequests: -1 },
      usage: {},
    };
    const usage = {
      CREATE_REQUEST: { used: 0, limit: 'Unlimited' },
    };

    subscriptionsService.getMySubscription.mockResolvedValue(subscriptionData);
    quotaService.getUsageSummary.mockResolvedValue(usage);

    const result = await controller.getMySubscription(req);

    expect(subscriptionsService.getMySubscription).toHaveBeenCalledWith('client-1');
    expect(quotaService.getUsageSummary).toHaveBeenCalledWith('client-1', UserRole.CLIENT);
    expect(result).toEqual({
      success: true,
      data: {
        ...subscriptionData,
        usage,
      },
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Get My Subscription Endpoint Successful: user="client-1" premium=true',
    );
  });

  it('EP-266-CTRL-02 logs and propagates subscription lookup failures', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const req = { user: { id: 'missing-user', role: UserRole.CLIENT } };

    subscriptionsService.getMySubscription.mockRejectedValue(
      new NotFoundException('User not found'),
    );

    await expect(controller.getMySubscription(req)).rejects.toThrow(NotFoundException);
    expect(errorSpy).toHaveBeenCalledWith(
      'Get My Subscription Endpoint Failed: User not found',
    );
  });

  it('EP-266-CTRL-03 logs and propagates quota summary failures', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const req = { user: { id: 'client-1', role: UserRole.CLIENT } };

    subscriptionsService.getMySubscription.mockResolvedValue({
      isPremium: false,
      subscription: null,
      perks: { maxActiveRequests: 2 },
      usage: {},
    });
    quotaService.getUsageSummary.mockRejectedValue(new Error('quota summary unavailable'));

    await expect(controller.getMySubscription(req)).rejects.toThrow(
      'quota summary unavailable',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Get My Subscription Endpoint Failed: quota summary unavailable',
    );
  });

  it('EP-267-CTRL-01 wraps a created subscription into the subscribe endpoint response', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const req = { user: { id: 'client-1' } };
    const dto = {
      planId: 'plan-1',
      billingCycle: BillingCycle.MONTHLY,
      paymentReference: 'BANK_TRANSFER_001',
    };
    const subscription = {
      id: 'sub-1',
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: new Date('2026-03-29T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-04-28T00:00:00.000Z'),
      amountPaid: '99000',
    };

    subscriptionsService.subscribe.mockResolvedValue(subscription);

    const result = await controller.subscribe(req, dto as any);

    expect(subscriptionsService.subscribe).toHaveBeenCalledWith('client-1', dto);
    expect(result).toEqual({
      success: true,
      message: 'Successfully subscribed to Premium! Enjoy your new perks.',
      data: {
        ...subscription,
        amountPaid: 99000,
      },
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Subscribe Endpoint Successful: user="client-1" subscription="sub-1"',
    );
  });

  it('EP-267-CTRL-02 logs and propagates subscribe failures', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const req = { user: { id: 'client-1' } };
    const dto = {
      planId: 'plan-1',
      billingCycle: BillingCycle.MONTHLY,
    };

    subscriptionsService.subscribe.mockRejectedValue(
      new ConflictException('Already subscribed'),
    );

    await expect(controller.subscribe(req, dto as any)).rejects.toThrow(ConflictException);
    expect(errorSpy).toHaveBeenCalledWith(
      'Subscribe Endpoint Failed: Already subscribed',
    );
  });

  it('EP-268-CTRL-01 wraps a cancelled subscription into the cancel endpoint response', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const req = { user: { id: 'client-1' } };
    const dto = { reason: 'Budget changed' };
    const subscription = {
      id: 'sub-1',
      status: SubscriptionStatus.CANCELLED,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-04-28T00:00:00.000Z'),
      cancelledAt: new Date('2026-03-29T00:00:00.000Z'),
    };

    subscriptionsService.cancel.mockResolvedValue(subscription);

    const result = await controller.cancel(req, dto as any);

    expect(subscriptionsService.cancel).toHaveBeenCalledWith('client-1', dto);
    expect(result).toEqual({
      success: true,
      message: 'Subscription cancelled. Your premium perks will remain active until 2026-04-28.',
      data: subscription,
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Cancel Subscription Endpoint Successful: user="client-1" subscription="sub-1"',
    );
  });

  it('EP-268-CTRL-02 logs and propagates cancel failures', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const req = { user: { id: 'client-1' } };

    subscriptionsService.cancel.mockRejectedValue(
      new NotFoundException('No active subscription found. You are currently on the free plan.'),
    );

    await expect(controller.cancel(req, {} as any)).rejects.toThrow(NotFoundException);
    expect(errorSpy).toHaveBeenCalledWith(
      'Cancel Subscription Endpoint Failed: No active subscription found. You are currently on the free plan.',
    );
  });
});
