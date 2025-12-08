/**
 * PAYMENT & WALLET ENTITIES
 */

import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';

@Entity('wallets')
@Index(['userId'], { unique: true })
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 10, default: 'VND' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @OneToMany('TransactionEntity', 'wallet')
  transactions: any[];
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  HOLD = 'HOLD',
  RELEASE = 'RELEASE',
  REFUND = 'REFUND',
  WITHDRAWAL = 'WITHDRAWAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

@Entity('transactions')
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  walletId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string;

  @Column({ type: 'varchar', nullable: true })
  referenceId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('WalletEntity', 'transactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: any;
}

@Entity('milestone_payments')
export class MilestonePaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  milestoneId: string;

  @Column({ nullable: true })
  holdTransactionId: string;

  @Column({ nullable: true })
  releaseTransactionId: string;

  @ManyToOne('MilestoneEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: any;

  @ManyToOne('TransactionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'holdTransactionId' })
  holdTransaction: any;

  @ManyToOne('TransactionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'releaseTransactionId' })
  releaseTransaction: any;
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

@Entity('payout_requests')
export class PayoutRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  walletId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.PENDING,
  })
  status: PayoutStatus;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ nullable: true })
  processedBy: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne('WalletEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'processedBy' })
  processor: any;
}

@Entity('platform_settings')
export class PlatformSettingsEntity {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ nullable: true })
  updatedBy: string;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updater: any;
}

/**
 * TRUST & DISPUTE ENTITIES
 */

export enum DisputeStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

@Entity('disputes')
export class DisputeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  raisedBy: string;

  @Column()
  against: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  resolution: string;

  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raisedBy' })
  raiser: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'against' })
  defendant: any;
}

@Entity('trust_score_history')
export class TrustScoreHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  ratingScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  behaviorScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  disputeScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  verificationScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  totalScore: number;

  @CreateDateColumn()
  calculatedAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}

@Entity('user_flags')
export class UserFlagEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'int', default: 1 })
  severity: number;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}

@Entity('reviews')
@Index(['projectId', 'reviewerId', 'targetUserId'], { unique: true })
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  reviewerId: string;

  @Column()
  targetUserId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  weight: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: any;
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

@Entity('verification_documents')
export class VerificationDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  docType: string;

  @Column({ type: 'varchar' })
  documentUrl: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @CreateDateColumn()
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column({ type: 'text', nullable: true })
  rejectReason: string;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'verifiedBy' })
  verifier: any;
}

/**
 * NOTIFICATION & AUDIT ENTITIES
 */

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date;

  @Column({ type: 'varchar', nullable: true })
  relatedType: string;

  @Column({ type: 'varchar', nullable: true })
  relatedId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  actorId: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  entityType: string;

  @Column({ type: 'varchar' })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  beforeData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  afterData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actorId' })
  actor: any;
}
