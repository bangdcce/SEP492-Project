import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Guard that restricts access to premium-only features.
 *
 * Use this guard for features that are completely locked behind premium
 * (not just limited). For count-based limits, use QuotaService instead.
 *
 * Usage:
 * ```typescript
 * @UseGuards(JwtAuthGuard, PremiumGuard)
 * @Get('client-budget')
 * async viewClientBudget() { ... }
 * ```
 *
 * The guard extracts the user from the JWT request context
 * and checks their premium status via SubscriptionsService.
 *
 * Returns a structured error response that the frontend can use
 * to show an upgrade prompt.
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  private readonly logger = new Logger(PremiumGuard.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Check if the requesting user has an active premium subscription.
   *
   * @param context - The execution context containing the HTTP request
   * @returns true if user has premium, throws ForbiddenException otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      this.logger.warn('PremiumGuard: No user found in request context');
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required to access this feature.',
      });
    }

    const isPremium = await this.subscriptionsService.isPremium(user.id);

    if (!isPremium) {
      this.logger.debug(
        `PremiumGuard: User ${user.id} denied access (not premium)`,
      );

      throw new ForbiddenException({
        code: 'PREMIUM_REQUIRED',
        message: 'Upgrade to Premium to access this feature.',
        upgradeUrl: '/subscriptions/plans',
        currentPlan: 'FREE',
        requiredPlan: 'PREMIUM',
      });
    }

    return true;
  }
}
