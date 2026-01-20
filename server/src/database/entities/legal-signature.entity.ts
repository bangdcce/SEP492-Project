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

export enum LegalActionType {
  CREATE_DISPUTE = 'CREATE_DISPUTE', // Ký cam kết khi mở kiện
  ACCEPT_SETTLEMENT = 'ACCEPT_SETTLEMENT', // Ký chấp nhận hòa giải
  ACCEPT_VERDICT = 'ACCEPT_VERDICT', // Ký chấp nhận phán quyết
  APPEAL_SUBMISSION = 'APPEAL_SUBMISSION', // Ký đơn kháng cáo
  WITHDRAW_DISPUTE = 'WITHDRAW_DISPUTE', // Ký rút đơn kiện
}

// =============================================================================
// LEGAL SIGNATURE ENTITY (Chữ ký pháp lý / Đồng ý điều khoản)
// =============================================================================

/**
 * Lưu trữ bằng chứng User đã đọc và đồng ý điều khoản.
 * Quan trọng cho việc giải quyết tranh chấp pháp lý ngoài platform.
 */
@Entity('legal_signatures')
@Index(['disputeId', 'signerId'])
export class LegalSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column()
  signerId: string;

  @Column({ comment: 'Role lúc ký' })
  signerRole: string;

  @Column({ type: 'enum', enum: LegalActionType })
  actionType: LegalActionType;

  // === EVIDENCE SNAPSHOT ===
  @Column({ type: 'text', comment: 'Snapshot nội dung điều khoản User đã đọc lúc bấm nút' })
  termsContentSnapshot: string;

  @Column({ type: 'varchar', length: 10, comment: 'Version của điều khoản' })
  termsVersion: string;

  // === REFERENCE (Nếu liên quan đến Settlement/Verdict cụ thể) ===
  @Column({ nullable: true })
  referenceType: string; // 'Settlement', 'Verdict'

  @Column({ nullable: true })
  referenceId: string;

  // === DEVICE FINGERPRINT (Bằng chứng pháp lý) ===
  @Column({ type: 'varchar', length: 45, comment: 'IP Address của User lúc ký' })
  ipAddress: string;

  @Column({ type: 'text', comment: 'Trình duyệt/Thiết bị lúc ký' })
  userAgent: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'Browser fingerprint hash (optional)',
  })
  deviceFingerprint: string;

  @CreateDateColumn({ comment: 'Thời điểm pháp lý có hiệu lực (Immutable)' })
  signedAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'signerId' })
  signer: any;
}
