Cái này 
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum PaymentMethodType {
  BANK_ACCOUNT = 'bank_account',
  CREDIT_CARD = 'credit_card',
  MOMO = 'momo',
  VNPAY = 'vnpay',
  ZALOPAY = 'zalopay',
}

export enum PaymentMethodStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  type: PaymentMethodType;

  @Column({
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.PENDING,
  })
  status: PaymentMethodStatus;

  // Encrypted sensitive data
  @Column({ name: 'account_number_encrypted', nullable: true })
  accountNumberEncrypted: string;

  @Column({ name: 'account_number_last4', length: 4, nullable: true })
  accountNumberLast4: string;

  @Column({ name: 'account_holder_name', nullable: true })
  accountHolderName: string;

  @Column({ name: 'bank_code', nullable: true })
  bankCode: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'branch_name', nullable: true })
  branchName: string;

  // For e-wallets
  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { PaymentMethod } from './payment-method.entity';

export enum DepositStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum DepositMethod {
  BANK_TRANSFER = 'bank_transfer',
  MOMO = 'momo',
  VNPAY = 'vnpay',
  ZALOPAY = 'zalopay',
  CREDIT_CARD = 'credit_card',
}

@Entity('deposits')
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId: string;

  @ManyToOne(() => PaymentMethod, { nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fee: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 15, scale: 2 })
  netAmount: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: DepositMethod,
  })
  method: DepositMethod;

  @Column({
    type: 'enum',
    enum: DepositStatus,
    default: DepositStatus.PENDING,
  })
  status: DepositStatus;

  // External payment gateway reference
  @Column({ name: 'external_transaction_id', nullable: true })
  externalTransactionId: string;

  @Column({ name: 'payment_gateway', nullable: true })
  paymentGateway: string;

  @Column({ name: 'payment_url', nullable: true })
  paymentUrl: string;

  // For bank transfer
  @Column({ name: 'transfer_content', nullable: true })
  transferContent: string;

  @Column({ name: 'bank_reference', nullable: true })
  bankReference: string;

  // Timestamps
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt: Date;

  @Column({ name: 'failure_reason', nullable: true })
  failureReason: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { PaymentMethod } from './payment-method.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'payment_method_id' })
  paymentMethodId: string;

  @ManyToOne(() => PaymentMethod)
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  fee: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 15, scale: 2 })
  netAmount: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  // Bank transfer details
  @Column({ name: 'bank_account_number', nullable: true })
  bankAccountNumber: string;

  @Column({ name: 'bank_account_name', nullable: true })
  bankAccountName: string;

  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'bank_branch', nullable: true })
  bankBranch: string;

  // Processing info
  @Column({ name: 'processed_by', nullable: true })
  processedBy: string;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ name: 'bank_reference', nullable: true })
  bankReference: string;

  // Approval/Rejection
  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejected_by', nullable: true })
  rejectedBy: string;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Escrow } from './escrow.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

export enum EscrowTransactionType {
  FUND = 'fund', // Client nạp tiền vào escrow
  RELEASE = 'release', // Release tiền cho dev
  REFUND = 'refund', // Hoàn tiền cho client
  BROKER_FEE = 'broker_fee', // Phí broker
  PLATFORM_FEE = 'platform_fee', // Phí platform
  PARTIAL_RELEASE = 'partial_release', // Release một phần
  DISPUTE_HOLD = 'dispute_hold', // Giữ tiền khi có tranh chấp
  DISPUTE_RELEASE = 'dispute_release', // Release sau khi giải quyết tranh chấp
}

@Entity('escrow_transactions')
export class EscrowTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'escrow_id' })
  escrowId: string;

  @ManyToOne(() => Escrow)
  @JoinColumn({ name: 'escrow_id' })
  escrow: Escrow;

  @Column({
    type: 'enum',
    enum: EscrowTransactionType,
  })
  type: EscrowTransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  // Bên gửi (nullable nếu là nạp từ ngoài)
  @Column({ name: 'from_wallet_id', nullable: true })
  fromWalletId: string;

  @ManyToOne(() => Wallet, { nullable: true })
  @JoinColumn({ name: 'from_wallet_id' })
  fromWallet: Wallet;

  // Bên nhận (nullable nếu là rút ra ngoài)
  @Column({ name: 'to_wallet_id', nullable: true })
  toWalletId: string;

  @ManyToOne(() => Wallet, { nullable: true })
  @JoinColumn({ name: 'to_wallet_id' })
  toWallet: Wallet;

  // User thực hiện giao dịch
  @Column({ name: 'performed_by' })
  performedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  performer: User;

  // Reference đến transaction chính (nếu có)
  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { User } from './user.entity';

