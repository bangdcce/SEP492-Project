import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

// =============================================================================
// ENUMS
// =============================================================================

export enum HearingStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  RESCHEDULED = 'RESCHEDULED',
}

export enum HearingStatementType {
  OPENING = 'OPENING', // Lời khai mở đầu
  EVIDENCE = 'EVIDENCE', // Trình bày bằng chứng
  REBUTTAL = 'REBUTTAL', // Phản bác
  CLOSING = 'CLOSING', // Kết luận
  QUESTION = 'QUESTION', // Câu hỏi từ Admin
  ANSWER = 'ANSWER', // Trả lời
}

export enum HearingParticipantRole {
  RAISER = 'RAISER',
  DEFENDANT = 'DEFENDANT',
  WITNESS = 'WITNESS',
  MODERATOR = 'MODERATOR',
  OBSERVER = 'OBSERVER', // Bên thứ 3 liên quan (e.g., broker khi client vs freelancer)
}

// =============================================================================
// DISPUTE HEARING ENTITY (Phiên điều trần)
// =============================================================================

@Entity('dispute_hearings')
export class DisputeHearingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({
    type: 'enum',
    enum: HearingStatus,
    default: HearingStatus.SCHEDULED,
  })
  status: HearingStatus;

  @Column({ type: 'timestamp' })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'text', nullable: true })
  agenda: string; // Nội dung cần thảo luận

  @Column({ nullable: true })
  meetingLink: string; // Link Google Meet/Zoom (optional)

  @Column({ type: 'jsonb', nullable: true })
  requiredDocuments: string[]; // Tài liệu yêu cầu chuẩn bị

  @Column()
  moderatorId: string; // Admin chủ trì

  // === SUMMARY (sau khi kết thúc) ===
  @Column({ type: 'text', nullable: true })
  summary: string; // Tóm tắt phiên điều trần

  @Column({ type: 'text', nullable: true })
  findings: string; // Những phát hiện quan trọng

  @Column({ type: 'jsonb', nullable: true })
  pendingActions: string[]; // Các việc cần làm tiếp

  @Column({ default: 1 })
  hearingNumber: number; // Phiên thứ mấy (có thể có nhiều phiên)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'moderatorId' })
  moderator: any;

  @OneToMany('HearingParticipantEntity', 'hearing')
  participants: HearingParticipantEntity[];

  @OneToMany('HearingStatementEntity', 'hearing')
  statements: HearingStatementEntity[];

  @OneToMany('HearingQuestionEntity', 'hearing')
  questions: HearingQuestionEntity[];
}

// =============================================================================
// HEARING PARTICIPANT ENTITY (Người tham gia)
// =============================================================================

@Entity('hearing_participants')
export class HearingParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hearingId: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: HearingParticipantRole,
  })
  role: HearingParticipantRole;

  @Column({ type: 'timestamp', nullable: true })
  invitedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date; // Xác nhận tham gia

  @Column({ type: 'timestamp', nullable: true })
  joinedAt: Date; // Thực tế vào phiên

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ default: false })
  hasSubmittedStatement: boolean; // Đã nộp lời khai chưa

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeHearingEntity', 'participants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hearingId' })
  hearing: DisputeHearingEntity;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}

// =============================================================================
// HEARING STATEMENT ENTITY (Lời khai / Bằng chứng)
// =============================================================================

@Entity('hearing_statements')
export class HearingStatementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hearingId: string;

  @Column()
  participantId: string;

  @Column({
    type: 'enum',
    enum: HearingStatementType,
  })
  type: HearingStatementType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[]; // URLs của file đính kèm

  @Column({ nullable: true })
  replyToStatementId: string; // Nếu là phản bác statement trước

  @Column({ default: 0 })
  orderIndex: number; // Thứ tự trong phiên

  @Column({ default: false })
  isRedacted: boolean; // Bị admin ẩn vì không phù hợp

  @Column({ type: 'text', nullable: true })
  redactedReason: string;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeHearingEntity', 'statements', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hearingId' })
  hearing: DisputeHearingEntity;

  @ManyToOne('HearingParticipantEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant: HearingParticipantEntity;

  @ManyToOne('HearingStatementEntity', { nullable: true })
  @JoinColumn({ name: 'replyToStatementId' })
  replyToStatement: HearingStatementEntity;
}

// =============================================================================
// HEARING QUESTION ENTITY (Câu hỏi từ Admin)
// =============================================================================

@Entity('hearing_questions')
export class HearingQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hearingId: string;

  @Column()
  askedById: string; // Admin đặt câu hỏi

  @Column()
  targetUserId: string; // Người cần trả lời

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ type: 'timestamp', nullable: true })
  answeredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date; // Hạn trả lời

  @Column({ default: false })
  isRequired: boolean; // Bắt buộc trả lời trước khi kết phiên

  @Column({ default: 0 })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeHearingEntity', 'questions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hearingId' })
  hearing: DisputeHearingEntity;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'askedById' })
  askedBy: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: any;
}
