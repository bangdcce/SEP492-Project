import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { QuotaUsageLogEntity, QuotaAction } from '../../database/entities/quota-usage-log.entity';
import { SubscriptionsService } from './subscriptions.service';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';

/**
 * Free-tier limits per quota action.
 *
 * These are the maximum counts allowed for free users.
 * Premium users bypass all limits entirely.
 *
 * Use -1 to indicate "no limit for free tier" (shouldn't normally happen,
 * but provided for flexibility).
 */
export const FREE_LIMITS: Record<string, number> = {
  // Client limits
  [QuotaAction.CREATE_REQUEST]: 2,
  [QuotaAction.CONVERT_TO_PROJECT]: 1,
  [QuotaAction.AI_MATCH_SEARCH]: 1,         // per day
  [QuotaAction.INVITE_BROKER]: 3,            // per request

  // Broker limits
  [QuotaAction.APPLY_TO_REQUEST]: 3,         // per week
  [QuotaAction.CREATE_PROPOSAL]: 3,          // active total

  // Freelancer limits
  [QuotaAction.APPLY_TO_PROJECT]: 5,         // per week
  [QuotaAction.ADD_PORTFOLIO]: 3,            // total slots
};

/**
 * Time window configuration for each quota action.
 * Determines over what period the usage is counted.
 */
export enum QuotaTimeWindow {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  TOTAL = 'TOTAL',       // Lifetime active count (e.g., active requests)
  PER_ENTITY = 'PER_ENTITY', // Per parent entity (e.g., invites per request)
}

/**
 * Mapping of quota actions to their time windows.
 */
const ACTION_TIME_WINDOWS: Record<string, QuotaTimeWindow> = {
  [QuotaAction.CREATE_REQUEST]: QuotaTimeWindow.TOTAL,
  [QuotaAction.CONVERT_TO_PROJECT]: QuotaTimeWindow.TOTAL,
  [QuotaAction.AI_MATCH_SEARCH]: QuotaTimeWindow.DAILY,
  [QuotaAction.INVITE_BROKER]: QuotaTimeWindow.PER_ENTITY,
  [QuotaAction.APPLY_TO_REQUEST]: QuotaTimeWindow.WEEKLY,
  [QuotaAction.CREATE_PROPOSAL]: QuotaTimeWindow.TOTAL,
  [QuotaAction.APPLY_TO_PROJECT]: QuotaTimeWindow.WEEKLY,
  [QuotaAction.ADD_PORTFOLIO]: QuotaTimeWindow.TOTAL,
};

