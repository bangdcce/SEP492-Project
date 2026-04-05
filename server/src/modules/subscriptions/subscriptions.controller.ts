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
  Query,
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
  CreatePayPalSubscriptionOrderDto,
  MySubscriptionResponseDto,
  PayPalSubscriptionOrderResponseDto,
  SubscriptionPlanResponseDto,
  SubscriptionPayPalConfigQueryDto,
  SubscriptionPayPalConfigResponseDto,
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

  @ApiOperation({
    summary: 'Load PayPal config for subscription checkout',
    description:
      'Returns the PayPal SDK configuration and converted charge quote for the selected subscription plan and billing cycle.',
  })
  @ApiResponse({
    status: 200,
    description: 'PayPal checkout configuration and quoted subscription charge',
    type: SubscriptionPayPalConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid plan, billing cycle, or payment method' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan, user, or payment method not found' })
  @ApiResponse({
    status: 409,
    description: 'User already has an active subscription',
  })
  @Get('paypal/config')
  async getPayPalConfig(
    @Request() req: any,
    @Query() dto: SubscriptionPayPalConfigQueryDto,
  ) {
    const user = req.user;
    this.logger.debug(
      `User ${user.id} requesting PayPal subscription config for plan ${dto.planId} (${dto.billingCycle})`,
    );
    try {
      const config = await this.subscriptionsService.getPayPalCheckoutConfig(
        user.id,
        dto,
      );

      const response = {
        success: true,
        data: config,
      };

      this.logger.log(
        `Get PayPal Subscription Config Endpoint Successful: user="${user.id}" plan="${dto.planId}" cycle="${dto.billingCycle}"`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Get PayPal Subscription Config Endpoint Failed: ${message}`);
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Create a PayPal order for subscription checkout',
    description:
      'Creates a PayPal order for the selected premium plan. The returned order id is approved in the PayPal SDK and then finalized by POST /subscriptions/subscribe.',
  })
  @ApiBody({ type: CreatePayPalSubscriptionOrderDto })
  @ApiResponse({
    status: 201,
    description: 'PayPal subscription order created successfully',
    type: PayPalSubscriptionOrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid plan, billing cycle, or payment method' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan, user, or payment method not found' })
  @ApiResponse({
    status: 409,
    description: 'User already has an active subscription',
  })
  @Post('paypal/order')
  async createPayPalOrder(
    @Request() req: any,
    @Body() dto: CreatePayPalSubscriptionOrderDto,
  ) {
    const user = req.user;
    this.logger.log(
      `User ${user.id} creating PayPal subscription order for plan ${dto.planId} (${dto.billingCycle})`,
    );
    try {
      const order = await this.subscriptionsService.createPayPalSubscriptionOrder(
        user.id,
        dto,
      );

      const response = {
        success: true,
        data: order,
      };

      this.logger.log(
        `Create PayPal Subscription Order Endpoint Successful: user="${user.id}" order="${order.orderId}"`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Create PayPal Subscription Order Endpoint Failed: ${message}`);
      throw error;
    }
  }

  /**
   * Subscribe to a premium plan (UC-40).
   *
   * Captures an approved PayPal order and activates the subscription immediately.
   *
   * Business rules:
   * - User must not have an existing active subscription
   * - Plan must exist and be active
   * - Plan must match the user's role
   * - Order must be approved and captured through PayPal first
   *
   * @param req - Express request with JWT user
   * @param dto - Subscribe parameters
   * @returns The created subscription
   */
  @ApiOperation({
    summary: 'Subscribe to a premium plan',
    description:
      'Captures an approved PayPal order and activates the premium subscription immediately. ' +
      'Choose a billing cycle (MONTHLY, QUARTERLY, YEARLY) for different pricing before creating the PayPal order.',
  })
  @ApiBody({ type: SubscribeDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully after PayPal capture',
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
          payment: subscription.paymentProvider
            ? {
                provider: subscription.paymentProvider,
                reference: subscription.paymentReference ?? null,
                capturedAmount:
                  subscription.paymentCapturedAmount !== null
                  && subscription.paymentCapturedAmount !== undefined
                    ? Number(subscription.paymentCapturedAmount)
                    : null,
                currency: subscription.paymentCurrency ?? null,
              }
            : null,
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
