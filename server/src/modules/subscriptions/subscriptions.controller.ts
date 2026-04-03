import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { QuotaService } from './quota.service';
import {
  SubscribeDto,
  CancelSubscriptionDto,
  MySubscriptionResponseDto,
  SubscriptionPlanResponseDto,
} from './dto/subscription.dto';

/**
 * REST controller for subscription management (UC-39, UC-40, UC-41).
 *
 * Endpoints:
 * - GET  /subscriptions/plans  → List available plans for user's role
 * - GET  /subscriptions/me     → View current subscription + perks + usage (UC-39)
 * - POST /subscriptions/subscribe → Subscribe to a plan (UC-40)
 * - POST /subscriptions/cancel    → Cancel current subscription (UC-41)
 *
 * All endpoints require JWT authentication.
 */
@ApiTags('subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * List available subscription plans for the authenticated user's role.
   *
   * Returns only active plans matching the user's current role
   * (CLIENT, BROKER, or FREELANCER).
   *
   * @param req - Express request with JWT user
   * @returns Array of available subscription plans
   */
  @ApiOperation({
    summary: 'List available subscription plans',
    description:
      'Returns all active subscription plans for the authenticated user\'s role. ' +
      'Plans include pricing for monthly, quarterly, and yearly billing cycles.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available plans',
    type: [SubscriptionPlanResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @Get('plans')
  async getPlans(@Request() req: any) {
    const user = req.user;
    this.logger.debug(`User ${user.id} requesting plans for role ${user.role}`);
    try {
      const plans = await this.subscriptionsService.getPlansForRole(user.role);

      const response = {
        success: true,
        data: plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName,
          description: plan.description,
          role: plan.role,
          priceMonthly: Number(plan.priceMonthly),
          priceQuarterly: Number(plan.priceQuarterly),
          priceYearly: Number(plan.priceYearly),
          perks: plan.perks,
        })),
      };

      this.logger.log(
        `Get Plans Endpoint Successful: user="${user.id}" role="${user.role}" count=${response.data.length}`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Get Plans Endpoint Failed: ${message}`);
      throw error;
    }
  }

  /**
   * View the authenticated user's current subscription status (UC-39).
   *
   * Returns:
   * - Whether the user is premium
   * - Current subscription details (if any)
   * - Current perks (premium or free-tier)
   * - Current quota usage summary
   *
   * @param req - Express request with JWT user
   * @returns Full subscription status
   */
  @ApiOperation({
    summary: 'View current subscription',
    description:
      'Returns the authenticated user\'s current subscription status, ' +
      'including premium perks, plan details, and quota usage. ' +
      'Free users will see their current limits and usage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current subscription status',
    type: MySubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get('me')
  async getMySubscription(@Request() req: any) {
    const user = req.user;
    this.logger.debug(`User ${user.id} viewing subscription status`);
    try {
      const subscriptionData = await this.subscriptionsService.getMySubscription(
        user.id,
      );

      // Enrich with quota usage summary
      const usage = await this.quotaService.getUsageSummary(user.id, user.role);

      const response = {
        success: true,
        data: {
          ...subscriptionData,
          usage,
        },
      };

      this.logger.log(
        `Get My Subscription Endpoint Successful: user="${user.id}" premium=${response.data.isPremium}`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Get My Subscription Endpoint Failed: ${message}`);
      throw error;
    }
  }

  /**
   * Subscribe to a premium plan (UC-40).
   *
   * Creates a new subscription with immediate activation.
   * The user selects a plan and billing cycle (monthly/quarterly/yearly).
   *
   * Business rules:
   * - User must not have an existing active subscription
   * - Plan must exist and be active
   * - Plan must match the user's role
   *
   * @param req - Express request with JWT user
   * @param dto - Subscribe parameters
   * @returns The created subscription
   */
  @ApiOperation({
    summary: 'Subscribe to a premium plan',
    description:
      'Subscribe to a premium plan. The subscription is activated immediately. ' +
      'Choose a billing cycle (MONTHLY, QUARTERLY, YEARLY) for different pricing. ' +
      'Quarterly saves 15%, yearly saves 30%.',
  })
  @ApiBody({ type: SubscribeDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
  })
  @ApiResponse({ status: 400, description: 'Plan role mismatch or invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({
    status: 409,
    description: 'User already has an active subscription',
  })
  @Post('subscribe')
  async subscribe(@Request() req: any, @Body() dto: SubscribeDto) {
    const user = req.user;
    this.logger.log(
      `User ${user.id} subscribing to plan ${dto.planId} (${dto.billingCycle})`,
    );
    try {
      const subscription = await this.subscriptionsService.subscribe(
        user.id,
        dto,
      );

      const response = {
        success: true,
        message: 'Successfully subscribed to Premium! Enjoy your new perks.',
        data: {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          amountPaid: Number(subscription.amountPaid),
        },
      };

      this.logger.log(
        `Subscribe Endpoint Successful: user="${user.id}" subscription="${subscription.id}"`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Subscribe Endpoint Failed: ${message}`);
      throw error;
    }
  }

  /**
   * Cancel the current subscription (UC-41).
   *
   * Implements soft cancel:
   * - Subscription remains active until the end of the current billing period
   * - Premium perks continue to work until period end
   * - After period end, subscription expires automatically
   *
   * @param req - Express request with JWT user
   * @param dto - Cancel parameters (optional reason)
   * @returns The updated subscription
   */
  @ApiOperation({
    summary: 'Cancel current subscription',
    description:
      'Cancel the current premium subscription. Uses soft-cancel: ' +
      'premium perks remain active until the end of the current billing period. ' +
      'Optionally provide a cancellation reason.',
  })
  @ApiBody({ type: CancelSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'No active subscription found',
  })
  @ApiResponse({
    status: 409,
    description: 'Subscription already scheduled for cancellation',
  })
  @HttpCode(HttpStatus.OK)
  @Post('cancel')
  async cancel(
    @Request() req: any,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const user = req.user;
    this.logger.log(`User ${user.id} cancelling subscription`);
    try {
      const subscription = await this.subscriptionsService.cancel(user.id, dto);

      const response = {
        success: true,
        message: `Subscription cancelled. Your premium perks will remain active until ${subscription.currentPeriodEnd.toISOString().split('T')[0]}.`,
        data: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelledAt: subscription.cancelledAt,
        },
      };

      this.logger.log(
        `Cancel Subscription Endpoint Successful: user="${user.id}" subscription="${subscription.id}"`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cancel Subscription Endpoint Failed: ${message}`);
      throw error;
    }
  }
}
