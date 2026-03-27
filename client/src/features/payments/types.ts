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

export type PaymentMethodType = "PAYPAL_ACCOUNT" | "CARD_ACCOUNT" | "BANK_ACCOUNT";
export type PayoutMethodType = "PAYPAL_EMAIL" | "BANK_ACCOUNT";

export type FundingGateway = "INTERNAL_SANDBOX" | "PAYPAL" | "STRIPE";

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

export interface PlatformWalletOwner {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "STAFF";
}

export interface PayPalMerchantBalanceEntry {
  currency: string;
  totalBalance: number | null;
  availableBalance: number | null;
  pendingBalance: number | null;
}

export interface PayPalMerchantBalance {
  provider: "PAYPAL";
  environment: "sandbox" | "live";
  status: "AVAILABLE" | "UNAVAILABLE";
  checkedAt: string;
  message: string | null;
  errorCode: string | null;
  balances: PayPalMerchantBalanceEntry[];
}

export interface PlatformWalletSnapshotResult {
  owner: PlatformWalletOwner;
  wallet: WalletSnapshot;
  merchantBalance: PayPalMerchantBalance;
}

export interface PlatformWalletTransactionsResult extends WalletTransactionsResult {
  owner: PlatformWalletOwner;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export type PayoutRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED";

export interface PayoutRequestView {
  id: string;
  walletId: string;
  payoutMethodId: string;
  payoutMethod: PayoutMethodView | null;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: PayoutRequestStatus;
  note: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
  processedBy: string | null;
  externalReference: string | null;
  errorCode: string | null;
  failureReason: string | null;
  transactionId: string | null;
  adminNote: string | null;
  requestedAt: string;
  updatedAt: string;
}

export interface PayoutRequestsResult {
  wallet: WalletSnapshot;
  items: PayoutRequestView[];
  total: number;
  page: number;
  limit: number;
}

export interface CashoutQuote {
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  availableBalance: number | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  processingMode: "PAYPAL_PAYOUTS" | "SANDBOX_FALLBACK";
  processingDescription: string;
}

export interface DeletePaymentMethodResult {
  deletedId: string;
  nextDefaultMethodId: string | null;
}

export interface PayPalCheckoutConfig {
  clientId: string;
  environment: "sandbox" | "live";
  vaultEnabled: boolean;
  userIdToken: string | null;
}

export interface PayPalMilestoneOrder {
  orderId: string;
  status: string;
  vaultRequested: boolean;
}

export interface StripeCheckoutConfig {
  enabled: boolean;
  environment: "test";
}

export interface StripeCheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export interface CreatePaymentMethodInput {
  type: PaymentMethodType;
  displayName?: string;
  paypalEmail?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardholderName?: string;
  cardExpiryMonth?: number;
  cardExpiryYear?: number;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountHolderName?: string;
  branchName?: string;
  isDefault?: boolean;
}

export interface CreatePayoutMethodInput {
  type: PayoutMethodType;
  displayName?: string;
  paypalEmail?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountHolderName?: string;
  branchName?: string;
  isDefault?: boolean;
}

export interface CreatePayoutRequestInput {
  payoutMethodId: string;
  amount: number;
  note?: string;
}

export interface PayoutRequestMutationResult {
  request: PayoutRequestView;
  wallet: WalletSnapshot;
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
