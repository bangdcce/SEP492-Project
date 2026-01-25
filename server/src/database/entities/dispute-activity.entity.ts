import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserRole } from './user.entity';

/**
 * Dispute Activity Actions
 */
export enum DisputeAction {
  // Lifecycle
  CREATED = 'CREATED',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  REVIEW_ACCEPTED = 'REVIEW_ACCEPTED',
  INFO_REQUESTED = 'INFO_REQUESTED',
  INFO_PROVIDED = 'INFO_PROVIDED',
  REJECTION_APPEALED = 'REJECTION_APPEALED',
  REJECTION_APPEAL_RESOLVED = 'REJECTION_APPEAL_RESOLVED',
  REOPENED = 'REOPENED',

  // Evidence & Response
  EVIDENCE_ADDED = 'EVIDENCE_ADDED',
  EVIDENCE_REMOVED = 'EVIDENCE_REMOVED',
  DEFENDANT_RESPONDED = 'DEFENDANT_RESPONDED',
  DEFENDANT_EVIDENCE_ADDED = 'DEFENDANT_EVIDENCE_ADDED',

  // Admin Actions
  NOTE_ADDED = 'NOTE_ADDED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
  CATEGORY_CHANGED = 'CATEGORY_CHANGED',
  ASSIGNED = 'ASSIGNED',
  DEADLINE_EXTENDED = 'DEADLINE_EXTENDED',

  // Appeal
  APPEAL_SUBMITTED = 'APPEAL_SUBMITTED',
  APPEAL_RESOLVED = 'APPEAL_RESOLVED',

  // Communication
  MESSAGE_SENT = 'MESSAGE_SENT',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
}

/**
 * Dispute Activity Entity
 *
 * Lưu trữ timeline/lịch sử hoạt động của dispute
 * Giúp Admin và User theo dõi tiến trình xử lý
 */
@Entity('dispute_activities')
export class DisputeActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({ nullable: true })
  actorId: string; // Người thực hiện hành động (null = system)

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  actorRole: UserRole;

  @Column({ type: 'enum', enum: DisputeAction })
  action: DisputeAction;

  /**
   * Mô tả ngắn gọn về hoạt động
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  /**
   * Metadata bổ sung (VD: old value, new value, file URLs, etc.)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /**
   * Có phải là hoạt động nội bộ không (chỉ Admin/Staff thấy)
   */
  @Column({ default: false })
  isInternal: boolean;

  @CreateDateColumn()
  timestamp: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', 'activities', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor: any;
}
