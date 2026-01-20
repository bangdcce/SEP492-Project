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

// =============================================================================
// ENUMS
// =============================================================================

export enum SettlementStatus {
  PENDING = 'PENDING', // Đang chờ bên kia phản hồi
  ACCEPTED = 'ACCEPTED', // Đã đồng ý -> Trigger chia tiền
  REJECTED = 'REJECTED', // Đã từ chối -> Quay lại negotiation
  EXPIRED = 'EXPIRED', // Quá 24-48h không phản hồi
  CANCELLED = 'CANCELLED', // Người tạo tự hủy đề xuất
}

// =============================================================================
// DISPUTE SETTLEMENT ENTITY (Đề xuất hòa giải)
// =============================================================================

/**
 * Lưu trữ các đề xuất hòa giải giữa 2 bên.
 * Tổng amountToFreelancer + amountToClient PHẢI = Escrow.fundedAmount
 */
@Entity('dispute_settlements')
@Index(['disputeId', 'status'])
export class DisputeSettlementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({ comment: 'Người đưa ra đề xuất hòa giải' })
  proposerId: string;

  @Column({ comment: 'Role của người đề xuất' })
  proposerRole: string;

  // === MONEY LOGIC ===
  @Column('decimal', { precision: 15, scale: 2, comment: 'Tiền chia cho Freelancer' })
  amountToFreelancer: number;

  @Column('decimal', { precision: 15, scale: 2, comment: 'Tiền trả lại Client' })
  amountToClient: number;

  @Column('decimal', {
    precision: 15,
    scale: 2,
    default: 0,
    comment: 'Phí platform (nếu có - tính từ amountToFreelancer)',
  })
  platformFee: number;

  // === SETTLEMENT TERMS ===
  @Column({ type: 'text', nullable: true, comment: 'Điều kiện/ghi chú kèm theo đề xuất' })
  terms: string;

  // === STATUS ===
  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.PENDING })
  status: SettlementStatus;

  // === RESPONSE ===
  @Column({ nullable: true, comment: 'Người phản hồi (bên còn lại)' })
  responderId: string;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date;

  @Column({ type: 'text', nullable: true, comment: 'Lý do từ chối (nếu rejected)' })
  rejectedReason: string;

  // === EXPIRY ===
  @Column({ type: 'timestamp', nullable: true, comment: 'Thời hạn phản hồi (24-48h)' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn({ comment: 'Thời điểm chốt deal (Dùng để log Transaction)' })
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'proposerId' })
  proposer: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'responderId' })
  responder: any;
}