export enum FeeType {
  BROKER_COMMISSION = 'broker_commission', // Hoa hồng broker
  PLATFORM_FEE = 'platform_fee', // Phí nền tảng
  TRANSACTION_FEE = 'transaction_fee', // Phí giao dịch
  WITHDRAWAL_FEE = 'withdrawal_fee', // Phí rút tiền
}

export enum FeeStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
  REFUNDED = 'refunded',
}

@Entity('platform_fees')
export class PlatformFee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id', nullable: true })
  contractId: string;

  @ManyToOne(() => Contract, { nullable: true })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  // User bị tính phí
  @Column({ name: 'charged_to_user_id' })
  chargedToUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'charged_to_user_id' })
  chargedToUser: User;

  // Broker nhận hoa hồng (nếu là broker_commission)
  @Column({ name: 'broker_id', nullable: true })
  brokerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'broker_id' })
  broker: User;

  @Column({
    type: 'enum',
    enum: FeeType,
  })
  type: FeeType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'fee_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  feePercentage: number;

  @Column({ name: 'base_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  baseAmount: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: FeeStatus,
    default: FeeStatus.PENDING,
  })
  status: FeeStatus;

  @Column({ name: 'collected_at', type: 'timestamp', nullable: true })
  collectedAt: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { Milestone } from './milestone.entity';
import { Escrow } from './escrow.entity';

export enum AllocationStatus {
  PLANNED = 'planned', // Đã lên kế hoạch
  FUNDED = 'funded', // Đã có tiền trong escrow
  PARTIALLY_RELEASED = 'partially_released', // Đã release một phần
  RELEASED = 'released', // Đã release hết
  CANCELLED = 'cancelled', // Đã hủy
}

@Entity('fund_allocations')
export class FundAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'milestone_id', nullable: true })
  milestoneId: string;

  @ManyToOne(() => Milestone, { nullable: true })
  @JoinColumn({ name: 'milestone_id' })
  milestone: Milestone;

  @Column({ name: 'escrow_id', nullable: true })
  escrowId: string;

  @ManyToOne(() => Escrow, { nullable: true })
  @JoinColumn({ name: 'escrow_id' })
  escrow: Escrow;

  // Số tiền phân bổ cho dev
  @Column({ name: 'developer_amount', type: 'decimal', precision: 15, scale: 2 })
  developerAmount: number;

  // Hoa hồng broker
  @Column({ name: 'broker_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  brokerAmount: number;

  // Phí platform
  @Column({ name: 'platform_fee', type: 'decimal', precision: 15, scale: 2, default: 0 })
  platformFee: number;

  // Tổng tiền cần từ client
  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: AllocationStatus,
    default: AllocationStatus.PLANNED,
  })
  status: AllocationStatus;

  // Số tiền đã release cho dev
  @Column({ name: 'released_to_developer', type: 'decimal', precision: 15, scale: 2, default: 0 })
  releasedToDeveloper: number;

  // Số tiền đã trả cho broker
  @Column({ name: 'released_to_broker', type: 'decimal', precision: 15, scale: 2, default: 0 })
  releasedToBroker: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';

