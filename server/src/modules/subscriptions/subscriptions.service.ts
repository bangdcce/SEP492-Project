import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  PaymentMethodEntity,
  PaymentMethodType,
} from '../../database/entities/payment-method.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import {
  BillingCycle,
  SubscriptionStatus,
  UserSubscriptionEntity,
} from '../../database/entities/user-subscription.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  PayPalSubscriptionCheckoutConfigView,
  PayPalSubscriptionOrderView,
} from '../payments/payments.types';
import { PayPalCheckoutService } from '../payments/pay-pal-checkout.service';
import {
  CancelSubscriptionDto,
  CreatePayPalSubscriptionOrderDto,
  SubscribeDto,
  SubscriptionPayPalConfigQueryDto,
} from './dto/subscription.dto';

/**
 * Free-tier perks by role.
 *
 * These define the default limits for users without a premium subscription.
 * Premium users get the perks defined in their SubscriptionPlanEntity.
 */
export const FREE_TIER_PERKS: Record<string, Record<string, number | boolean>> = {
  [UserRole.CLIENT]: {
    maxActiveRequests: 2,
    maxActiveProjects: 1,
    aiMatchesPerDay: 1,
    aiCandidatesShown: 3,
    invitesPerRequest: 3,
    featuredProfile: false,
  },
  [UserRole.BROKER]: {
    appliesPerWeek: 3,
    maxActiveProposals: 3,
    commissionRate: 15,
    viewClientBudget: false,
    featuredProfile: false,
  },
  [UserRole.FREELANCER]: {
    appliesPerWeek: 5,
    portfolioSlots: 3,
    cvHighlighted: false,
    featuredProfile: false,
  },
};

const CYCLE_DURATION_DAYS: Record<BillingCycle, number> = {
  [BillingCycle.MONTHLY]: 30,
  [BillingCycle.QUARTERLY]: 90,
  [BillingCycle.YEARLY]: 365,
};

interface SubscriptionChargeSummary {
  planAmountVnd: number;
  chargeAmount: number;
  chargeCurrency: string;
  exchangeRateApplied: number;
}

interface PreparedSubscriptionCheckoutContext {
  user: UserEntity;
  plan: SubscriptionPlanEntity;
  paymentMethod: PaymentMethodEntity;
  chargeSummary: SubscriptionChargeSummary;
}

interface CompletedSubscriptionOrderDetails {
  orderId: string;
  captureId: string;
  amount: number;
  currency: string;
  payerEmail: string | null;
  payerId: string | null;
  vaultId: string | null;
  vaultStatus: string | null;
  customerId: string | null;
}

