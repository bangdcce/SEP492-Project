import {
  EscrowStatus,
  FundingGateway,
  PaymentMethodType,
  PayoutMethodType,
  PayoutStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
  WalletStatus,
} from '../../database/entities';

export interface WalletSnapshot {
  id: string;
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  heldBalance: number;
  awaitingReleaseAmount: number;
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

export interface PlatformWalletOwnerView {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface PayPalMerchantBalanceEntryView {
  currency: string;
  totalBalance: number | null;
  availableBalance: number | null;
  pendingBalance: number | null;
}

export interface PayPalMerchantBalanceView {
  provider: 'PAYPAL';
  environment: 'sandbox' | 'live';
  status: 'AVAILABLE' | 'UNAVAILABLE';
  checkedAt: Date;
  message: string | null;
  errorCode: string | null;
  balances: PayPalMerchantBalanceEntryView[];
}

export interface PlatformWalletSnapshotResult {
  owner: PlatformWalletOwnerView;
  wallet: WalletSnapshot;
  merchantBalance: PayPalMerchantBalanceView;
}

export interface PlatformWalletTransactionsResult extends WalletTransactionsResult {
  owner: PlatformWalletOwnerView;
}

export interface PaymentMethodView {
  id: string;
  type: PaymentMethodType;
  displayName: string;
  isDefault: boolean;
  isVerified: boolean;
  canDelete: boolean;
  fastCheckoutReady: boolean;
  vaultStatus: string | null;
  paypalEmail: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardholderName: string | null;
  cardExpiryMonth: number | null;
  cardExpiryYear: number | null;
  bankName: string | null;
  bankCode: string | null;
  branchName: string | null;
  accountNumberMasked: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutMethodView {
  id: string;
  type: PayoutMethodType;
  displayName: string;
  isDefault: boolean;
  isVerified: boolean;
  canDelete: boolean;
  paypalEmail: string | null;
  bankName: string | null;
  bankCode: string | null;
  branchName: string | null;
  accountNumberMasked: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutRequestView {
  id: string;
  walletId: string;
  payoutMethodId: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: PayoutStatus;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  processedAt: Date | null;
  processedBy: string | null;
  externalReference: string | null;
  errorCode: string | null;
  failureReason: string | null;
  transactionId: string | null;
  note: string | null;
  adminNote: string | null;
  requestedAt: Date;
  updatedAt: Date;
  payoutMethod: PayoutMethodView | null;
}

export interface PayoutRequestsResult {
  wallet: WalletSnapshot;
  items: PayoutRequestView[];
  total: number;
  page: number;
  limit: number;
}

export interface CashoutQuoteView {
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  availableBalance: number | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  processingMode: 'PAYPAL_PAYOUTS' | 'SANDBOX_FALLBACK';
  processingDescription: string;
}

export interface PayoutRequestMutationResult {
  request: PayoutRequestView;
  wallet: WalletSnapshot;
}

export interface PayPalCheckoutConfigView {
  clientId: string;
  environment: 'sandbox' | 'live';
  vaultEnabled: boolean;
  userIdToken: string | null;
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

export interface StripeCheckoutSessionView {
  sessionId: string;
  checkoutUrl: string;
}

export interface PayPalMilestoneOrderView {
  orderId: string;
  status: string;
  vaultRequested: boolean;
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

export type EscrowRefundMode = 'INTERNAL_LEDGER' | 'PAYPAL_CAPTURE_REFUND';

export interface EscrowRefundResult {
  milestoneId: string;
  escrowId: string;
  escrowStatus: EscrowStatus;
  refundedAmount: number;
  refundMode: EscrowRefundMode;
  externalRefundReference: string | null;
  creditedToInternalWallet: boolean;
  clientWalletSnapshot: WalletSnapshot;
  refundTransactionId: string;
}