export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Số dư khả dụng (có thể rút)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  // Số dư đang chờ (pending từ escrow release)
  @Column({ name: 'pending_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
  pendingBalance: number;

  // Số dư đang bị giữ (trong escrow hoặc dispute)
  @Column({ name: 'held_balance', type: 'decimal', precision: 15, scale: 2, default: 0 })
  heldBalance: number;

  // Tổng số tiền đã nạp
  @Column({ name: 'total_deposited', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeposited: number;

  // Tổng số tiền đã rút
  @Column({ name: 'total_withdrawn', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalWithdrawn: number;

  // Tổng thu nhập (cho freelancer)
  @Column({ name: 'total_earned', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalEarned: number;

  // Tổng chi tiêu (cho client)
  @Column({ name: 'total_spent', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSpent: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  // Giới hạn rút tiền hàng ngày
  @Column({ name: 'daily_withdrawal_limit', type: 'decimal', precision: 15, scale: 2, nullable: true })
  dailyWithdrawalLimit: number;

  // Số tiền đã rút trong ngày
  @Column({ name: 'daily_withdrawn', type: 'decimal', precision: 15, scale: 2, default: 0 })
  dailyWithdrawn: number;

  @Column({ name: 'daily_withdrawn_reset_at', type: 'timestamp', nullable: true })
  dailyWithdrawnResetAt: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.wallet)
  transactions: Transaction[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Contract } from './contract.entity';
import { Milestone } from './milestone.entity';
import { EscrowTransaction } from './escrow-transaction.entity';

export enum EscrowStatus {
  PENDING = 'pending', // Chờ client nạp tiền
  FUNDED = 'funded', // Đã có tiền
  PARTIALLY_FUNDED = 'partially_funded', // Nạp một phần
  IN_PROGRESS = 'in_progress', // Đang thực hiện công việc
  PENDING_RELEASE = 'pending_release', // Chờ approve release
  PARTIALLY_RELEASED = 'partially_released', // Đã release một phần
  RELEASED = 'released', // Đã release hết
  DISPUTED = 'disputed', // Đang tranh chấp
  REFUNDED = 'refunded', // Đã hoàn tiền
  CANCELLED = 'cancelled', // Đã hủy
}

@Entity('escrows')
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'milestone_id', nullable: true })
  milestoneId: string;

  @ManyToOne(() => Milestone, { nullable: true })
  @JoinColumn({ name: 'milestone_id' })
  milestone: Milestone;

  // Tổng số tiền cần giữ
  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  // Số tiền đã nạp vào escrow
  @Column({ name: 'funded_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  fundedAmount: number;

  // Số tiền đã release cho developer
  @Column({ name: 'released_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  releasedAmount: number;

  // Số tiền đã trả cho broker
  @Column({ name: 'broker_released_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  brokerReleasedAmount: number;

  // Số tiền đã refund cho client
  @Column({ name: 'refunded_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  refundedAmount: number;

  // Phí platform đã thu
  @Column({ name: 'platform_fee_collected', type: 'decimal', precision: 15, scale: 2, default: 0 })
  platformFeeCollected: number;

  @Column({ length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING,
  })
  status: EscrowStatus;

  // Phân bổ tiền
  @Column({ name: 'developer_share', type: 'decimal', precision: 15, scale: 2 })
  developerShare: number;

  @Column({ name: 'broker_share', type: 'decimal', precision: 15, scale: 2, default: 0 })
  brokerShare: number;

  @Column({ name: 'platform_fee', type: 'decimal', precision: 15, scale: 2, default: 0 })
  platformFee: number;

  // Fee percentages
  @Column({ name: 'broker_fee_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  brokerFeePercentage: number;

  @Column({ name: 'platform_fee_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  platformFeePercentage: number;

  // Timestamps
  @Column({ name: 'funded_at', type: 'timestamp', nullable: true })
  fundedAt: Date;

  @Column({ name: 'released_at', type: 'timestamp', nullable: true })
  releasedAt: Date;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt: Date;

  @Column({ name: 'disputed_at', type: 'timestamp', nullable: true })
  disputedAt: Date;

  // Release conditions
  @Column({ name: 'auto_release_date', type: 'timestamp', nullable: true })
  autoReleaseDate: Date;

  @Column({ name: 'requires_client_approval', default: true })
  requiresClientApproval: boolean;

  @Column({ name: 'client_approved', default: false })
  clientApproved: boolean;

  @Column({ name: 'client_approved_at', type: 'timestamp', nullable: true })
  clientApprovedAt: Date;

  // Dispute info
  @Column({ name: 'dispute_id', nullable: true })
  disputeId: string;

  @OneToMany(() => EscrowTransaction, (et) => et.escrow)
  escrowTransactions: EscrowTransaction[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTERDEV MONEY FLOW                                   │
│                     (1 Dev - 1 Broker - 1 Client)                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     Deposit      ┌──────────┐     Fund Escrow    ┌──────────┐
│  BANK/   │ ───────────────► │  CLIENT  │ ─────────────────► │  ESCROW  │
│  E-WALLET│                  │  WALLET  │                    │  ACCOUNT │
└──────────┘                  └──────────┘                    └──────────┘
                                                                    │
                                                                    │ Milestone Complete
                                                                    │ + Client Approve
                                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FUND DISTRIBUTION                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  Total Escrow: 100,000,000 VND                                          │ │
│  │  ├── Developer Share: 85,000,000 VND (85%)                              │ │
│  │  ├── Broker Commission: 10,000,000 VND (10%)                            │ │
│  │  └── Platform Fee: 5,000,000 VND (5%)                                   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
             ┌──────────┐         ┌──────────┐         ┌──────────┐
             │   DEV    │         │  BROKER  │         │ PLATFORM │
             │  WALLET  │         │  WALLET  │         │  WALLET  │
             └──────────┘         └──────────┘         └──────────┘
                    │                    │
                    ▼                    ▼
             ┌──────────┐         ┌──────────┐
             │ Withdraw │         │ Withdraw │
             │ to Bank  │         │ to Bank  │
             └──────────┘         └──────────┘

với cái đề xuất này

1. EscrowAccountEntity - Tài khoản ký quỹ
Vấn đề: Hiện tại không có entity riêng cho escrow. Tiền được hold trực tiếp từ wallet client nhưng không có "bể chứa" trung gian.

@Entity('escrow_accounts')
export class EscrowAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  projectId: string;  // Mỗi project có 1 escrow riêng
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeposited: number;  // Tổng tiền client đã nạp
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalReleased: number;  // Tổng đã giải ngân cho freelancer
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  platformFee: number;  // Phí platform (%)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  brokerFee: number;  // Phí broker (%)
  @Column({ type: 'enum', enum: EscrowStatus, default: 'ACTIVE' })
  status: EscrowStatus;  // ACTIVE, CLOSED, DISPUTED
  @CreateDateColumn()
  createdAt: Date;
}
export enum EscrowStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED',
}
2. BankAccountEntity - Tài khoản ngân hàng liên kết
Vấn đề: Không có entity lưu thông tin tài khoản ngân hàng để nạp/rút tiền.

@Entity('bank_accounts')
export class BankAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  userId: string;
  @Column({ type: 'varchar', length: 100 })
  bankName: string;  // Vietcombank, Techcombank, ...
  @Column({ type: 'varchar', length: 50 })
  bankCode: string;  // VCB, TCB, ...
  @Column({ type: 'varchar', length: 30 })
  accountNumber: string;  // Số tài khoản
  @Column({ type: 'varchar', length: 255 })
  accountHolder: string;  // Tên chủ tài khoản
  @Column({ type: 'varchar', length: 20, nullable: true })
  branch: string;  // Chi nhánh (optional)
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;  // Tài khoản mặc định để rút
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;  // Đã xác thực (qua test transfer)
  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;
  @CreateDateColumn()
  createdAt: Date;
}
3. DepositRequestEntity - Yêu cầu nạp tiền
Vấn đề: Có 
PayoutRequestEntity
 cho rút tiền nhưng không có entity theo dõi nạp tiền.

@Entity('deposit_requests')
export class DepositRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  walletId: string;
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;
  @Column({ type: 'enum', enum: DepositStatus })
  status: DepositStatus;  // PENDING, PROCESSING, COMPLETED, FAILED, EXPIRED
  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;  // BANK_TRANSFER, MOMO, VNPAY, ZALOPAY
  @Column({ type: 'varchar', nullable: true })
  externalTransactionId: string;  // ID từ cổng thanh toán
  @Column({ type: 'varchar', nullable: true })
  paymentUrl: string;  // URL redirect đến cổng thanh toán
  @Column({ type: 'timestamp', nullable: true })
  expiredAt: Date;  // Thời gian hết hạn thanh toán
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;  // Thông tin bổ sung từ payment gateway
  @CreateDateColumn()
  requestedAt: Date;
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
export enum DepositStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}
4. FeeConfigEntity - Cấu hình phí hoa hồng
Vấn đề: Không có entity lưu cấu hình phí platform và broker commission.

@Entity('fee_configs')
export class FeeConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'varchar', length: 50 })
  feeType: string;  // PLATFORM_FEE, BROKER_COMMISSION, PAYMENT_GATEWAY_FEE
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage: number;  // 5.00 = 5%
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  minAmount: number;  // Phí tối thiểu
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  maxAmount: number;  // Phí tối đa (cap)
  @Column({ type: 'boolean', default: true })
  isActive: boolean;
  @Column({ type: 'timestamp', nullable: true })
  effectiveFrom: Date;
  @Column({ type: 'timestamp', nullable: true })
  effectiveTo: Date;
  @CreateDateColumn()
  createdAt: Date;
}
📊 Flow Dòng Tiền Cần Hỗ Trợ
Flow 1: Client Nạp Tiền vào Ví
Client → DepositRequest → Payment Gateway → Webhook → Transaction(DEPOSIT) → Wallet.balance++
Entities cần: DepositRequestEntity ❌, 
TransactionEntity
 ✅, 
WalletEntity
 ✅

Flow 2: Client Đặt Cọc Escrow cho Dự Án
Client.Wallet.balance-- → Transaction(HOLD) → EscrowAccount → MilestonePayment.holdTransactionId
Entities cần: EscrowAccountEntity ❌, 
MilestonePaymentEntity
 ✅, 
TransactionEntity
 ✅

Flow 3: Giải Ngân Milestone cho Freelancer
EscrowAccount -- → Transaction(RELEASE) → [Freelancer.Wallet.balance++, Broker.Wallet.balance++, Platform.fee]
Entities cần: EscrowAccountEntity ❌, FeeConfigEntity ❌, 
TransactionEntity
 ✅

Flow 4: Freelancer/Broker Rút Tiền
Wallet.balance-- → Transaction(WITHDRAWAL) → PayoutRequest → Admin Approve → BankAccount
Entities cần: BankAccountEntity ❌, 
PayoutRequestEntity
 ✅, 
TransactionEntity
 ✅

Flow 5: Refund khi Dispute
EscrowAccount → Transaction(REFUND) → Client.Wallet.balance++
Entities cần: EscrowAccountEntity ❌, 
DisputeEntity
 ✅, 
TransactionEntity
 ✅

✅ Khuyến Nghị
Cần tạo mới:
EscrowAccountEntity - Quản lý tiền ký quỹ theo project
BankAccountEntity - Liên kết tài khoản ngân hàng
DepositRequestEntity - Theo dõi nạp tiền
FeeConfigEntity - Cấu hình phí hoa hồng
Cần bổ sung vào entity hiện có:
TransactionEntity
 - Thêm các field:
@Column({ type: 'varchar', nullable: true })
escrowId: string;  // Link transaction với escrow account
@Column({ type: 'varchar', nullable: true })
description: string;  // Mô tả giao dịch
@Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
fee: number;  // Phí giao dịch (nếu có)
@Column({ type: 'varchar', nullable: true })
fromWalletId: string;  // Ví nguồn (cho transfer giữa 2 ví)
@Column({ type: 'varchar', nullable: true })
toWalletId: string;  // Ví đích
WalletEntity
 - Thêm:
@Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
pendingBalance: number;  // Tiền đang chờ xử lý (withdrawal pending)
@Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
lockedBalance: number;  // Tiền bị lock (đang trong escrow)
🔄 Tóm Tắt
Tính năng	Hiện tại	Cần làm
Ví tiền cơ bản	✅	Thêm pendingBalance, lockedBalance
Nạp tiền	❌	Tạo DepositRequestEntity
Rút tiền	✅	Đã có PayoutRequestEntity
Liên kết bank	❌	Tạo BankAccountEntity
Escrow	❌	Tạo EscrowAccountEntity
Phí hoa hồng	❌	Tạo FeeConfigEntity
Transaction	✅	Bổ sung fields
Milestone payment	✅	Đã có
Kết luận: Cần tạo thêm 4 entities mới và bổ sung fields cho 2 entities hiện có để có flow tài chính hoàn chỉnh.

Hãy cho tôi biết là 2dđề xuất này của 2 ai đề xuất thì cái nào là chuẩn và hiệu quả hơn không bị outscope dự án và phù hợp với 1 đồ án