import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

// =============================================================================
// ENUMS
// =============================================================================

export enum MessageType {
  TEXT = 'TEXT', // Chat chữ bình thường
  IMAGE = 'IMAGE', // Gửi ảnh trực tiếp vào khung chat
  FILE = 'FILE', // Gửi file PDF/Zip
  EVIDENCE_LINK = 'EVIDENCE_LINK', // Link tới một bằng chứng đã upload (Quote bằng chứng)
  SYSTEM_LOG = 'SYSTEM_LOG', // "Admin đã tham gia", "Đã bắt đầu phiên"
  SETTLEMENT_PROPOSAL = 'SETTLEMENT_PROPOSAL', // Card đề xuất hòa giải
  ADMIN_ANNOUNCEMENT = 'ADMIN_ANNOUNCEMENT', // Thông báo từ Admin/Staff
}

// =============================================================================
// DISPUTE MESSAGE ENTITY (Rich Chat - WORM Compliance)
// =============================================================================

/**
 * Tin nhắn trong phòng chat tranh chấp.
 * ⚠️ WORM: Không có updatedAt, deletedAt (không được edit/delete)
 * Chỉ Admin được "soft hide" tin nhắn vi phạm
 */
@Entity('dispute_messages')
@Index(['disputeId', 'createdAt'])
@Index(['senderId', 'createdAt'])
export class DisputeMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  // === NGƯỜI GỬI ===
  @Column({ nullable: true, comment: 'User ID (null = System message)' })
  senderId: string;

  @Column({ comment: 'Role lúc gửi: CLIENT/FREELANCER/BROKER/STAFF/ADMIN/SYSTEM' })
  senderRole: string;

  // === NỘI DUNG CHAT ===
  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'text', nullable: true, comment: 'Nội dung chat text' })
  content: string;

  // === TÍNH NĂNG REPLY / QUOTE (Giống Zalo/Messenger) ===
  @Column({ nullable: true, comment: 'Reply tin nhắn nào?' })
  replyToMessageId: string;

  // === TÍNH NĂNG ĐỐI CHẤT BẰNG CHỨNG (Evidence Rebuttal) ===
  @Column({ nullable: true, comment: 'Tin nhắn này đang bàn luận về bằng chứng nào?' })
  relatedEvidenceId: string;

  // === HEARING CONTEXT (Nếu chat trong phiên điều trần) ===
  @Column({ nullable: true, comment: 'Phiên điều trần (nếu chat trong hearing)' })
  hearingId: string;

  // === RICH METADATA (Dữ liệu động cho các loại tin đặc biệt) ===
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
  /*
    Ví dụ metadata:
    - Nếu type = IMAGE: { storagePath: '...', width: 800, height: 600 }
    - Nếu type = SETTLEMENT_PROPOSAL: { settlementId: 'uuid-123', amount: 5000000 }
    - Nếu type = SYSTEM_LOG: { action: 'USER_JOINED', userId: '...' }
  */

  // === MODERATION (Admin ẩn tin nhắn vi phạm) ===
  @Column({ default: false, comment: 'Admin ẩn tin nhắn này' })
  isHidden: boolean;

  @Column({ type: 'text', nullable: true })
  hiddenReason: string;

  @Column({ nullable: true })
  hiddenById: string;

  @Column({ type: 'timestamp', nullable: true })
  hiddenAt: Date;

  // ⚠️ Không có updatedAt, deletedAt (WORM Compliance)
  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: any;

  @ManyToOne('DisputeMessageEntity', { nullable: true })
  @JoinColumn({ name: 'replyToMessageId' })
  replyToMessage: DisputeMessageEntity;

  @ManyToOne('DisputeEvidenceEntity', { nullable: true })
  @JoinColumn({ name: 'relatedEvidenceId' })
  relatedEvidence: any;

  @ManyToOne('DisputeHearingEntity', { nullable: true })
  @JoinColumn({ name: 'hearingId' })
  hearing: any;
}
