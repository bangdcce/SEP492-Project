import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user.entity';

// =============================================================================
// ENUMS
// =============================================================================

export enum DisputeStatus {
  OPEN = 'OPEN',
  PENDING_REVIEW = 'PENDING_REVIEW',
  INFO_REQUESTED = 'INFO_REQUESTED',
  IN_MEDIATION = 'IN_MEDIATION',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  REJECTION_APPEALED = 'REJECTION_APPEALED',
  APPEALED = 'APPEALED', // Đang khiếu nại lại
}

export enum DisputeResult {
  PENDING = 'PENDING',
  WIN_CLIENT = 'WIN_CLIENT',
  WIN_FREELANCER = 'WIN_FREELANCER',
  SPLIT = 'SPLIT',
}

export enum DisputeCategory {
  QUALITY = 'QUALITY', // Chất lượng công việc kém
  DEADLINE = 'DEADLINE', // Trễ deadline
  PAYMENT = 'PAYMENT', // Vấn đề thanh toán
  COMMUNICATION = 'COMMUNICATION', // Mất liên lạc
  SCOPE_CHANGE = 'SCOPE_CHANGE', // Thay đổi yêu cầu
  FRAUD = 'FRAUD', // Lừa đảo
  CONTRACT = 'CONTRACT', // Vi phạm hợp đồng
  OTHER = 'OTHER',
}

export enum DisputePriority {
  LOW = 'LOW', // < 50 USD
  MEDIUM = 'MEDIUM', // 50-500 USD
  HIGH = 'HIGH', // 500-2000 USD
  CRITICAL = 'CRITICAL', // > 2000 USD or fraud
}

export enum DisputeType {
  CLIENT_VS_FREELANCER = 'CLIENT_VS_FREELANCER',
  CLIENT_VS_BROKER = 'CLIENT_VS_BROKER',
  FREELANCER_VS_CLIENT = 'FREELANCER_VS_CLIENT',
  FREELANCER_VS_BROKER = 'FREELANCER_VS_BROKER',
  BROKER_VS_CLIENT = 'BROKER_VS_CLIENT',
  BROKER_VS_FREELANCER = 'BROKER_VS_FREELANCER',
}

export enum DisputePhase {
  PRESENTATION = 'PRESENTATION', // Raiser presents claims and evidence
  CROSS_EXAMINATION = 'CROSS_EXAMINATION', // Defendant responds
  INTERROGATION = 'INTERROGATION', // Staff/Admin questions
  DELIBERATION = 'DELIBERATION', // Read-only while reviewing
}

// =============================================================================
// ENTITY
// =============================================================================

