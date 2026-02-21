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
  TRIAGE_PENDING = 'TRIAGE_PENDING',
  PREVIEW = 'PREVIEW',
  PENDING_REVIEW = 'PENDING_REVIEW',
  INFO_REQUESTED = 'INFO_REQUESTED',
  IN_MEDIATION = 'IN_MEDIATION',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
  REJECTION_APPEALED = 'REJECTION_APPEALED',
  APPEALED = 'APPEALED', // ﾄ紳ng khi蘯ｿu n蘯｡i l蘯｡i
}

export enum DisputeResult {
  PENDING = 'PENDING',
  WIN_CLIENT = 'WIN_CLIENT',
  WIN_FREELANCER = 'WIN_FREELANCER',
  SPLIT = 'SPLIT',
}

export enum DisputeCategory {
  QUALITY = 'QUALITY', // Ch蘯･t lﾆｰ盻｣ng cﾃｴng vi盻㌘ kﾃｩm
  DEADLINE = 'DEADLINE', // Tr盻・deadline
  PAYMENT = 'PAYMENT', // V蘯･n ﾄ黛ｻ・thanh toﾃ｡n
  COMMUNICATION = 'COMMUNICATION', // M蘯･t liﾃｪn l蘯｡c
  SCOPE_CHANGE = 'SCOPE_CHANGE', // Thay ﾄ黛ｻ品 yﾃｪu c蘯ｧu
  FRAUD = 'FRAUD', // L盻ｫa ﾄ黛ｺ｣o
  CONTRACT = 'CONTRACT', // Vi ph蘯｡m h盻｣p ﾄ黛ｻ渡g
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

  // === RAISER (Nguyﾃｪn ﾄ柁｡n) ===
  @Column()
  raisedById: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  raiserRole: UserRole; // Role c盻ｧa ngﾆｰ盻拱 ki盻㌻

  // === DEFENDANT (B盻・ﾄ柁｡n) ===
  @Column()
  defendantId: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  defendantRole: UserRole; // Role c盻ｧa b盻・ﾄ柁｡n

  // === DISPUTE CLASSIFICATION ===
  @Column({ type: 'enum', enum: DisputeType, nullable: true })
  disputeType: DisputeType; // CLIENT_VS_FREELANCER, etc.

  @Column({ type: 'enum', enum: DisputeCategory, nullable: true })
  category: DisputeCategory; // QUALITY, DEADLINE, PAYMENT, etc.

  @Column({ type: 'enum', enum: DisputePriority, default: DisputePriority.MEDIUM })
  priority: DisputePriority;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  disputedAmount: number; // S盻・ti盻］ tranh ch蘯･p

  // === RAISER'S CLAIM ===
  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  messages: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: string[]; // URLs b蘯ｱng ch盻ｩng

  // === DEFENDANT'S RESPONSE ===
  @Column({ type: 'text', nullable: true })
  defendantResponse: string; // L盻拱 gi蘯｣i trﾃｬnh

  @Column({ type: 'jsonb', nullable: true })
  defendantEvidence: string[]; // B蘯ｱng ch盻ｩng ph蘯｣n bﾃ｡c

  @Column({ type: 'timestamp', nullable: true })
  defendantRespondedAt: Date;

  // === DEADLINES & SLA ===
  @Column({ type: 'timestamp', nullable: true })
  responseDeadline: Date; // H蘯｡n b盻・ﾄ柁｡n ph蘯｣n h盻妬 (VD: 7 ngﾃy)

  @Column({ type: 'timestamp', nullable: true })
  resolutionDeadline: Date; // H蘯｡n Admin x盻ｭ lﾃｽ (VD: 14 ngﾃy)

  @Column({ default: false })
  isOverdue: boolean;

  // === PRELIMINARY REVIEW ===
  @Column({ type: 'text', nullable: true })
  triageReason: string;

  @Column({ nullable: true })
  triageActorId: string;

  @Column({ type: 'timestamp', nullable: true })
  triageAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  triagePreviousStatus: string;

  @Column({ type: 'text', nullable: true })
  infoRequestReason: string;

  @Column({ nullable: true })
  infoRequestedById: string;

  @Column({ type: 'timestamp', nullable: true })
  infoRequestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  infoRequestDeadline: Date;

  @Column({ type: 'timestamp', nullable: true })
  infoProvidedAt: Date;

  @Column({ nullable: true })
  previewCompletedById: string;

  @Column({ type: 'timestamp', nullable: true })
  previewCompletedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  dismissalHoldUntil: Date;

  // === MODERATION PHASE ===
  @Column({ type: 'enum', enum: DisputePhase, default: DisputePhase.PRESENTATION })
  phase: DisputePhase;

  // === STATUS & RESULT ===
  @Column({
    type: 'enum',
    enum: DisputeStatus,
    default: DisputeStatus.TRIAGE_PENDING,
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
  adminComment: string; // Public comment (user th蘯･y ﾄ柁ｰ盻｣c)

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
  parentDisputeId: string; // Link dispute con v盻嬖 dispute cha

  @Column({ type: 'uuid', nullable: true })
  groupId: string; // Nhﾃｳm cﾃ｡c dispute cﾃｹng v盻･ vi盻㌘

  // === STAFF ASSIGNMENT & TIER SYSTEM ===
  @Column({ nullable: true, comment: 'Staff ﾄ柁ｰ盻｣c gﾃ｡n x盻ｭ lﾃｽ' })
  assignedStaffId: string;

  @Column({ type: 'timestamp', nullable: true })
  assignedAt: Date;

  @Column({ default: 1, comment: '1 = Staff x盻ｭ lﾃｽ, 2 = Admin phﾃｺc th蘯ｩm' })
  currentTier: number;

  @Column({ nullable: true, comment: 'Admin phﾃｺc th蘯ｩm (n蘯ｿu escalate)' })
  escalatedToAdminId: string;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ type: 'text', nullable: true, comment: 'Lﾃｽ do escalate lﾃｪn Admin' })
  escalationReason: string;

  // === SETTLEMENT LINK ===
  @Column({ nullable: true, comment: 'Settlement ﾄ妥｣ ﾄ柁ｰ盻｣c accept (n蘯ｿu cﾃｳ)' })
  acceptedSettlementId: string;

  // === AUTO-RESOLUTION ===
  @Column({ default: false, comment: 'TRUE = Auto-win do b盻・ﾄ柁｡n khﾃｴng ph蘯｣n h盻妬' })
  isAutoResolved: boolean;

  @Column({ default: 0, comment: 'S盻・l蘯ｧn ﾄ黛ｻ・xu蘯･t hﾃｲa gi蘯｣i b盻・reject (max 3)' })
  settlementAttempts: number;

  // === APPEAL SYSTEM ===
  @Column({ default: false })
  isAppealed: boolean;

  @Column({ type: 'text', nullable: true })
  appealReason: string;

  @Column({ type: 'timestamp', nullable: true })
  appealedAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: 'H蘯｡n khﾃ｡ng cﾃ｡o (3 ngﾃy sau resolve)' })
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


