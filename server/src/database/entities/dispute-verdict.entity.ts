import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

// =============================================================================
// ENUMS
// =============================================================================

export enum FaultType {
  NON_DELIVERY = 'NON_DELIVERY', // Không giao hàng
  QUALITY_MISMATCH = 'QUALITY_MISMATCH', // Chất lượng không đạt yêu cầu
  DEADLINE_MISSED = 'DEADLINE_MISSED', // Trễ deadline
  GHOSTING = 'GHOSTING', // Biến mất không liên lạc
  SCOPE_CHANGE_CONFLICT = 'SCOPE_CHANGE_CONFLICT', // Tranh cãi về thay đổi scope
  PAYMENT_ISSUE = 'PAYMENT_ISSUE', // Vấn đề thanh toán
  FRAUD = 'FRAUD', // Lừa đảo
  MUTUAL_FAULT = 'MUTUAL_FAULT', // Cả hai bên đều có lỗi
  NO_FAULT = 'NO_FAULT', // Không bên nào có lỗi (hiểu lầm)
  OTHER = 'OTHER',
}

// =============================================================================
// DISPUTE VERDICT ENTITY (Phán quyết)
// =============================================================================

/**
 * Phán quyết cuối cùng của Staff/Admin cho dispute.
 * Mỗi dispute chỉ có 1 verdict có hiệu lực (có thể bị override bởi appeal)
 */
@Entity('dispute_verdicts')
export class DisputeVerdictEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({ comment: 'Staff/Admin ra phán quyết' })
  adjudicatorId: string;

  @Column({ comment: 'Role của người phán quyết (STAFF/ADMIN)' })
  adjudicatorRole: string;

  // === DECISION ===
  @Column({ type: 'enum', enum: FaultType, comment: 'Lỗi thuộc về nhóm nào?' })
  faultType: FaultType;

  @Column({ comment: 'Bên bị xác định có lỗi chính (raiser/defendant/both/none)' })
  faultyParty: string;

  @Column({
    type: 'jsonb',
    comment:
      'Lý do phán quyết có cấu trúc (violatedPolicies, supportingEvidenceIds, factualFindings, legalAnalysis, conclusion)',
  })
  reasoning: {
    violatedPolicies: string[];
    supportingEvidenceIds?: string[];
    factualFindings: string;
    legalAnalysis: string;
    conclusion: string;
  };

  // === MONEY SPLIT ===
  @Column('decimal', { precision: 15, scale: 2, comment: 'Tiền chia cho Freelancer' })
  amountToFreelancer: number;

  @Column('decimal', { precision: 15, scale: 2, comment: 'Tiền trả lại Client' })
  amountToClient: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  platformFee: number;

  // === PENALTY ===
  @Column({ default: 0, comment: 'Điểm Trust Score bị trừ (0-100)' })
  trustScorePenalty: number;

  @Column({ default: false, comment: 'Cấm user này hoạt động tạm thời?' })
  isBanTriggered: boolean;

  @Column({ type: 'int', default: 0, comment: 'Số ngày bị cấm (nếu ban)' })
  banDurationDays: number;

  @Column({ type: 'text', nullable: true, comment: 'Cảnh cáo gửi cho bên có lỗi' })
  warningMessage: string;

  // === TIER INFO ===
  @Column({ default: 1, comment: 'Tier 1 = Staff, Tier 2 = Admin (Appeal)' })
  tier: number;

  @Column({ default: false, comment: 'TRUE = Đây là phán quyết override từ Admin' })
  isAppealVerdict: boolean;

  @Column({ nullable: true, comment: 'Verdict ID bị override (nếu là appeal verdict)' })
  overridesVerdictId: string;

  @CreateDateColumn({ comment: 'Thời điểm ra phán quyết' })
  issuedAt: Date;

  // === RELATIONS ===
  @OneToOne('DisputeEntity')
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adjudicatorId' })
  adjudicator: any;

  @ManyToOne('DisputeVerdictEntity', { nullable: true })
  @JoinColumn({ name: 'overridesVerdictId' })
  overridesVerdict: DisputeVerdictEntity;
}
