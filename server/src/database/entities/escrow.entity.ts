// src/database/entities/escrow.entity.ts

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

export enum EscrowStatus {
  PENDING = 'PENDING',
  FUNDED = 'FUNDED',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}

@Entity('escrows')
@Index(['milestoneId'], { unique: true }) // 1 Milestone = 1 Escrow
@Index(['projectId'])
export class EscrowEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  milestoneId: string; // Quan trọng: Link với Milestone, không phải Project

  // === TIỀN ===
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount: number; // Tổng tiền cần hold

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  fundedAmount: number; // Tiền đã nạp

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  releasedAmount: number; // Tiền đã giải ngân

  // === SNAPSHOT PHÍ (Immutable - quan trọng!) ===
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: numericTransformer,
  })
  developerShare: number; // Số tiền Developer nhận (85%)

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  brokerShare: number; // Số tiền Broker nhận (10%)

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  platformFee: number; // Phí Platform (5%)

  // Lưu % tại thời điểm tạo (để trace)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 85 })
  developerPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  brokerPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  platformPercentage: number;

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    default: EscrowStatus.PENDING,
  })
  status: EscrowStatus;

  // === TIMESTAMPS ===
  @Column({ type: 'timestamp', nullable: true })
  fundedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt: Date;

  // === CLIENT APPROVAL ===
  @Column({ default: false })
  clientApproved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  clientApprovedAt: Date;

  // === WALLET LINKS (Direct reference for efficiency) ===
  @Column({ type: 'uuid', nullable: true })
  clientWalletId: string;

  @Column({ type: 'uuid', nullable: true })
  developerWalletId: string;

  @Column({ type: 'uuid', nullable: true })
  brokerWalletId: string;

  // === TRANSACTION LINKS ===
  @Column({ type: 'uuid', nullable: true })
  holdTransactionId: string; // Transaction(ESCROW_HOLD)

  @Column({ type: 'jsonb', nullable: true })
  releaseTransactionIds: string[]; // Array of Transaction(ESCROW_RELEASE)

  @Column({ type: 'uuid', nullable: true })
  refundTransactionId: string; // Transaction(REFUND) if disputed

  // === DISPUTE LINK ===
  @Column({ type: 'uuid', nullable: true })
  disputeId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('MilestoneEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: any;

  @ManyToOne('DisputeEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;
}
