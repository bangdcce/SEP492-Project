import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserRole } from './user.entity';

/**
 * Dispute Notes Entity
 *
 * Ghi chú trong quá trình xử lý tranh chấp
 * - isInternal = true: Chỉ Admin/Staff thấy (ghi chú nội bộ)
 * - isInternal = false: Tất cả các bên liên quan đều thấy
 */
@Entity('dispute_notes')
export class DisputeNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column()
  authorId: string;

  @Column({ type: 'enum', enum: UserRole })
  authorRole: UserRole;

  @Column({ type: 'text' })
  content: string;

  /**
   * TRUE = Ghi chú nội bộ (Chỉ Admin/Staff thấy)
   * FALSE = Ghi chú công khai (User cũng thấy)
   */
  @Column({ default: false })
  isInternal: boolean;

  /**
   * Đánh dấu note quan trọng
   */
  @Column({ default: false })
  isPinned: boolean;

  /**
   * Loại note
   */
  @Column({ type: 'varchar', length: 50, default: 'GENERAL' })
  noteType: string; // 'GENERAL', 'EVIDENCE_REVIEW', 'DECISION', 'FOLLOW_UP', 'WARNING'

  /**
   * File đính kèm (nếu có)
   */
  @Column({ type: 'jsonb', nullable: true })
  attachments: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', 'notes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: any;
}
