import { PayoutMethodEntity, PayoutRequestEntity } from '../../../database/entities';

export interface PayoutGatewayContext {
  currency: string;
  amount: number;
  fee: number;
  netAmount: number;
  note?: string | null;
}

export interface PayoutGatewayResult {
  providerReference: string;
  nextAction: Record<string, unknown> | null;
  sandboxFallback: boolean;
}

export interface PayoutGateway {
  payout(
    payoutRequest: PayoutRequestEntity,
    payoutMethod: PayoutMethodEntity,
    context: PayoutGatewayContext,
  ): Promise<PayoutGatewayResult>;
}
