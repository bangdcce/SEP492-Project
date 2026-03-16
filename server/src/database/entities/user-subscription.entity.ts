import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { SubscriptionPlanEntity } from './subscription-plan.entity';

/**
 * Billing cycle options for subscriptions.
 */
export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

/**
 * Subscription lifecycle status.
 *
 * ACTIVE     – Currently active, user has premium perks.
 * CANCELLED  – User requested cancellation; remains active until period end.
 * EXPIRED    – Subscription period has ended without renewal.
 * SUSPENDED  – Temporarily suspended (e.g., payment failure).
 */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Represents a user's subscription to a premium plan.
 *
 * Business rules:
 * - Each user can have at most one active subscription (UNIQUE on user_id).
 * - When cancelled, the subscription stays ACTIVE until current_period_end.
 * - cancel_at_period_end = true means "don't renew, but keep perks until period ends".
 * - Expired subscriptions are cleaned up by a scheduled cron job.
 */
@Entity('user_subscriptions')
@Unique(['userId'])
export class UserSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The user who owns this subscription.
   */
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /**
   * The plan this subscription is for.
   */
  @Column({ type: 'uuid', name: 'plan_id' })
  planId: string;

  /**
   * Current subscription status.
   */
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  /**
   * Selected billing cycle determines pricing and period length.
   */
  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
    name: 'billing_cycle',
  })
  billingCycle: BillingCycle;

  /**
   * Start of the current billing period.
   */
  @Column({
    type: 'timestamp',
    name: 'current_period_start',
  })
  currentPeriodStart: Date;

  /**
   * End of the current billing period.
   * After this date, subscription expires unless renewed.
   */
  @Column({
    type: 'timestamp',
    name: 'current_period_end',
  })
  currentPeriodEnd: Date;

  /**
   * If true, the subscription will NOT auto-renew at period end.
   * Used for UC-41 (Cancel Subscription) — soft cancel.
   * User keeps premium perks until current_period_end.
   */
  @Column({
    type: 'boolean',
    default: false,
    name: 'cancel_at_period_end',
  })
  cancelAtPeriodEnd: boolean;

  /**
   * Reason provided by user when cancelling (optional).
   */
  @Column({ type: 'text', nullable: true, name: 'cancel_reason' })
  cancelReason: string;

  /**
   * Timestamp when cancellation was requested.
   */
  @Column({ type: 'timestamp', nullable: true, name: 'cancelled_at' })
  cancelledAt: Date;

  /**
   * Total amount paid for the current billing cycle in VND.
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 0,
    default: 0,
    name: 'amount_paid',
  })
  amountPaid: number;

  /**
   * Payment method or reference (for future payment integration).
   */
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'payment_reference' })
  paymentReference: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => SubscriptionPlanEntity, (plan) => plan.subscriptions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlanEntity;
}
