// src/database/entities/payout-request.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { numericTransformer } from '../transformers/column-numeric.transformer';

export enum PayoutStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('payout_requests')
@Index(['walletId', 'requestedAt'])
@Index(['status', 'requestedAt'])
export class PayoutRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  walletId: string;

  // === CRITICAL: Link to bank account ===
  @Column()
  payoutMethodId: string;

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
  fee: number; // Withdrawal fee

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: numericTransformer,
  })
  netAmount: number; // amount - fee (số tiền user nhận được)

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.PENDING,
  })
  status: PayoutStatus;

  // === APPROVAL WORKFLOW ===
  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejectedBy: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  // === PROCESSING ===
  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  processedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  externalReference: string | null; // Bank transfer reference number

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  // === LINK TO TRANSACTION ===
  @Column({ type: 'uuid', nullable: true })
  transactionId: string | null; // Link to Transaction(WITHDRAWAL) when created

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn()
  requestedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('WalletEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: any;

  @ManyToOne('PayoutMethodEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payoutMethodId' })
  payoutMethod: any;

  @ManyToOne('TransactionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transactionId' })
  transaction: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approver: any;

}
