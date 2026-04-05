import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '../../../database/entities/user-subscription.entity';
import { PayPalSubscriptionCheckoutConfigView } from '../../payments/payments.types';

/**
 * Query DTO for loading PayPal checkout config for a subscription plan.
 */
export class SubscriptionPayPalConfigQueryDto {
  @ApiProperty({
    description: 'ID of the subscription plan to quote in PayPal',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({
    description: 'Billing cycle determines the PayPal checkout amount',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
  })
  @IsEnum(BillingCycle)
  @IsNotEmpty()
  billingCycle: BillingCycle;

  @ApiProperty({
    description: 'Saved PayPal payment method to use for checkout',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  paymentMethodId: string;
}

/**
 * DTO for creating a PayPal order for a premium plan.
 */
export class CreatePayPalSubscriptionOrderDto extends SubscriptionPayPalConfigQueryDto {
  @ApiPropertyOptional({
    description: 'Funding source selected in the PayPal SDK (paypal, card, etc.)',
    example: 'paypal',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Return URL used by PayPal after buyer approval',
    example: 'https://localhost:5173/client/subscription',
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({
    description: 'Cancel URL used by PayPal when checkout is aborted',
    example: 'https://localhost:5173/client/subscription',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

/**
 * DTO for completing an approved PayPal subscription checkout.
 * Used in POST /subscriptions/subscribe
 */
export class SubscribeDto extends SubscriptionPayPalConfigQueryDto {
  @ApiProperty({
    description: 'Approved PayPal order id returned by the server-side create-order endpoint',
    example: '5O190127TN364715T',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;
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

export class SubscriptionPaymentResponseDto {
  @ApiProperty({ description: 'Payment provider used for activation', example: 'PAYPAL' })
  provider: string;

  @ApiPropertyOptional({ description: 'Provider reference for the captured payment' })
  reference?: string | null;

  @ApiPropertyOptional({ description: 'Amount captured by the payment provider' })
  capturedAmount?: number | null;

  @ApiPropertyOptional({ description: 'Currency captured by the payment provider', example: 'USD' })
  currency?: string | null;

  @ApiProperty({ description: 'Subscription amount stored in platform currency (VND)' })
  displayAmountVnd: number;

  @ApiPropertyOptional({
    description: 'VND to PayPal settlement currency rate applied at checkout time',
    example: 25000,
  })
  exchangeRateApplied?: number | null;
}

export class SubscriptionPayPalConfigResponseDto
  implements PayPalSubscriptionCheckoutConfigView
{
  @ApiProperty({ example: 'client-id' })
  clientId: string;

  @ApiProperty({ enum: ['sandbox', 'live'], example: 'sandbox' })
  environment: 'sandbox' | 'live';

  @ApiProperty({ example: true })
  vaultEnabled: boolean;

  @ApiPropertyOptional()
  userIdToken: string | null;

  @ApiProperty({ description: 'Amount that PayPal will charge in the settlement currency' })
  chargeAmount: number;

  @ApiProperty({ description: 'Settlement currency used for PayPal checkout', example: 'USD' })
  chargeCurrency: string;

  @ApiProperty({ description: 'Platform plan amount displayed to the user in VND' })
  displayAmountVnd: number;

  @ApiProperty({ description: 'Configured VND conversion rate used to compute chargeAmount' })
  exchangeRateApplied: number;
}

export class PayPalSubscriptionOrderResponseDto extends SubscriptionPayPalConfigResponseDto {
  @ApiProperty({ description: 'Created PayPal order id' })
  orderId: string;

  @ApiProperty({ description: 'PayPal order status' })
  status: string;

  @ApiProperty({ description: 'Whether vaulting was requested for the PayPal buyer' })
  vaultRequested: boolean;
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
    payment?: SubscriptionPaymentResponseDto | null;
  };

  @ApiProperty({ description: 'Current perks (either free-tier limits or premium perks)' })
  perks: Record<string, number | boolean>;

  @ApiProperty({ description: 'Current quota usage for the billing period' })
  usage: Record<string, { used: number; limit: number | string }>;
}
