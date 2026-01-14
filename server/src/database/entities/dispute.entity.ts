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
  IN_MEDIATION = 'IN_MEDIATION',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
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
  LOW = 'LOW', // < 1 triệu VND
  MEDIUM = 'MEDIUM', // 1-10 triệu VND
  HIGH = 'HIGH', // 10-50 triệu VND
  CRITICAL = 'CRITICAL', // > 50 triệu hoặc fraud
}

export enum DisputeType {
  CLIENT_VS_FREELANCER = 'CLIENT_VS_FREELANCER',
  CLIENT_VS_BROKER = 'CLIENT_VS_BROKER',
  FREELANCER_VS_CLIENT = 'FREELANCER_VS_CLIENT',
  FREELANCER_VS_BROKER = 'FREELANCER_VS_BROKER',
  BROKER_VS_CLIENT = 'BROKER_VS_CLIENT',
  BROKER_VS_FREELANCER = 'BROKER_VS_FREELANCER',
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

  // === MULTI-DEFENDANT SUPPORT (Linked Disputes) ===
  @Column({ nullable: true })
  parentDisputeId: string; // Link dispute con với dispute cha

  @Column({ nullable: true })
  groupId: string; // Nhóm các dispute cùng vụ việc

  // === APPEAL SYSTEM ===
  @Column({ default: false })
  isAppealed: boolean;

  @Column({ type: 'text', nullable: true })
  appealReason: string;

  @Column({ type: 'timestamp', nullable: true })
  appealedAt: Date;

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
}
