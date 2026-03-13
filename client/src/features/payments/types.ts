export type WalletStatus = "ACTIVE" | "FROZEN" | "SUSPENDED";

export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "ESCROW_HOLD"
  | "ESCROW_RELEASE"
  | "REFUND"
  | "FEE_DEDUCTION";

export type TransactionStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type PaymentMethodType = "PAYPAL_ACCOUNT" | "BANK_ACCOUNT";

export type FundingGateway = "INTERNAL_SANDBOX" | "PAYPAL";

export type EscrowStatus =
  | "PENDING"
  | "FUNDED"
  | "RELEASED"
  | "REFUNDED"
  | "DISPUTED";

export interface WalletSnapshot {
  id: string;
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  heldBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalEarned: number;
  totalSpent: number;
  currency: string;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  fee: number;
  netAmount: number | null;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  referenceType: string | null;
  referenceId: string | null;
  paymentMethod: string | null;
  externalTransactionId: string | null;
  balanceAfter: number | null;
  description: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  relatedTransactionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WalletTransactionsResult {
  wallet: WalletSnapshot;
  items: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentMethodView {
  id: string;
  type: PaymentMethodType;
  displayName: string;
  isDefault: boolean;
  isVerified: boolean;
  paypalEmail: string | null;
  bankName: string | null;
  accountNumberMasked: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodInput {
  type: PaymentMethodType;
  displayName?: string;
  paypalEmail?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountHolderName?: string;
  branchName?: string;
  isDefault?: boolean;
}

export interface MilestoneEscrowSummary {
  id: string;
  status: EscrowStatus;
  totalAmount: number;
  fundedAmount: number;
  releasedAmount: number;
  developerShare: number;
  brokerShare: number;
  platformFee: number;
  currency: string;
  fundedAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  updatedAt: string;
}

export interface MilestoneFundingResult {
  fundingIntentId: string;
  milestoneId: string;
  escrowId: string;
  escrowStatus: EscrowStatus;
  walletSnapshot: WalletSnapshot;
  transactions: {
    depositTransactionId: string;
    holdTransactionId: string;
  };
  nextAction: Record<string, unknown> | null;
  gateway: FundingGateway;
}
