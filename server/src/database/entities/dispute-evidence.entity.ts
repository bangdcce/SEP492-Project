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
// DISPUTE EVIDENCE ENTITY (Bằng chứng - WORM Compliance)
// =============================================================================

/**
 * Lưu trữ bằng chứng cho tranh chấp.
 * ⚠️ WORM (Write Once Read Many): Không có updatedAt, deletedAt
 * File trên Supabase Bucket cũng phải set policy cấm delete.
 */
@Entity('dispute_evidences')
@Index(['disputeId', 'uploadedAt'])
export class DisputeEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({ comment: 'Người upload bằng chứng' })
  uploaderId: string;

  @Column({ comment: 'Role của người upload lúc đó (CLIENT/FREELANCER/STAFF/ADMIN)' })
  uploaderRole: string;

  // === STORAGE INFO (SUPABASE BUCKET) ===
  @Column({
    type: 'varchar',
    length: 500,
    comment: 'Đường dẫn file trong Supabase Bucket (e.g., disputes/uuid/file.png)',
  })
  storagePath: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'Tên file gốc người dùng upload (để hiển thị trên UI)',
  })
  fileName: string;

  @Column({ type: 'int', comment: 'Dung lượng file tính bằng bytes' })
  fileSize: number;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'MIME Type chi tiết (image/jpeg, application/pdf...)',
  })
  mimeType: string;

  // === METADATA ===
  @Column({
    type: 'varchar',
    length: 1000,
    nullable: true,
    comment: 'Mô tả ngắn cho bằng chứng (Caption)',
  })
  description: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'SHA-256 hash để verify integrity',
  })
  fileHash: string;

  // === SECURITY & MODERATION ===
  @Column({ default: false, comment: 'TRUE = Admin ẩn do nhạy cảm (Soft Hide)' })
  isFlagged: boolean;

  @Column({
    type: 'varchar',
    length: 1000,
    nullable: true,
    comment: 'Lý do bị ẩn (VD: Mã độc, Ảnh fake)',
  })
  flagReason: string;

  @Column({ nullable: true, comment: 'Admin/Staff đã flag' })
  flaggedById: string;

  @Column({ type: 'timestamp', nullable: true })
  flaggedAt: Date;

  // ⚠️ QUAN TRỌNG: Không có cột updatedAt, deletedAt (WORM Compliance)
  @CreateDateColumn({ comment: 'Thời điểm upload bằng chứng (Immutable)' })
  uploadedAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'flaggedById' })
  flaggedBy: any;
}
