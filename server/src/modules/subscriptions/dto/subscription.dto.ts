import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '../../../database/entities/user-subscription.entity';

/**
 * DTO for subscribing to a premium plan.
 * Used in POST /subscriptions/subscribe
 */
export class SubscribeDto {
  @ApiProperty({
    description: 'ID of the subscription plan to subscribe to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({
    description: 'Billing cycle determines the price and period length',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
    default: BillingCycle.MONTHLY,
  })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiPropertyOptional({
    description: 'Payment method reference (for future payment integration)',
    example: 'BANK_TRANSFER_001',
  })
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

/**
 * DTO for cancelling a subscription.
 * Used in POST /subscriptions/cancel
 *
 * Implements soft cancel: subscription remains active until
 * the end of the current billing period.
 */
export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Reason for cancelling the subscription',
    example: 'I no longer need premium features',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Response DTO for subscription plan details.
 * Returned by GET /subscriptions/plans
 */
export class SubscriptionPlanResponseDto {
  @ApiProperty({ description: 'Plan unique identifier' })
  id: string;

  @ApiProperty({ description: 'Plan internal name', example: 'CLIENT_PREMIUM' })
  name: string;

  @ApiProperty({ description: 'Plan display name', example: 'Premium Client' })
  displayName: string;

  @ApiProperty({ description: 'Plan description' })
  description: string;

  @ApiProperty({ description: 'Target user role', example: 'CLIENT' })
  role: string;

  @ApiProperty({ description: 'Monthly price in VND', example: 99000 })
  priceMonthly: number;

  @ApiProperty({ description: 'Quarterly price in VND (15% discount)', example: 252000 })
  priceQuarterly: number;

  @ApiProperty({ description: 'Yearly price in VND (30% discount)', example: 832000 })
  priceYearly: number;

  @ApiProperty({ description: 'Premium perks and limits' })
  perks: Record<string, number | boolean>;
}

/**
 * Response DTO for the user's current subscription status.
 * Returned by GET /subscriptions/me
 */
export class MySubscriptionResponseDto {
  @ApiProperty({ description: 'Whether the user currently has an active premium subscription' })
  isPremium: boolean;

  @ApiPropertyOptional({ description: 'Current subscription details (null if free tier)' })
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    amountPaid: number;
    plan: SubscriptionPlanResponseDto;
  };

  @ApiProperty({ description: 'Current perks (either free-tier limits or premium perks)' })
  perks: Record<string, number | boolean>;

  @ApiProperty({ description: 'Current quota usage for the billing period' })
  usage: Record<string, { used: number; limit: number | string }>;
}
