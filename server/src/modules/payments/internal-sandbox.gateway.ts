import { Injectable } from '@nestjs/common';
import {
  FundingGateway,
  FundingIntentEntity,
  PaymentMethodEntity,
} from '../../database/entities';
import {
  FundingGatewayContext,
  FundingGatewayResult,
  PaymentGateway,
} from './interfaces/payment-gateway.interface';

@Injectable()
export class InternalSandboxGateway implements PaymentGateway {
  readonly gateway = FundingGateway.INTERNAL_SANDBOX;

  async fund(
    intent: FundingIntentEntity,
    paymentMethod: PaymentMethodEntity,
    context: FundingGatewayContext,
  ): Promise<FundingGatewayResult> {
    return {
      providerReference: `sandbox:${intent.id}:${paymentMethod.id}`,
      nextAction: {
        type: 'NONE',
        message: `Internal sandbox funding completed for milestone ${context.milestoneId}.`,
      },
    };
  }
}
