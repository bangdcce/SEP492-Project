import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * All trackable quota actions in the system.
 *
 * These are used by QuotaService to enforce free-tier limits.
 * Each action corresponds to a specific business limitation.
 */
export enum QuotaAction {
  // Client actions
  CREATE_REQUEST = 'CREATE_REQUEST',
  CONVERT_TO_PROJECT = 'CONVERT_TO_PROJECT',
  AI_MATCH_SEARCH = 'AI_MATCH_SEARCH',
  INVITE_BROKER = 'INVITE_BROKER',

  // Broker actions
  APPLY_TO_REQUEST = 'APPLY_TO_REQUEST',
  CREATE_PROPOSAL = 'CREATE_PROPOSAL',

  // Freelancer actions
  APPLY_TO_PROJECT = 'APPLY_TO_PROJECT',
  ADD_PORTFOLIO = 'ADD_PORTFOLIO',
}

/**
 * Tracks daily/weekly quota usage for free-tier users.
 *
 * This table is used by the QuotaService to count how many times
 * a user has performed a specific action within a time window.
 *
 * For daily limits (e.g., AI matches per day):
 *   COUNT WHERE userId=? AND action=? AND date=TODAY
 *
 * For weekly limits (e.g., broker applications per week):
 *   COUNT WHERE userId=? AND action=? AND createdAt > 7_DAYS_AGO
 *
 * Premium users bypass all quota checks entirely.
 */
@Entity('quota_usage_logs')
@Index(['userId', 'action', 'date'])
@Index(['userId', 'action', 'createdAt'])
export class QuotaUsageLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The user who performed the action.
   */
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /**
   * The type of action that was performed.
   */
  @Column({
    type: 'enum',
    enum: QuotaAction,
  })
  action: QuotaAction;

  /**
   * Date of the action (used for daily limit checks).
   * Stored as DATE type (no time component) for efficient grouping.
   */
  @Column({ type: 'date' })
  date: string;

  /**
   * Usage count for this user+action+date combination.
   * Incremented each time the user performs the action on the same day.
   */
  @Column({ type: 'int', default: 1 })
  count: number;

  /**
   * Optional context data (e.g., request ID, project ID).
   * Useful for debugging and audit trails.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
