// src/database/entities/transaction.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { numericTransformer } from '../transformers/column-numeric.transformer';

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  REFUND = 'REFUND',
  FEE_DEDUCTION = 'FEE_DEDUCTION',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('transactions')
@Index(['walletId', 'createdAt'])
@Index(['type', 'status'])
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  walletId: string;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  fee: number; // Phí giao dịch (nếu có)

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  netAmount: number; // amount - fee (số tiền thực nhận)

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  // === REFERENCE (Polymorphic) ===
  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType: string; // 'Escrow', 'PayoutRequest', 'Milestone'

  @Column({ type: 'uuid', nullable: true })
  referenceId: string;

  // === EXTERNAL PAYMENT INFO ===
  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod: string; // 'BANK_TRANSFER', 'MOMO', 'VNPAY'

  @Column({ type: 'varchar', nullable: true })
  externalTransactionId: string; // ID từ payment gateway

  // === METADATA (Flexible storage) ===
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  // === AUDIT TRAIL ===
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  balanceAfter: number; // Wallet balance after this transaction

  @Column({ type: 'varchar', length: 50, nullable: true })
  initiatedBy: string; // 'user' | 'admin' | 'system'

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string; // For security audit

  @Column({ type: 'uuid', nullable: true })
  relatedTransactionId: string; // Link paired transactions (HOLD ↔ RELEASE)

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('WalletEntity', 'transactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: any;
}
