import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user.entity';

/**
 * Represents a subscription plan available on the platform.
 *
 * Each plan targets a specific user role (CLIENT, BROKER, FREELANCER)
 * and defines the perks/limits associated with it.
 *
 * Pricing:
 * - Monthly: 99,000 VND
 * - Quarterly: 252,000 VND (15% discount)
 * - Yearly: 832,000 VND (30% discount)
 */
@Entity('subscription_plans')
export class SubscriptionPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Internal name identifier for the plan.
   * E.g., 'CLIENT_PREMIUM', 'BROKER_PREMIUM', 'FREELANCER_PREMIUM'
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  /**
   * Display name shown to users in the UI.
   * E.g., 'Premium Client', 'Premium Broker', 'Premium Freelancer'
   */
  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  /**
   * Description of the plan benefits.
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Target role for this subscription plan.
   * Only users with matching role can subscribe.
   */
  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'users_role_enum',
  })
  role: UserRole;

  /**
   * Base monthly price in VND.
   * Default: 99,000 VND
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 0,
    default: 99000,
    name: 'price_monthly',
  })
  priceMonthly: number;

  /**
   * Quarterly price in VND (typically 15% discount).
   * Default: 252,000 VND
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 0,
    default: 252000,
    name: 'price_quarterly',
  })
  priceQuarterly: number;

  /**
   * Yearly price in VND (typically 30% discount).
   * Default: 832,000 VND
   */
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 0,
    default: 832000,
    name: 'price_yearly',
  })
  priceYearly: number;

  /**
   * JSON blob defining the perks/limits for premium subscribers.
   *
   * Structure varies by role:
   * - Client: { maxActiveRequests, maxActiveProjects, aiMatchesPerDay, aiCandidatesShown, invitesPerRequest }
   * - Broker: { appliesPerWeek, maxActiveProposals, commissionRate, viewClientBudget, featuredProfile }
   * - Freelancer: { appliesPerWeek, portfolioSlots, cvHighlighted, featuredProfile }
   *
   * Use -1 to indicate unlimited.
   */
  @Column({ type: 'jsonb', default: '{}' })
  perks: Record<string, number | boolean>;

  /**
   * Whether this plan is currently available for new subscriptions.
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  /**
   * Display order for sorting plans in the UI.
   */
  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany('UserSubscriptionEntity', 'plan')
  subscriptions: any[];
}
