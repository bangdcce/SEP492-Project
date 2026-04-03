import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
    paymentReference: 'BANK_TRANSFER_001',
    createdAt: new Date('2026-03-29T00:00:00.000Z'),
    updatedAt: new Date('2026-03-29T00:00:00.000Z'),
    user: makeUser(),
    plan: makePlan(),
    ...overrides,
  }) as UserSubscriptionEntity;

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: ReturnType<typeof createRepoMock>;
  let planRepo: ReturnType<typeof createRepoMock>;
  let userRepo: ReturnType<typeof createRepoMock>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-29T00:00:00.000Z'));
    subscriptionRepo = createRepoMock();
    planRepo = createRepoMock();
    userRepo = createRepoMock();

    service = new SubscriptionsService(
      subscriptionRepo as any,
      planRepo as any,
      userRepo as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
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

    it('EP-265-SVC-03 logs and propagates repository failures while loading plans', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      planRepo.find.mockRejectedValue(new Error('database unavailable'));

      await expect(service.getPlansForRole(UserRole.FREELANCER)).rejects.toThrow(
        'database unavailable',
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Get Plans Failed: database unavailable',
      );
    });
  });

  describe('getMySubscription', () => {
    it('EP-266-SVC-01 returns a premium subscription snapshot for a subscribed user', async () => {
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
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      userRepo.findOne.mockResolvedValue(makeUser({ role: UserRole.CLIENT }));
      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);

      const result = await service.getMySubscription('client-1');

      expect(result).toEqual({
        isPremium: false,
        subscription: null,
        perks: FREE_TIER_PERKS[UserRole.CLIENT],
        usage: {},
      });
      expect(logSpy).toHaveBeenCalledWith(
        'Get My Subscription Successful: user="client-1" premium=false',
      );
    });

    it('EP-266-SVC-03 rejects unknown users when loading subscription status', async () => {
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

  describe('subscribe', () => {
    it('EP-267-SVC-01 creates a monthly subscription with the monthly price', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const plan = makePlan({ id: 'plan-monthly' });

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(plan);
      userRepo.findOne.mockResolvedValue(makeUser());
      subscriptionRepo.save.mockImplementation(async (value) => ({
        id: 'sub-monthly',
        ...value,
      }));

      const result = await service.subscribe('client-1', {
        planId: 'plan-monthly',
        billingCycle: BillingCycle.MONTHLY,
        paymentReference: 'BANK_TRANSFER_001',
      });

      expect(subscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'client-1',
          planId: 'plan-monthly',
          billingCycle: BillingCycle.MONTHLY,
          amountPaid: 99000,
          paymentReference: 'BANK_TRANSFER_001',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'sub-monthly',
          amountPaid: 99000,
          billingCycle: BillingCycle.MONTHLY,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Subscribe Successful: user="client-1" plan="plan-monthly" cycle="MONTHLY"',
      );
    });

    it('EP-267-SVC-02 creates a quarterly subscription with the quarterly price', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const plan = makePlan({ id: 'plan-quarterly' });

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(plan);
      userRepo.findOne.mockResolvedValue(makeUser());
      subscriptionRepo.save.mockImplementation(async (value) => ({
        id: 'sub-quarterly',
        ...value,
      }));

      const result = await service.subscribe('client-1', {
        planId: 'plan-quarterly',
        billingCycle: BillingCycle.QUARTERLY,
      });

      expect(subscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          billingCycle: BillingCycle.QUARTERLY,
          amountPaid: 252000,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'sub-quarterly',
          amountPaid: 252000,
          billingCycle: BillingCycle.QUARTERLY,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Subscribe Successful: user="client-1" plan="plan-quarterly" cycle="QUARTERLY"',
      );
    });

    it('EP-267-SVC-03 creates a yearly subscription with the yearly price', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const plan = makePlan({ id: 'plan-yearly' });

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(plan);
      userRepo.findOne.mockResolvedValue(makeUser());
      subscriptionRepo.save.mockImplementation(async (value) => ({
        id: 'sub-yearly',
        ...value,
      }));

      const result = await service.subscribe('client-1', {
        planId: 'plan-yearly',
        billingCycle: BillingCycle.YEARLY,
      });

      expect(subscriptionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          billingCycle: BillingCycle.YEARLY,
          amountPaid: 832000,
          paymentReference: null,
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: 'sub-yearly',
          amountPaid: 832000,
          billingCycle: BillingCycle.YEARLY,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Subscribe Successful: user="client-1" plan="plan-yearly" cycle="YEARLY"',
      );
    });

    it('EP-267-SVC-04 rejects new subscriptions when the user already has an active subscription', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(makeSubscription());

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-client-premium',
          billingCycle: BillingCycle.MONTHLY,
        }),
      ).rejects.toThrow(ConflictException);

      expect(planRepo.findOne).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: You already have an active subscription. Cancel it first before subscribing to a new plan.',
      );
    });

    it('EP-267-SVC-05 rejects subscriptions when the selected plan is unavailable', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(null);

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-missing',
          billingCycle: BillingCycle.MONTHLY,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: Subscription plan not found or is no longer available.',
      );
    });

    it('EP-267-SVC-06 rejects subscriptions when the user record does not exist', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(makePlan());
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-client-premium',
          billingCycle: BillingCycle.MONTHLY,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: User not found',
      );
    });

    it('EP-267-SVC-07 rejects subscriptions when the plan role does not match the user role', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      jest.spyOn(service, 'getActiveSubscription').mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(
        makePlan({ id: 'plan-broker-premium', role: UserRole.BROKER }),
      );
      userRepo.findOne.mockResolvedValue(makeUser({ role: UserRole.CLIENT }));

      await expect(
        service.subscribe('client-1', {
          planId: 'plan-broker-premium',
          billingCycle: BillingCycle.MONTHLY,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(errorSpy).toHaveBeenCalledWith(
        'Subscribe Failed: This plan is for BROKER users. Your role is CLIENT.',
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

    it('EP-268-SVC-02 cancels an active subscription without a reason and stores null', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const subscription = makeSubscription({
        id: 'sub-cancel-2',
        cancelAtPeriodEnd: false,
        cancelReason: null,
        cancelledAt: null,
      });

      subscriptionRepo.findOne.mockResolvedValue(subscription);
      subscriptionRepo.save.mockImplementation(async (value) => value);

      const result = await service.cancel('client-1', {});

      expect(result).toEqual(
        expect.objectContaining({
          id: 'sub-cancel-2',
          status: SubscriptionStatus.CANCELLED,
          cancelAtPeriodEnd: true,
          cancelReason: null,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Cancel Subscription Successful: user="client-1" subscription="sub-cancel-2"',
      );
    });

    it('EP-268-SVC-03 rejects cancellation when the user has no active subscription', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancel('client-1', {})).rejects.toThrow(NotFoundException);
      expect(errorSpy).toHaveBeenCalledWith(
        'Cancel Subscription Failed: No active subscription found. You are currently on the free plan.',
      );
    });

    it('EP-268-SVC-04 rejects cancellation when the subscription is already scheduled to end', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const subscription = makeSubscription({
        id: 'sub-cancel-3',
        cancelAtPeriodEnd: true,
      });

      subscriptionRepo.findOne.mockResolvedValue(subscription);

      await expect(service.cancel('client-1', {})).rejects.toThrow(ConflictException);
      expect(errorSpy).toHaveBeenCalledWith(
        'Cancel Subscription Failed: Your subscription is already scheduled for cancellation at the end of the current billing period.',
      );
    });
  });
});
