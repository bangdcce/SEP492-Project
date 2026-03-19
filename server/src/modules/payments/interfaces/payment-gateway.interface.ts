import {
  FundingGateway,
  FundingIntentEntity,
  PaymentMethodEntity,
} from '../../../database/entities';

export interface FundingGatewayContext {
  milestoneId: string;
  escrowId: string;
  projectId: string;
  currency: string;
  amount: number;
}

export interface FundingGatewayResult {
  providerReference: string;
  nextAction: Record<string, unknown> | null;
}

export interface PaymentGateway {
  readonly gateway: FundingGateway;

  fund(
    intent: FundingIntentEntity,
    paymentMethod: PaymentMethodEntity,
    context: FundingGatewayContext,
  ): Promise<FundingGatewayResult>;
}
