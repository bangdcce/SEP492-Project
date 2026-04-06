import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FundingGateway, UserEntity } from '../../database/entities';
import { GetUser, JwtAuthGuard } from '../auth';
import {
  CompletePayPalMilestoneDto,
  CompleteStripeMilestoneDto,
  CreatePayPalMilestoneOrderDto,
  CreateStripeCheckoutSessionDto,
  FundMilestoneDto,
  ReleaseRetentionDto,
} from './dto';
import { EscrowReleaseService } from './escrow-release.service';
import { MilestoneFundingService } from './milestone-funding.service';
import { PayPalCheckoutService } from './pay-pal-checkout.service';
import { StripeCheckoutService } from './stripe-checkout.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('payments')
export class PaymentsController {
  constructor(
    private readonly milestoneFundingService: MilestoneFundingService,
    private readonly payPalCheckoutService: PayPalCheckoutService,
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly escrowReleaseService: EscrowReleaseService,
  ) {}

  @Get('paypal/config')
  @ApiOperation({
    summary:
      'Return client-side PayPal checkout configuration, including Vault tokens when available',
  })
  async getPayPalConfig(
    @GetUser() user: UserEntity,
    @Query('paymentMethodId') paymentMethodId?: string,
  ) {
    return {
      success: true,
      data: await this.payPalCheckoutService.getSdkConfigForUser(user.id, paymentMethodId),
    };
  }

  @Get('stripe/config')
  @ApiOperation({
    summary: 'Return client-side Stripe Checkout availability for test-mode card funding',
  })
  getStripeConfig() {
    return {
      success: true,
      data: this.stripeCheckoutService.getClientConfig(),
    };
  }

  @Post('milestones/:milestoneId/fund')
  @ApiOperation({ summary: 'Fund a milestone escrow exactly once with full funding only' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique client-generated key used to deduplicate funding attempts.',
  })
  async fundMilestone(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: FundMilestoneDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return {
      success: true,
      data: await this.milestoneFundingService.fundMilestone({
        milestoneId,
        payerId: user.id,
        paymentMethodId: dto.paymentMethodId,
        gateway: dto.gateway,
        idempotencyKey,
      }),
    };
  }

  @Post('milestones/:milestoneId/paypal/capture')
  @ApiOperation({
    summary: 'Complete a real PayPal sandbox capture and sync it into milestone escrow',
  })
  async completePayPalCapture(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: CompletePayPalMilestoneDto,
  ) {
    return {
      success: true,
      data: await this.milestoneFundingService.completePayPalMilestoneFunding({
        milestoneId,
        payerId: user.id,
        paymentMethodId: dto.paymentMethodId,
        gateway: FundingGateway.PAYPAL,
        orderId: dto.orderId,
        order: dto.order,
      }),
    };
  }

  @Post('milestones/:milestoneId/paypal/order')
  @ApiOperation({
    summary: 'Create a PayPal order for milestone funding and request vaulting when eligible',
  })
  async createPayPalMilestoneOrder(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: CreatePayPalMilestoneOrderDto,
  ) {
    return {
      success: true,
      data: await this.milestoneFundingService.createPayPalMilestoneOrder({
        milestoneId,
        payerId: user.id,
        paymentMethodId: dto.paymentMethodId,
        gateway: FundingGateway.PAYPAL,
        source: dto.source,
        returnUrl: dto.returnUrl,
        cancelUrl: dto.cancelUrl,
      }),
    };
  }

  @Post('milestones/:milestoneId/stripe/checkout-session')
  @ApiOperation({ summary: 'Create a Stripe Checkout Session for card-based milestone funding' })
  async createStripeCheckoutSession(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: CreateStripeCheckoutSessionDto,
  ) {
    return {
      success: true,
      data: await this.milestoneFundingService.createStripeMilestoneCheckoutSession({
        milestoneId,
        payerId: user.id,
        paymentMethodId: dto.paymentMethodId,
        gateway: FundingGateway.STRIPE,
        returnUrl: dto.returnUrl,
      }),
    };
  }

  @Post('milestones/:milestoneId/stripe/complete')
  @ApiOperation({
    summary: 'Verify a completed Stripe Checkout Session and sync it into milestone escrow',
  })
  async completeStripeCheckout(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: CompleteStripeMilestoneDto,
  ) {
    return {
      success: true,
      data: await this.milestoneFundingService.completeStripeMilestoneFunding({
        milestoneId,
        payerId: user.id,
        paymentMethodId: dto.paymentMethodId,
        gateway: FundingGateway.STRIPE,
        sessionId: dto.sessionId,
      }),
    };
  }

  @Post('milestones/:milestoneId/release-retention')
  @ApiOperation({
    summary:
      'Release milestone retention hold to recipients after warranty or via authorized manual override',
  })
  async releaseRetention(
    @GetUser() user: UserEntity,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: ReleaseRetentionDto,
  ) {
    return {
      success: true,
      data: await this.escrowReleaseService.releaseRetentionForMilestone(milestoneId, user.id, {
        releasedByRole: user.role,
        bypassWarranty: dto.bypassWarranty,
        reason: dto.reason,
      }),
    };
  }
}
