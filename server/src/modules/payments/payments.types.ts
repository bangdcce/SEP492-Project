import {
  EscrowStatus,
  FundingGateway,
  PaymentMethodType,
  TransactionStatus,
  TransactionType,
  WalletStatus,
} from '../../database/entities';

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
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionItem {
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
  createdAt: Date;
  completedAt: Date | null;
}

export interface WalletTransactionsResult {
  wallet: WalletSnapshot;
  items: WalletTransactionItem[];
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
  createdAt: Date;
  updatedAt: Date;
}

export interface FundingTransactionsView {
  depositTransactionId: string;
  holdTransactionId: string;
}

export interface MilestoneFundingResult {
  fundingIntentId: string;
  milestoneId: string;
  escrowId: string;
  escrowStatus: EscrowStatus;
  walletSnapshot: WalletSnapshot;
  transactions: FundingTransactionsView;
  nextAction: Record<string, unknown> | null;
  gateway: FundingGateway;
}

export interface MilestoneReleaseRecipientView {
  userId: string;
  walletId: string;
  amount: number;
  role: 'CLIENT' | 'FREELANCER' | 'BROKER' | 'PLATFORM';
  transactionId: string;
}

export interface MilestoneReleaseResult {
  milestoneId: string;
  escrowId: string;
  escrowStatus: EscrowStatus;
  releasedAmount: number;
  clientWalletSnapshot: WalletSnapshot;
  releaseTransactionIds: string[];
  recipients: MilestoneReleaseRecipientView[];
}