@Entity('disputes')
export class DisputeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  milestoneId: string;

  // === RAISER (Nguyên đơn) ===
  @Column()
  raisedById: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  raiserRole: UserRole; // Role của người kiện

  // === DEFENDANT (Bị đơn) ===
  @Column()
  defendantId: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  defendantRole: UserRole; // Role của bị đơn

  // === DISPUTE CLASSIFICATION ===
  @Column({ type: 'enum', enum: DisputeType, nullable: true })
  disputeType: DisputeType; // CLIENT_VS_FREELANCER, etc.

  @Column({ type: 'enum', enum: DisputeCategory, nullable: true })
  category: DisputeCategory; // QUALITY, DEADLINE, PAYMENT, etc.

  @Column({ type: 'enum', enum: DisputePriority, default: DisputePriority.MEDIUM })
  priority: DisputePriority;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disputedAmount: number; // Số tiền tranh chấp

  // === RAISER'S CLAIM ===
  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  messages: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: string[]; // URLs bằng chứng

  // === DEFENDANT'S RESPONSE ===
  @Column({ type: 'text', nullable: true })
  defendantResponse: string; // Lời giải trình

  @Column({ type: 'jsonb', nullable: true })
  defendantEvidence: string[]; // Bằng chứng phản bác

  @Column({ type: 'timestamp', nullable: true })
  defendantRespondedAt: Date;

  // === DEADLINES & SLA ===
  @Column({ type: 'timestamp', nullable: true })
  responseDeadline: Date; // Hạn bị đơn phản hồi (VD: 7 ngày)

  @Column({ type: 'timestamp', nullable: true })
  resolutionDeadline: Date; // Hạn Admin xử lý (VD: 14 ngày)

  @Column({ default: false })
  isOverdue: boolean;

  // === PRELIMINARY REVIEW ===
  @Column({ type: 'text', nullable: true })
  infoRequestReason: string;

  @Column({ nullable: true })
  infoRequestedById: string;

  @Column({ type: 'timestamp', nullable: true })
  infoRequestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  infoProvidedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dismissalHoldUntil: Date;

  // === MODERATION PHASE ===
  @Column({ type: 'enum', enum: DisputePhase, default: DisputePhase.PRESENTATION })
  phase: DisputePhase;

  // === STATUS & RESULT ===
  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  status: DisputeStatus;

  @Column({
    type: 'enum',
    enum: DisputeResult,
    default: DisputeResult.PENDING,
  })
  result: DisputeResult;

  // === RESOLUTION ===
  @Column({ type: 'text', nullable: true })
  adminComment: string; // Public comment (user thấy được)

  @Column({ nullable: true })
  resolvedById: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  // === DISMISSAL APPEAL (REJECTION REVIEW) ===
  @Column({ type: 'text', nullable: true })
  rejectionAppealReason: string;

  @Column({ type: 'timestamp', nullable: true })
  rejectionAppealedAt: Date;

  @Column({ nullable: true })
  rejectionAppealResolvedById: string;

  @Column({ type: 'text', nullable: true })
  rejectionAppealResolution: string;

  @Column({ type: 'timestamp', nullable: true })
  rejectionAppealResolvedAt: Date;

  // === MULTI-DEFENDANT SUPPORT (Linked Disputes) ===
  @Column({ nullable: true })
  parentDisputeId: string; // Link dispute con với dispute cha

  @Column({ nullable: true })
  groupId: string; // Nhóm các dispute cùng vụ việc

  // === STAFF ASSIGNMENT & TIER SYSTEM ===
  @Column({ nullable: true, comment: 'Staff được gán xử lý' })
  assignedStaffId: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date;

  @Column({ default: 1, comment: '1 = Staff xử lý, 2 = Admin phúc thẩm' })
  currentTier: number;

  @Column({ nullable: true, comment: 'Admin phúc thẩm (nếu escalate)' })
  escalatedToAdminId: string;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ type: 'text', nullable: true, comment: 'Lý do escalate lên Admin' })
  escalationReason: string;

  // === SETTLEMENT LINK ===
  @Column({ nullable: true, comment: 'Settlement đã được accept (nếu có)' })
  acceptedSettlementId: string;

  // === AUTO-RESOLUTION ===
  @Column({ default: false, comment: 'TRUE = Auto-win do bị đơn không phản hồi' })
  isAutoResolved: boolean;

  @Column({ default: 0, comment: 'Số lần đề xuất hòa giải bị reject (max 3)' })
  settlementAttempts: number;

  // === APPEAL SYSTEM ===
  @Column({ default: false })
  isAppealed: boolean;

  @Column({ type: 'text', nullable: true })
  appealReason: string;

  @Column({ type: 'timestamp', nullable: true })
  appealedAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: 'Hạn kháng cáo (3 ngày sau resolve)' })
  appealDeadline: Date;

  @Column({ nullable: true })
  appealResolvedById: string;

  @Column({ type: 'text', nullable: true })
  appealResolution: string;

  @Column({ type: 'timestamp', nullable: true })
  appealResolvedAt: Date;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raisedById' })
  raiser: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'defendantId' })
  defendant: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resolvedById' })
  resolvedBy: any;

  @ManyToOne('MilestoneEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: any;

  @ManyToOne('DisputeEntity', { nullable: true })
  @JoinColumn({ name: 'parentDisputeId' })
  parentDispute: DisputeEntity;

  @OneToMany('DisputeNoteEntity', 'dispute')
  notes: any[];

  @OneToMany('DisputeActivityEntity', 'dispute')
  activities: any[];

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedStaffId' })
  assignedStaff: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'escalatedToAdminId' })
  escalatedToAdmin: any;
}