/**
 * Service managing subscription lifecycle and premium status.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  private readonly payPalSubscriptionCurrency =
    process.env.PAYPAL_SUBSCRIPTION_CURRENCY?.trim().toUpperCase() || 'USD';

  private readonly payPalSubscriptionVndRate = Number.parseFloat(
    process.env.PAYPAL_SUBSCRIPTION_VND_RATE?.trim() || '25000',
  );

  constructor(
    @InjectRepository(UserSubscriptionEntity)
    private readonly subscriptionRepo: Repository<UserSubscriptionEntity>,
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepo: Repository<SubscriptionPlanEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PaymentMethodEntity)
    private readonly paymentMethodRepo: Repository<PaymentMethodEntity>,
    private readonly payPalCheckoutService: PayPalCheckoutService,
    private readonly dataSource: DataSource,
  ) {}

  async isPremium(userId: string): Promise<boolean> {
    const now = new Date();

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: MoreThanOrEqual(now),
      },
    });

    if (subscription) return true;

    const cancelledButActive = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.CANCELLED,
        currentPeriodEnd: MoreThanOrEqual(now),
      },
    });

    return !!cancelledButActive;
  }

  async getPerks(userId: string): Promise<Record<string, number | boolean>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.getActiveSubscription(userId);
    if (subscription && subscription.plan) {
      return subscription.plan.perks;
    }

    return FREE_TIER_PERKS[user.role] || {};
  }

  async getActiveSubscription(userId: string): Promise<UserSubscriptionEntity | null> {
    return this.getActiveSubscriptionWithRepo(this.subscriptionRepo, userId);
  }

  async getMySubscription(userId: string) {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const subscription = await this.getActiveSubscription(userId);
      const isPremium = !!subscription;
      const perks =
        isPremium && subscription.plan
          ? subscription.plan.perks
          : FREE_TIER_PERKS[user.role] || {};

      const result = {
        isPremium,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              billingCycle: subscription.billingCycle,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              amountPaid: Number(subscription.amountPaid),
              payment: this.buildPaymentSummary(subscription),
              plan: subscription.plan
                ? {
                    id: subscription.plan.id,
                    name: subscription.plan.name,
                    displayName: subscription.plan.displayName,
                    description: subscription.plan.description,
                    role: subscription.plan.role,
                    priceMonthly: Number(subscription.plan.priceMonthly),
                    priceQuarterly: Number(subscription.plan.priceQuarterly),
                    priceYearly: Number(subscription.plan.priceYearly),
                    perks: subscription.plan.perks,
                  }
                : null,
            }
          : null,
        perks,
        usage: {},
      };

      this.logger.log(
        `Get My Subscription Successful: user="${userId}" premium=${isPremium}`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Get My Subscription Failed: ${message}`);
      throw error;
    }
  }

  async getPlansForRole(role: UserRole): Promise<SubscriptionPlanEntity[]> {
    try {
      const plans = await this.planRepo.find({
        where: {
          role,
          isActive: true,
        },
        order: {
          displayOrder: 'ASC',
        },
      });

      this.logger.log(`Get Plans Successful: role="${role}" count=${plans.length}`);
      return plans;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Get Plans Failed: ${message}`);
      throw error;
    }
  }

  async getPayPalCheckoutConfig(
    userId: string,
    dto: SubscriptionPayPalConfigQueryDto,
  ): Promise<PayPalSubscriptionCheckoutConfigView> {
    const context = await this.prepareSubscriptionCheckout(userId, dto);
    const config = await this.payPalCheckoutService.getSdkConfigForUser(
      userId,
      dto.paymentMethodId,
    );

    return {
      ...config,
      chargeAmount: context.chargeSummary.chargeAmount,
      chargeCurrency: context.chargeSummary.chargeCurrency,
      displayAmountVnd: context.chargeSummary.planAmountVnd,
      exchangeRateApplied: context.chargeSummary.exchangeRateApplied,
    };
  }

  async createPayPalSubscriptionOrder(
    userId: string,
    dto: CreatePayPalSubscriptionOrderDto,
  ): Promise<PayPalSubscriptionOrderView> {
    const context = await this.prepareSubscriptionCheckout(userId, dto);

    return this.payPalCheckoutService.createSubscriptionOrder({
      planId: context.plan.id,
      payerId: userId,
      paymentMethodId: context.paymentMethod.id,
      planDisplayName: context.plan.displayName,
      billingCycle: dto.billingCycle,
      amount: context.chargeSummary.chargeAmount,
      currency: context.chargeSummary.chargeCurrency,
      exchangeRateApplied: context.chargeSummary.exchangeRateApplied,
      displayAmountVnd: context.chargeSummary.planAmountVnd,
      source: dto.source,
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  async subscribe(
    userId: string,
    dto: SubscribeDto,
  ): Promise<UserSubscriptionEntity> {
    try {
      const context = await this.prepareSubscriptionCheckout(userId, dto);
      const capturedOrder = await this.payPalCheckoutService.captureOrder(dto.orderId);
      const orderDetails = this.extractCompletedSubscriptionOrder(
        capturedOrder,
        context.plan.id,
      );

      this.assertSubscriptionPayPalOrderMatchesCharge(
        orderDetails,
        context.chargeSummary,
      );

      return this.dataSource.transaction(async (manager) => {
        const subscriptionRepository = manager.getRepository(UserSubscriptionEntity);
        const paymentMethodRepository = manager.getRepository(PaymentMethodEntity);

        const activeSubscription = await this.getActiveSubscriptionWithRepo(
          subscriptionRepository,
          userId,
        );
        if (activeSubscription) {
          throw new ConflictException(
            'You already have an active subscription. Cancel it first before subscribing to a new plan.',
          );
        }

        const paymentMethod = await paymentMethodRepository.findOne({
          where: {
            id: context.paymentMethod.id,
            userId,
          },
        });
        if (!paymentMethod) {
          throw new NotFoundException(
            `Payment method ${context.paymentMethod.id} not found`,
          );
        }
        if (paymentMethod.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
          throw new BadRequestException(
            'Only PAYPAL_ACCOUNT methods can activate a PayPal subscription',
          );
        }

        this.applyPayPalCaptureDetails(paymentMethod, orderDetails);
        await paymentMethodRepository.save(paymentMethod);

        const now = new Date();
        const subscriptionPeriodEnd = this.calculatePeriodEnd(now, dto.billingCycle);

        const existingRecord = await subscriptionRepository.findOne({
          where: { userId },
        });
        const subscription =
          existingRecord ?? subscriptionRepository.create({ userId });

        subscription.userId = userId;
        subscription.planId = context.plan.id;
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.billingCycle = dto.billingCycle;
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = subscriptionPeriodEnd;
        subscription.cancelAtPeriodEnd = false;
        subscription.cancelReason = null;
        subscription.cancelledAt = null;
        subscription.amountPaid = context.chargeSummary.planAmountVnd;
        subscription.paymentReference = orderDetails.captureId;
        subscription.paymentProvider = 'PAYPAL';
        subscription.paymentCurrency = orderDetails.currency;
        subscription.paymentCapturedAmount = orderDetails.amount;

        const saved = await subscriptionRepository.save(subscription);
        const hydrated = await subscriptionRepository.findOne({
          where: { id: saved.id },
          relations: ['plan'],
        });

        this.logger.log(
          `Subscribe Successful: user="${userId}" plan="${context.plan.id}" cycle="${dto.billingCycle}"`,
        );

        return hydrated ?? saved;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Subscribe Failed: ${message}`);
      throw error;
    }
  }

  async cancel(
    userId: string,
    dto: CancelSubscriptionDto,
  ): Promise<UserSubscriptionEntity> {
    try {
      const subscription = await this.subscriptionRepo.findOne({
        where: {
          userId,
          status: SubscriptionStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      if (!subscription) {
        throw new NotFoundException(
          'No active subscription found. You are currently on the free plan.',
        );
      }

      if (subscription.cancelAtPeriodEnd) {
        throw new ConflictException(
          'Your subscription is already scheduled for cancellation at the end of the current billing period.',
        );
      }

      subscription.cancelAtPeriodEnd = true;
      subscription.cancelReason = dto.reason || null;
      subscription.cancelledAt = new Date();
      subscription.status = SubscriptionStatus.CANCELLED;

      const updated = await this.subscriptionRepo.save(subscription);

      this.logger.log(
        `Cancel Subscription Successful: user="${userId}" subscription="${subscription.id}"`,
      );

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cancel Subscription Failed: ${message}`);
      throw error;
    }
  }

  async expireOverdueSubscriptions(): Promise<number> {
    const now = new Date();

    const overdueSubscriptions = await this.subscriptionRepo.find({
      where: [
        {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: LessThanOrEqual(now),
        },
        {
          status: SubscriptionStatus.CANCELLED,
          currentPeriodEnd: LessThanOrEqual(now),
        },
      ],
    });

    if (overdueSubscriptions.length === 0) {
      return 0;
    }

    for (const sub of overdueSubscriptions) {
      sub.status = SubscriptionStatus.EXPIRED;
    }

    await this.subscriptionRepo.save(overdueSubscriptions);

    this.logger.log(
      `Expired ${overdueSubscriptions.length} overdue subscription(s).`,
    );

    return overdueSubscriptions.length;
  }

  async getAllPlans(): Promise<SubscriptionPlanEntity[]> {
    return this.planRepo.find({
      order: { role: 'ASC', displayOrder: 'ASC' },
    });
  }

  private async prepareSubscriptionCheckout(
    userId: string,
    input: {
      planId: string;
      billingCycle: BillingCycle;
      paymentMethodId: string;
    },
  ): Promise<PreparedSubscriptionCheckoutContext> {
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException(
        'You already have an active subscription. Cancel it first before subscribing to a new plan.',
      );
    }

    const plan = await this.planRepo.findOne({
      where: { id: input.planId, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException(
        'Subscription plan not found or is no longer available.',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (plan.role !== user.role) {
      throw new BadRequestException(
        `This plan is for ${plan.role} users. Your role is ${user.role}.`,
      );
    }

    const paymentMethod = await this.paymentMethodRepo.findOne({
      where: {
        id: input.paymentMethodId,
        userId,
      },
    });
    if (!paymentMethod) {
      throw new NotFoundException(
        `Payment method ${input.paymentMethodId} not found`,
      );
    }
    if (paymentMethod.type !== PaymentMethodType.PAYPAL_ACCOUNT) {
      throw new BadRequestException(
        'Only PAYPAL_ACCOUNT methods can be used for subscription checkout',
      );
    }

    return {
      user,
      plan,
      paymentMethod,
      chargeSummary: this.buildChargeSummary(plan, input.billingCycle),
    };
  }

  private buildChargeSummary(
    plan: SubscriptionPlanEntity,
    billingCycle: BillingCycle,
  ): SubscriptionChargeSummary {
    const planAmountVnd = this.calculatePlanAmount(plan, billingCycle);
    const chargeCurrency = this.payPalSubscriptionCurrency;

    if (!/^[A-Z]{3}$/.test(chargeCurrency)) {
      throw new ServiceUnavailableException(
        'PAYPAL_SUBSCRIPTION_CURRENCY must be a 3-letter currency code such as USD.',
      );
    }

    if (chargeCurrency === 'VND') {
      throw new ServiceUnavailableException(
        'PayPal Orders does not support VND directly. Set PAYPAL_SUBSCRIPTION_CURRENCY to a supported settlement currency such as USD.',
      );
    }

    if (
      !Number.isFinite(this.payPalSubscriptionVndRate)
      || this.payPalSubscriptionVndRate <= 0
    ) {
      throw new ServiceUnavailableException(
        'PAYPAL_SUBSCRIPTION_VND_RATE must be a positive number.',
      );
    }

    const chargeAmount = new Decimal(planAmountVnd)
      .div(this.payPalSubscriptionVndRate)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();

    if (chargeAmount <= 0) {
      throw new ServiceUnavailableException(
        'Computed PayPal subscription amount must be greater than zero.',
      );
    }

    return {
      planAmountVnd,
      chargeAmount,
      chargeCurrency,
      exchangeRateApplied: this.payPalSubscriptionVndRate,
    };
  }

  private calculatePlanAmount(
    plan: SubscriptionPlanEntity,
    billingCycle: BillingCycle,
  ): number {
    switch (billingCycle) {
      case BillingCycle.QUARTERLY:
        return Number(plan.priceQuarterly);
      case BillingCycle.YEARLY:
        return Number(plan.priceYearly);
      case BillingCycle.MONTHLY:
      default:
        return Number(plan.priceMonthly);
    }
  }

  private calculatePeriodEnd(startAt: Date, billingCycle: BillingCycle): Date {
    const durationDays = CYCLE_DURATION_DAYS[billingCycle];
    return new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  private async getActiveSubscriptionWithRepo(
    repository: Repository<UserSubscriptionEntity>,
    userId: string,
  ): Promise<UserSubscriptionEntity | null> {
    const now = new Date();

    return repository.findOne({
      where: [
        {
          userId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: MoreThanOrEqual(now),
        },
        {
          userId,
          status: SubscriptionStatus.CANCELLED,
          currentPeriodEnd: MoreThanOrEqual(now),
        },
      ],
      relations: ['plan'],
    });
  }

  private extractCompletedSubscriptionOrder(
    order: Record<string, unknown>,
    expectedPlanId: string,
  ): CompletedSubscriptionOrderDetails {
    const orderId = typeof order.id === 'string' ? order.id : null;
    if (!orderId) {
      throw new BadRequestException(
        'PayPal order id is missing from capture payload',
      );
    }

    const orderStatus =
      typeof order.status === 'string' ? order.status.toUpperCase() : null;
    if (orderStatus && orderStatus !== 'COMPLETED') {
      throw new ConflictException(
        `PayPal order ${orderId} is ${orderStatus}, not COMPLETED`,
      );
    }

    const payer =
      order.payer && typeof order.payer === 'object'
        ? (order.payer as Record<string, unknown>)
        : null;
    const payerEmail =
      payer && typeof payer.email_address === 'string' ? payer.email_address : null;
    const payerId =
      payer && typeof payer.payer_id === 'string' ? payer.payer_id : null;

    const paymentSource =
      order.payment_source && typeof order.payment_source === 'object'
        ? (order.payment_source as Record<string, unknown>)
        : null;
    const paypalSource =
      paymentSource?.paypal && typeof paymentSource.paypal === 'object'
        ? (paymentSource.paypal as Record<string, unknown>)
        : null;
    const attributesSource =
      paypalSource?.attributes && typeof paypalSource.attributes === 'object'
        ? (paypalSource.attributes as Record<string, unknown>)
        : null;
    const vaultSource =
      attributesSource?.vault && typeof attributesSource.vault === 'object'
        ? (attributesSource.vault as Record<string, unknown>)
        : null;
    const vaultId =
      vaultSource && typeof vaultSource.id === 'string' ? vaultSource.id : null;
    const vaultStatus =
      vaultSource && typeof vaultSource.status === 'string'
        ? vaultSource.status
        : null;
    const customerSource =
      vaultSource?.customer && typeof vaultSource.customer === 'object'
        ? (vaultSource.customer as Record<string, unknown>)
        : null;
    const customerId =
      customerSource && typeof customerSource.id === 'string'
        ? customerSource.id
        : null;

    const purchaseUnits = Array.isArray(order.purchase_units)
      ? order.purchase_units
      : null;
    if (!purchaseUnits || purchaseUnits.length === 0) {
      throw new BadRequestException('PayPal order is missing purchase units');
    }

    const purchaseUnit =
      purchaseUnits[0] && typeof purchaseUnits[0] === 'object'
        ? (purchaseUnits[0] as Record<string, unknown>)
        : null;
    if (!purchaseUnit) {
      throw new BadRequestException('PayPal purchase unit payload is invalid');
    }

    const customId =
      typeof purchaseUnit.custom_id === 'string' ? purchaseUnit.custom_id : null;
    if (customId && customId !== expectedPlanId) {
      throw new ConflictException(
        `PayPal order ${orderId} is bound to plan ${customId}, not ${expectedPlanId}`,
      );
    }

    const payments =
      purchaseUnit.payments && typeof purchaseUnit.payments === 'object'
        ? (purchaseUnit.payments as Record<string, unknown>)
        : null;
    const captures =
      payments && Array.isArray(payments.captures) ? payments.captures : null;
    if (!captures || captures.length === 0) {
      throw new BadRequestException('PayPal order is missing capture details');
    }

    const capture =
      captures[0] && typeof captures[0] === 'object'
        ? (captures[0] as Record<string, unknown>)
        : null;
    if (!capture) {
      throw new BadRequestException('PayPal capture payload is invalid');
    }

    const captureId = typeof capture.id === 'string' ? capture.id : null;
    if (!captureId) {
      throw new BadRequestException('PayPal capture id is missing');
    }

    const captureStatus =
      typeof capture.status === 'string' ? capture.status.toUpperCase() : null;
    if (captureStatus && captureStatus !== 'COMPLETED') {
      throw new ConflictException(
        `PayPal capture ${captureId} is ${captureStatus}, not COMPLETED`,
      );
    }

    const amountSource =
      capture.amount && typeof capture.amount === 'object'
        ? (capture.amount as Record<string, unknown>)
        : purchaseUnit.amount && typeof purchaseUnit.amount === 'object'
          ? (purchaseUnit.amount as Record<string, unknown>)
          : null;
    if (!amountSource) {
      throw new BadRequestException('PayPal amount details are missing');
    }

    const currency =
      typeof amountSource.currency_code === 'string'
        ? amountSource.currency_code
        : null;
    const value = typeof amountSource.value === 'string' ? amountSource.value : null;
    if (!currency || !value) {
      throw new BadRequestException('PayPal amount payload is incomplete');
    }

    return {
      orderId,
      captureId,
      amount: new Decimal(value)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber(),
      currency,
      payerEmail,
      payerId,
      vaultId,
      vaultStatus,
      customerId,
    };
  }

  private assertSubscriptionPayPalOrderMatchesCharge(
    orderDetails: CompletedSubscriptionOrderDetails,
    chargeSummary: SubscriptionChargeSummary,
  ): void {
    const capturedAmount = new Decimal(orderDetails.amount).toDecimalPlaces(2);
    const expectedAmount = new Decimal(chargeSummary.chargeAmount).toDecimalPlaces(2);
    if (!capturedAmount.equals(expectedAmount)) {
      throw new ConflictException(
        'Captured PayPal amount does not match the expected subscription charge.',
      );
    }

    if (orderDetails.currency.toUpperCase() !== chargeSummary.chargeCurrency) {
      throw new ConflictException(
        'Captured PayPal currency does not match the configured subscription settlement currency.',
      );
    }
  }

  private applyPayPalCaptureDetails(
    paymentMethod: PaymentMethodEntity,
    orderDetails: CompletedSubscriptionOrderDetails,
  ): void {
    const existingMetadata =
      paymentMethod.metadata && typeof paymentMethod.metadata === 'object'
        ? paymentMethod.metadata
        : {};
    const existingVault =
      existingMetadata.paypalVault && typeof existingMetadata.paypalVault === 'object'
        ? (existingMetadata.paypalVault as Record<string, unknown>)
        : {};

    paymentMethod.paypalEmail =
      orderDetails.payerEmail ?? paymentMethod.paypalEmail ?? null;
    paymentMethod.metadata = {
      ...existingMetadata,
      paypalVault: {
        ...existingVault,
        customerId: orderDetails.customerId ?? existingVault.customerId ?? null,
        vaultId: orderDetails.vaultId ?? existingVault.vaultId ?? null,
        payerId: orderDetails.payerId ?? existingVault.payerId ?? null,
        payerEmail: orderDetails.payerEmail ?? existingVault.payerEmail ?? null,
        status: orderDetails.vaultStatus ?? existingVault.status ?? null,
        lastOrderId: orderDetails.orderId,
        lastCaptureId: orderDetails.captureId,
        lastCapturedAt: new Date().toISOString(),
      },
    };

    if (orderDetails.payerEmail || orderDetails.customerId || orderDetails.vaultId) {
      paymentMethod.isVerified = true;
      paymentMethod.verifiedAt = paymentMethod.verifiedAt ?? new Date();
    }
  }

  private buildPaymentSummary(subscription: UserSubscriptionEntity) {
    const hasPaymentMetadata =
      Boolean(subscription.paymentReference)
      || Boolean(subscription.paymentProvider)
      || Boolean(subscription.paymentCurrency)
      || subscription.paymentCapturedAmount !== null;

    if (!hasPaymentMetadata) {
      return null;
    }

    const capturedAmount =
      subscription.paymentCapturedAmount !== null
      && subscription.paymentCapturedAmount !== undefined
        ? Number(subscription.paymentCapturedAmount)
        : null;
    const displayAmountVnd = Number(subscription.amountPaid);
    const exchangeRateApplied =
      capturedAmount && capturedAmount > 0
        ? new Decimal(displayAmountVnd)
          .div(capturedAmount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber()
        : null;

    return {
      provider: subscription.paymentProvider ?? 'MANUAL',
      reference: subscription.paymentReference ?? null,
      capturedAmount,
      currency: subscription.paymentCurrency ?? null,
      displayAmountVnd,
      exchangeRateApplied,
    };
  }
}
