import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  UserSubscriptionEntity,
  SubscriptionStatus,
  BillingCycle,
} from '../../database/entities/user-subscription.entity';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { SubscribeDto, CancelSubscriptionDto } from './dto/subscription.dto';

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

/**
 * Duration mappings for billing cycles.
 * Used to calculate currentPeriodEnd when creating a subscription.
 */
const CYCLE_DURATION_DAYS: Record<BillingCycle, number> = {
  [BillingCycle.MONTHLY]: 30,
  [BillingCycle.QUARTERLY]: 90,
  [BillingCycle.YEARLY]: 365,
};

/**
 * Service managing subscription lifecycle and premium status.
 *
 * Core responsibilities:
 * - Check if a user has premium status (used by QuotaService and PremiumGuard)
 * - Create new subscriptions (UC-40)
 * - Cancel subscriptions with soft-cancel logic (UC-41)
 * - Retrieve current subscription and perks (UC-39)
 * - List available plans filtered by user role
 * - Handle subscription expiration via cron job
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(UserSubscriptionEntity)
    private readonly subscriptionRepo: Repository<UserSubscriptionEntity>,
    @InjectRepository(SubscriptionPlanEntity)
    private readonly planRepo: Repository<SubscriptionPlanEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Check if a user currently has an active premium subscription.
   *
   * This is the most-called method in the service — used by QuotaService
   * and PremiumGuard on almost every request.
   *
   * A subscription is considered "active premium" if:
   * 1. Status is ACTIVE or CANCELLED (cancelled still has perks until period end)
   * 2. Current date is within the billing period
   *
   * @param userId - The user to check
   * @returns true if user has active premium perks
   */
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

    // Also check CANCELLED subscriptions that haven't reached period end yet
    const cancelledButActive = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: SubscriptionStatus.CANCELLED,
        currentPeriodEnd: MoreThanOrEqual(now),
      },
    });

    return !!cancelledButActive;
  }

  /**
   * Get the premium perks for a user based on their subscription status.
   *
   * Returns premium perks from their plan if subscribed,
   * otherwise returns free-tier defaults for their role.
   *
   * @param userId - The user to get perks for
   * @returns Perks object with limits and feature flags
   */
  async getPerks(userId: string): Promise<Record<string, number | boolean>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.getActiveSubscription(userId);
    if (subscription && subscription.plan) {
      return subscription.plan.perks;
    }

    // Return free tier perks based on user role
    return FREE_TIER_PERKS[user.role] || {};
  }

  /**
   * Get the active subscription for a user (including cancelled-but-active).
   *
   * @param userId - User ID
   * @returns The active subscription with plan details, or null
   */
  async getActiveSubscription(
    userId: string,
  ): Promise<UserSubscriptionEntity | null> {
    const now = new Date();

    return this.subscriptionRepo.findOne({
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

  /**
   * Get the user's full subscription status including perks and usage.
   * Used by UC-39 (View Subscription).
   *
   * @param userId - The authenticated user's ID
   * @returns Full subscription status with perks and usage counters
   */
  async getMySubscription(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.getActiveSubscription(userId);
    const isPremium = !!subscription;
    const perks = isPremium && subscription.plan
      ? subscription.plan.perks
      : FREE_TIER_PERKS[user.role] || {};

    return {
      isPremium,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            amountPaid: subscription.amountPaid,
            plan: subscription.plan
              ? {
                  id: subscription.plan.id,
                  name: subscription.plan.name,
                  displayName: subscription.plan.displayName,
                  description: subscription.plan.description,
                  role: subscription.plan.role,
                  priceMonthly: subscription.plan.priceMonthly,
                  priceQuarterly: subscription.plan.priceQuarterly,
                  priceYearly: subscription.plan.priceYearly,
                  perks: subscription.plan.perks,
                }
              : null,
          }
        : null,
      perks,
      usage: {},
    };
  }

  /**
   * List available subscription plans for a specific user role.
   *
   * Only returns active plans matching the user's role.
   *
   * @param role - User role (CLIENT, BROKER, FREELANCER)
   * @returns Array of available plans sorted by display order
   */
  async getPlansForRole(role: UserRole): Promise<SubscriptionPlanEntity[]> {
    return this.planRepo.find({
      where: {
        role,
        isActive: true,
      },
      order: {
        displayOrder: 'ASC',
      },
    });
  }

  /**
   * Subscribe a user to a premium plan (UC-40).
   *
   * Business rules:
   * - User must not already have an active subscription
   * - Plan must exist and be active
   * - Plan role must match user's role
   * - Subscription is activated immediately (instant-activate)
   * - Period is calculated based on billing cycle selection
   *
   * @param userId - The user subscribing
   * @param dto - Subscribe parameters (planId, billingCycle)
   * @returns The created subscription
   */
  async subscribe(
    userId: string,
    dto: SubscribeDto,
  ): Promise<UserSubscriptionEntity> {
    // Check for existing active subscription
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new ConflictException(
        'You already have an active subscription. Cancel it first before subscribing to a new plan.',
      );
    }

    // Validate plan exists and is active
    const plan = await this.planRepo.findOne({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found or is no longer available.');
    }

    // Validate plan matches user role
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (plan.role !== user.role) {
      throw new BadRequestException(
        `This plan is for ${plan.role} users. Your role is ${user.role}.`,
      );
    }

    // Calculate billing period
    const now = new Date();
    const durationDays = CYCLE_DURATION_DAYS[dto.billingCycle];
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Calculate amount based on billing cycle
    let amount: number;
    switch (dto.billingCycle) {
      case BillingCycle.QUARTERLY:
        amount = Number(plan.priceQuarterly);
        break;
      case BillingCycle.YEARLY:
        amount = Number(plan.priceYearly);
        break;
      case BillingCycle.MONTHLY:
      default:
        amount = Number(plan.priceMonthly);
        break;
    }

    // Create subscription
    const subscription = this.subscriptionRepo.create({
      userId,
      planId: dto.planId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: dto.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      amountPaid: amount,
      paymentReference: dto.paymentReference || null,
    });

    const saved = await this.subscriptionRepo.save(subscription);

    this.logger.log(
      `User ${userId} subscribed to plan ${plan.name} (${dto.billingCycle}). ` +
      `Period: ${now.toISOString()} to ${periodEnd.toISOString()}. Amount: ${amount} VND`,
    );

    return saved;
  }

  /**
   * Cancel a user's subscription (UC-41).
   *
   * Implements soft cancel:
   * - Sets cancelAtPeriodEnd = true
   * - User keeps premium perks until currentPeriodEnd
   * - After period ends, a cron job will mark it as EXPIRED
   *
   * @param userId - The user cancelling
   * @param dto - Cancel parameters (optional reason)
   * @returns The updated subscription
   */
  async cancel(
    userId: string,
    dto: CancelSubscriptionDto,
  ): Promise<UserSubscriptionEntity> {
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

    // Soft cancel — keep perks until period end
    subscription.cancelAtPeriodEnd = true;
    subscription.cancelReason = dto.reason || null;
    subscription.cancelledAt = new Date();
    subscription.status = SubscriptionStatus.CANCELLED;

    const updated = await this.subscriptionRepo.save(subscription);

    this.logger.log(
      `User ${userId} cancelled subscription ${subscription.id}. ` +
      `Perks remain active until ${subscription.currentPeriodEnd.toISOString()}. ` +
      `Reason: ${dto.reason || 'No reason provided'}`,
    );

    return updated;
  }

  /**
   * Expire subscriptions that have passed their billing period end.
   *
   * This should be called by a cron job (e.g., daily at midnight).
   * Finds all ACTIVE or CANCELLED subscriptions where currentPeriodEnd < NOW
   * and marks them as EXPIRED.
   *
   * @returns Number of subscriptions expired
   */
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

  /**
   * Get all subscription plans (admin).
   */
  async getAllPlans(): Promise<SubscriptionPlanEntity[]> {
    return this.planRepo.find({
      order: { role: 'ASC', displayOrder: 'ASC' },
    });
  }
}
