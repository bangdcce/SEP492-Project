import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { QuotaService } from './quota.service';
import { PremiumGuard } from './subscription.guard';
import { SubscriptionPlanEntity } from '../../database/entities/subscription-plan.entity';
import { UserSubscriptionEntity } from '../../database/entities/user-subscription.entity';
import { QuotaUsageLogEntity } from '../../database/entities/quota-usage-log.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ProjectRequestEntity } from '../../database/entities/project-request.entity';

/**
 * Module for subscription management (UC-39, UC-40, UC-41).
 *
 * Provides:
 * - SubscriptionsService: Premium status checks, plan management, subscribe/cancel
 * - QuotaService: Free-tier limit enforcement
 * - PremiumGuard: Boolean access gate for premium-only features
 *
 * Exported so other modules can inject SubscriptionsService, QuotaService,
 * and PremiumGuard for their own quota enforcement.
 *
 * Usage in other modules:
 * ```typescript
 * @Module({
 *   imports: [SubscriptionsModule],
 *   providers: [SomeService],
 * })
 * export class SomeModule {}
 *
 * // In SomeService:
 * constructor(
 *   private quotaService: QuotaService,
 *   private subscriptionsService: SubscriptionsService,
 * ) {}
 * ```
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlanEntity,
      UserSubscriptionEntity,
      QuotaUsageLogEntity,
      UserEntity,
      ProjectRequestEntity,
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    QuotaService,
    PremiumGuard,
  ],
  exports: [
    SubscriptionsService,
    QuotaService,
    PremiumGuard,
  ],
})
export class SubscriptionsModule {}
