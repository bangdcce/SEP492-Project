import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EscrowEntity,
  FundingIntentEntity,
  FeeConfigEntity,
  MilestoneEntity,
  PaymentMethodEntity,
  PayoutMethodEntity,
  PayoutRequestEntity,
  ProjectEntity,
  TransactionEntity,
  UserEntity,
  WalletEntity,
} from '../../database/entities';
import { PaymentMethodsController } from './payment-methods.controller';
import { PayoutMethodsController } from './payout-methods.controller';
import { PayoutRequestsController } from './payout-requests.controller';
import { PaymentsController } from './payments.controller';
import { WalletController } from './wallet.controller';
import { CashoutController } from './cashout.controller';
import { EscrowReleaseService } from './escrow-release.service';
import { InternalSandboxGateway } from './internal-sandbox.gateway';
import { MilestoneFundingService } from './milestone-funding.service';
import { PaymentMethodsService } from './payment-methods.service';
import { PayPalCheckoutService } from './pay-pal-checkout.service';
import { PayPalPayoutsGateway } from './pay-pal-payouts.gateway';
import { PayoutMethodsService } from './payout-methods.service';
import { PayoutRequestsService } from './payout-requests.service';
import { RetentionReleaseScheduler } from './retention-release.scheduler';
import { StripeCheckoutService } from './stripe-checkout.service';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      TransactionEntity,
      EscrowEntity,
      MilestoneEntity,
      ProjectEntity,
      PaymentMethodEntity,
      PayoutMethodEntity,
      PayoutRequestEntity,
      FeeConfigEntity,
      FundingIntentEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    WalletController,
    PaymentMethodsController,
    PayoutMethodsController,
    PayoutRequestsController,
    CashoutController,
    PaymentsController,
  ],
  providers: [
    WalletService,
    PaymentMethodsService,
    PayPalCheckoutService,
    PayoutMethodsService,
    PayoutRequestsService,
    MilestoneFundingService,
    EscrowReleaseService,
    InternalSandboxGateway,
    PayPalPayoutsGateway,
    StripeCheckoutService,
    RetentionReleaseScheduler,
  ],
  exports: [
    WalletService,
    PaymentMethodsService,
    PayPalCheckoutService,
    PayoutMethodsService,
    PayoutRequestsService,
    MilestoneFundingService,
    EscrowReleaseService,
    PayPalPayoutsGateway,
    StripeCheckoutService,
  ],
})
export class PaymentsModule {}
