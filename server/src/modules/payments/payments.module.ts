import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EscrowEntity,
  FundingIntentEntity,
  MilestoneEntity,
  PaymentMethodEntity,
  ProjectEntity,
  TransactionEntity,
  UserEntity,
  WalletEntity,
} from '../../database/entities';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentsController } from './payments.controller';
import { WalletController } from './wallet.controller';
import { EscrowReleaseService } from './escrow-release.service';
import { InternalSandboxGateway } from './internal-sandbox.gateway';
import { MilestoneFundingService } from './milestone-funding.service';
import { PaymentMethodsService } from './payment-methods.service';
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
      FundingIntentEntity,
      UserEntity,
    ]),
  ],
  controllers: [WalletController, PaymentMethodsController, PaymentsController],
  providers: [
    WalletService,
    PaymentMethodsService,
    MilestoneFundingService,
    EscrowReleaseService,
    InternalSandboxGateway,
  ],
  exports: [WalletService, PaymentMethodsService, MilestoneFundingService, EscrowReleaseService],
})
export class PaymentsModule {}