/**
 * Service responsible for enforcing free-tier quota limits.
 *
 * Two patterns are used throughout the application:
 *
 * 1. **PremiumGuard** (boolean gate): Used for features that are completely
 *    locked behind premium (e.g., viewing client budgets for brokers).
 *
 * 2. **QuotaService** (count-based): Used for features where free users get
 *    limited access and premium users get unlimited (e.g., creating requests).
 *
 * Usage in services:
 * ```typescript
 *   await this.quotaService.checkQuota(userId, QuotaAction.CREATE_REQUEST);
 *   // If we get here, the user is within their limits
 *   const request = this.requestRepo.create(dto);
 * ```
 *
 * The 429 (Too Many Requests) status code is used for quota exceeded
 * responses, following HTTP semantics for rate limiting.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    @InjectRepository(QuotaUsageLogEntity)
    private readonly usageRepo: Repository<QuotaUsageLogEntity>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Check if a user is within their quota for a specific action.
   *
   * For premium users, this is always a no-op (instant return).
   * For free users, it counts current usage and compares against limits.
   *
   * @param userId - The user performing the action
   * @param action - The quota action to check
   * @param entityId - Optional parent entity ID (for PER_ENTITY limits like invites per request)
   * @throws HttpException with 429 status if quota is exceeded
   */
  async checkQuota(
    userId: string,
    action: QuotaAction,
    entityId?: string,
  ): Promise<void> {
    // Premium users bypass all limits
    const isPremium = await this.subscriptionsService.isPremium(userId);
    if (isPremium) {
      return;
    }

    const limit = FREE_LIMITS[action];
    if (limit === undefined || limit === -1) {
      return; // No limit defined for this action
    }

    const currentCount = await this.countUsage(userId, action, entityId);

    if (currentCount >= limit) {
      this.logger.warn(
        `Quota exceeded for user ${userId}: action=${action}, ` +
        `current=${currentCount}, limit=${limit}`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'QUOTA_EXCEEDED',
          action,
          limit,
          current: currentCount,
          message: `Free plan limit reached (${currentCount}/${limit}). Upgrade to Premium for unlimited access.`,
          upgradeUrl: '/subscriptions/plans',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Increment the usage counter for a specific action.
   *
   * Should be called AFTER the action completes successfully.
   * This ensures we don't count failed attempts.
   *
   * @param userId - The user who performed the action
   * @param action - The action that was performed
   * @param metadata - Optional context data (e.g., request ID)
   */
  async incrementUsage(
    userId: string,
    action: QuotaAction,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Try to find existing record for today
    const existing = await this.usageRepo.findOne({
      where: {
        userId,
        action,
        date: today,
      },
    });

    if (existing) {
      // Increment existing counter
      existing.count += 1;
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      await this.usageRepo.save(existing);
    } else {
      // Create new record
      const log = this.usageRepo.create({
        userId,
        action,
        date: today,
        count: 1,
        metadata: metadata || null,
      });
      await this.usageRepo.save(log);
    }
  }

  /**
   * Count current usage for a user and action based on the time window.
   *
   * @param userId - The user to count usage for
   * @param action - The action to count
   * @param entityId - Optional entity ID for PER_ENTITY windows
   * @returns Current usage count
   */
  async countUsage(
    userId: string,
    action: QuotaAction,
    entityId?: string,
  ): Promise<number> {
    const timeWindow = ACTION_TIME_WINDOWS[action] || QuotaTimeWindow.DAILY;

    switch (timeWindow) {
      case QuotaTimeWindow.DAILY: {
        return this.countDailyUsage(userId, action);
      }
      case QuotaTimeWindow.WEEKLY: {
        return this.countWeeklyUsage(userId, action);
      }
      case QuotaTimeWindow.TOTAL: {
        return this.countTotalActiveUsage(userId, action);
      }
      case QuotaTimeWindow.PER_ENTITY: {
        return this.countPerEntityUsage(userId, action, entityId);
      }
      default:
        return 0;
    }
  }

  /**
   * Count usage for today only.
   */
  private async countDailyUsage(
    userId: string,
    action: QuotaAction,
  ): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const result = await this.usageRepo
      .createQueryBuilder('log')
      .select('COALESCE(SUM(log.count), 0)', 'total')
      .where('log.user_id = :userId', { userId })
      .andWhere('log.action = :action', { action })
      .andWhere('log.date = :today', { today })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Count usage for the past 7 days.
   */
  private async countWeeklyUsage(
    userId: string,
    action: QuotaAction,
  ): Promise<number> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const result = await this.usageRepo
      .createQueryBuilder('log')
      .select('COALESCE(SUM(log.count), 0)', 'total')
      .where('log.user_id = :userId', { userId })
      .andWhere('log.action = :action', { action })
      .andWhere('log.created_at >= :weekAgo', { weekAgo })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Count total active items (e.g., active requests, active proposals).
   * This queries the actual entity tables instead of the usage log.
   */
  private async countTotalActiveUsage(
    userId: string,
    action: QuotaAction,
  ): Promise<number> {
    // For total counts, we query the usage log for the total count
    // In production, this would query the actual entity tables
    const result = await this.usageRepo
      .createQueryBuilder('log')
      .select('COALESCE(SUM(log.count), 0)', 'total')
      .where('log.user_id = :userId', { userId })
      .andWhere('log.action = :action', { action })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Count usage per specific entity (e.g., invites per request).
   */
  private async countPerEntityUsage(
    userId: string,
    action: QuotaAction,
    entityId?: string,
  ): Promise<number> {
    if (!entityId) return 0;

    const result = await this.usageRepo
      .createQueryBuilder('log')
      .select('COALESCE(SUM(log.count), 0)', 'total')
      .where('log.user_id = :userId', { userId })
      .andWhere('log.action = :action', { action })
      .andWhere("log.metadata->>'entityId' = :entityId", { entityId })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  /**
   * Get a summary of the user's current quota usage.
   *
   * Returns all quota actions relevant to the user's role with
   * their current usage and limits.
   *
   * @param userId - The user to get usage for
   * @param role - The user's role (determines which quotas are relevant)
   * @returns Map of action -> { used, limit }
   */
  async getUsageSummary(
    userId: string,
    role: UserRole,
  ): Promise<Record<string, { used: number; limit: number | string }>> {
    const isPremium = await this.subscriptionsService.isPremium(userId);
    const summary: Record<string, { used: number; limit: number | string }> = {};

    // Determine which actions are relevant for this role
    const roleActions: Record<string, QuotaAction[]> = {
      [UserRole.CLIENT]: [
        QuotaAction.CREATE_REQUEST,
        QuotaAction.CONVERT_TO_PROJECT,
        QuotaAction.AI_MATCH_SEARCH,
        QuotaAction.INVITE_BROKER,
      ],
      [UserRole.BROKER]: [
        QuotaAction.APPLY_TO_REQUEST,
        QuotaAction.CREATE_PROPOSAL,
      ],
      [UserRole.FREELANCER]: [
        QuotaAction.APPLY_TO_PROJECT,
        QuotaAction.ADD_PORTFOLIO,
      ],
    };

    const actions = roleActions[role] || [];

    for (const action of actions) {
      const used = await this.countUsage(userId, action);
      const limit = isPremium ? 'Unlimited' : FREE_LIMITS[action];
      summary[action] = { used, limit };
    }

    return summary;
  }
}
