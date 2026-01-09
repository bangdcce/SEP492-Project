// src/modules/disputes/interfaces/resolution.interface.ts

import { DisputeResult } from 'src/database/entities';

export interface MoneyDistribution {
  clientAmount: number;
  freelancerAmount: number;
  brokerAmount: number;
  platformFee: number;
  totalAmount: number;
}

export interface TransferDetail {
  toUserId: string;
  toWalletId: string;
  amount: number;
  type: 'REFUND' | 'RELEASE' | 'FEE';
  description: string;
}

export interface ResolutionResult {
  disputeId: string;
  verdict: DisputeResult;
  moneyDistribution: MoneyDistribution;
  transfers: TransferDetail[];
  loserId: string | null;
  winnerId: string | null;
  penaltyApplied: boolean;
  projectStatusUpdated: string;
  milestoneStatusUpdated: string;
  escrowStatusUpdated: string;
  trustScoreUpdated: {
    userId: string;
    oldScore: number;
    newScore: number;
  } | null;
  resolvedAt: Date;
  adminId: string;
}

export interface DisputeResolvedEvent {
  disputeId: string;
  projectId: string;
  verdict: DisputeResult;
  clientId: string;
  freelancerId: string;
  brokerId: string | null;
  loserId: string | null;
  winnerId: string | null;
  moneyDistribution: MoneyDistribution;
  adminComment: string;
  adminId: string;
  resolvedAt: Date;
}
