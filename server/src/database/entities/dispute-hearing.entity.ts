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
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  RESCHEDULED = 'RESCHEDULED',
}

export enum HearingStatementType {
  OPENING = 'OPENING', // L盻拱 khai m盻・ﾄ黛ｺｧu
  EVIDENCE = 'EVIDENCE', // Trﾃｬnh bﾃy b蘯ｱng ch盻ｩng
  REBUTTAL = 'REBUTTAL', // Ph蘯｣n bﾃ｡c
  CLOSING = 'CLOSING', // K蘯ｿt lu蘯ｭn
  QUESTION = 'QUESTION', // Cﾃ｢u h盻淑 t盻ｫ Admin
  ANSWER = 'ANSWER', // Tr蘯｣ l盻拱
  WITNESS_TESTIMONY = 'WITNESS_TESTIMONY', // L盻拱 khai nhﾃ｢n ch盻ｩng
  OBJECTION = 'OBJECTION', // Ph蘯｣n ﾄ柁訴
  SURREBUTTAL = 'SURREBUTTAL', // Ph蘯｣n bﾃ｡c l蘯ｧn 2
}

export enum HearingStatementStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

export type HearingStatementContentBlockKind =
  | 'SUMMARY'
  | 'FACTS'
  | 'EVIDENCE_BASIS'
  | 'ANALYSIS'
  | 'REMEDY'
  | 'ATTESTATION'
  | 'CUSTOM';

export interface HearingStatementContentBlock {
  id?: string;
  kind: HearingStatementContentBlockKind;
  heading?: string | null;
  body: string;
}

export interface HearingStatementVersionSnapshot {
  versionNumber: number;
  savedAt: string;
  status: HearingStatementStatus;
  title?: string | null;
  content: string;
  attachments?: string[] | null;
  citedEvidenceIds?: string[] | null;
  structuredContent?: HearingStatementContentBlock[] | null;
  changeSummary?: string | null;
}

export enum HearingQuestionStatus {
  PENDING_ANSWER = 'PENDING_ANSWER',
  ANSWERED = 'ANSWERED',
  CANCELLED_BY_MODERATOR = 'CANCELLED_BY_MODERATOR',
}

export enum HearingParticipantRole {
  RAISER = 'RAISER',
  DEFENDANT = 'DEFENDANT',
  WITNESS = 'WITNESS',
  MODERATOR = 'MODERATOR',
  OBSERVER = 'OBSERVER', // Bﾃｪn th盻ｩ 3 liﾃｪn quan (e.g., broker khi client vs freelancer)
}

// Enum cho Live Chat - Ai ﾄ柁ｰ盻｣c quy盻］ chat hi盻㌻ t蘯｡i
export enum SpeakerRole {
  ALL = 'ALL', // M盻絞 ngﾆｰ盻拱 ﾄ黛ｻ「 ﾄ柁ｰ盻｣c chat
  MODERATOR_ONLY = 'MODERATOR_ONLY', // Ch盻・Staff/Admin (Tuyﾃｪn ﾃ｡n/Khai m蘯｡c)
  RAISER_ONLY = 'RAISER_ONLY', // Ch盻・Nguyﾃｪn ﾄ柁｡n trﾃｬnh bﾃy
  DEFENDANT_ONLY = 'DEFENDANT_ONLY', // Ch盻・B盻・ﾄ柁｡n trﾃｬnh bﾃy
  WITNESS_ONLY = 'WITNESS_ONLY', // Ch盻・Nhﾃ｢n ch盻ｩng trﾃｬnh bﾃy
  OBSERVER_ONLY = 'OBSERVER_ONLY', // Ch盻・Quan sﾃ｡t viﾃｪn (bﾃｪn trung gian) trﾃｬnh bﾃy
  MUTED_ALL = 'MUTED_ALL', // T蘯｡m d盻ｫng chat (ngh盻・gi蘯｣i lao)
}

// Enum cho Tier phiﾃｪn ﾄ訴盻「 tr蘯ｧn
export enum HearingTier {
  TIER_1 = 'TIER_1', // Staff ﾄ訴盻「 tr蘯ｧn
  TIER_2 = 'TIER_2', // Admin phﾃｺc th蘯ｩm
}

// =============================================================================
// DISPUTE HEARING ENTITY (Phiﾃｪn ﾄ訴盻「 tr蘯ｧn)
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

  @Column({ type: 'varchar', length: 2000, nullable: true })
  agenda: string; // N盻冓 dung c蘯ｧn th蘯｣o lu蘯ｭn

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Link Google Meet/Zoom n蘯ｿu c蘯ｧn video call (optional, do bﾃｪn th盻ｩ 3 cung c蘯･p)',
  })
  externalMeetingLink: string;

  @Column({ type: 'jsonb', nullable: true })
  requiredDocuments: string[]; // Tﾃi li盻㎡ yﾃｪu c蘯ｧu chu蘯ｩn b盻・

  @Column({ comment: 'Staff/Admin ch盻ｧ trﾃｬ phiﾃｪn ﾄ訴盻「 tr蘯ｧn' })
  moderatorId: string;

  // === LIVE CHAT CONTROL ===
  @Column({
    type: 'enum',
    enum: SpeakerRole,
    default: SpeakerRole.MUTED_ALL,
    comment: 'Ki盻ノ soﾃ｡t ai ﾄ柁ｰ盻｣c quy盻］ chat hi盻㌻ t蘯｡i',
  })
  currentSpeakerRole: SpeakerRole;

  @Column({
    type: 'enum',
    enum: HearingTier,
    default: HearingTier.TIER_1,
    comment: 'Tier 1 = Staff, Tier 2 = Admin phﾃｺc th蘯ｩm',
  })
  tier: HearingTier;

  @Column({ default: false, comment: 'TRUE = Phﾃｲng chat ﾄ疎ng ho蘯｡t ﾄ黛ｻ冢g' })
  isChatRoomActive: boolean;

  @Column({
    default: false,
    comment: 'TRUE = Moderator opened a controlled intake window for new evidence uploads',
  })
  isEvidenceIntakeOpen: boolean;

  @Column({ type: 'timestamp', nullable: true, comment: 'When hearing was paused' })
  pausedAt: Date;

  @Column({ nullable: true, comment: 'Moderator/Admin user who paused hearing' })
  pausedById: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, comment: 'Reason for pausing hearing' })
  pauseReason: string;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Accumulated pause duration in seconds for countdown accuracy',
  })
  accumulatedPauseSeconds: number;

  @Column({
    type: 'enum',
    enum: SpeakerRole,
    nullable: true,
    comment: 'Speaker role before pause to restore on resume',
  })
  speakerRoleBeforePause: SpeakerRole;

  @Column({ type: 'timestamp', nullable: true, comment: 'When intake window was opened' })
  evidenceIntakeOpenedAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: 'When intake window was closed' })
  evidenceIntakeClosedAt: Date;

  @Column({ nullable: true, comment: 'Moderator/Admin user who opened intake window' })
  evidenceIntakeOpenedBy: string;

  @Column({
    type: 'varchar',
    length: 1000,
    nullable: true,
    comment: 'Reason for opening intake window',
  })
  evidenceIntakeReason: string;

  // === DURATION & SCHEDULING ===
  @Column({ type: 'int', default: 60, comment: 'Th盻拱 lﾆｰ盻｣ng d盻ｱ ki蘯ｿn (phﾃｺt)' })
  estimatedDurationMinutes: number;

  // === RESCHEDULE TRACKING ===
  @Column({ default: 0, comment: 'S盻・l蘯ｧn ﾄ妥｣ d盻拱 l盻議h (Max 2-3)' })
  rescheduleCount: number;

  @Column({ nullable: true, comment: 'Phiﾃｪn cﾅｩ n蘯ｿu ﾄ妥｢y lﾃ reschedule' })
  previousHearingId: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRescheduledAt: Date;

  // === SUMMARY (sau khi k蘯ｿt thﾃｺc) ===
  @Column({ type: 'varchar', length: 5000, nullable: true })
  summary: string; // Tﾃｳm t蘯ｯt phiﾃｪn ﾄ訴盻「 tr蘯ｧn

  @Column({ type: 'varchar', length: 5000, nullable: true })
  findings: string; // Nh盻ｯng phﾃ｡t hi盻㌻ quan tr盻肱g

  @Column({ type: 'jsonb', nullable: true })
  pendingActions: Array<{
    code: string;
    label: string;
    ownerRole: string;
    dueAt?: string | null;
    urgent: boolean;
    note?: string | null;
  }>;

  @Column({
    type: 'varchar',
    length: 2000,
    nullable: true,
    comment: 'Structured no-show documentation for required absent participants',
  })
  noShowNote: string;

  @Column({ default: 1 })
  hearingNumber: number; // Phiﾃｪn th盻ｩ m蘯･y (cﾃｳ th盻・cﾃｳ nhi盻「 phiﾃｪn)

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
// HEARING PARTICIPANT ENTITY (Ngﾆｰ盻拱 tham gia)
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
  confirmedAt: Date; // Xﾃ｡c nh蘯ｭn tham gia

  @Column({ type: 'timestamp', nullable: true })
  joinedAt: Date; // Th盻ｱc t蘯ｿ vﾃo phiﾃｪn

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'timestamp', nullable: true, comment: 'L蘯ｧn online g蘯ｧn nh蘯･t' })
  lastOnlineAt: Date;

  @Column({ type: 'int', default: 0, comment: 'T盻貧g phﾃｺt online trong phiﾃｪn' })
  totalOnlineMinutes: number;

  @Column({ default: false })
  hasSubmittedStatement: boolean; // ﾄ静｣ n盻冪 l盻拱 khai chﾆｰa

  // === RESPONSE STATUS ===
  @Column({ default: false, comment: 'B蘯ｯt bu盻冂 tham gia (Nguyﾃｪn ﾄ柁｡n, B盻・ﾄ柁｡n = true)' })
  isRequired: boolean;

  @Column({ type: 'timestamp', nullable: true, comment: 'H蘯｡n ph蘯｣n h盻妬 l盻拱 m盻拱' })
  responseDeadline: Date;

  @Column({
    type: 'varchar',
    length: 1000,
    nullable: true,
    comment: 'Lﾃｽ do t盻ｫ ch盻訴/xin d盻拱',
  })
  declineReason: string;

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
// HEARING STATEMENT ENTITY (L盻拱 khai / B蘯ｱng ch盻ｩng)
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @Column({ type: 'varchar', length: 10000 })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  structuredContent: HearingStatementContentBlock[] | null;

  @Column({ type: 'jsonb', nullable: true })
  citedEvidenceIds: string[] | null;

  @Column({
    type: 'enum',
    enum: HearingStatementStatus,
    default: HearingStatementStatus.DRAFT,
  })
  status: HearingStatementStatus;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[]; // URLs c盻ｧa file ﾄ妥ｭnh kﾃｨm

  @Column({ nullable: true })
  replyToStatementId: string; // Reply to prior statement

  @Column({ nullable: true })
  retractionOfStatementId: string; // Correction for prior statement

  @Column({ default: 0 })
  orderIndex: number; // Th盻ｩ t盻ｱ trong phiﾃｪn

  @Column({ default: false })
  isRedacted: boolean; // B盻・admin 蘯ｩn vﾃｬ khﾃｴng phﾃｹ h盻｣p

  @Column({ type: 'varchar', length: 1000, nullable: true })
  redactedReason: string;

  @Column({
    name: 'objection_status',
    type: 'varchar',
    length: 20,
    nullable: true,
    default: null,
    comment: 'PENDING | SUSTAINED | OVERRULED (only for OBJECTION statements)',
  })
  objectionStatus: 'PENDING' | 'SUSTAINED' | 'OVERRULED' | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    default: null,
    comment: 'Deadline for submitting this statement type during the current phase',
  })
  deadline: Date | null;

  @Column({ type: 'boolean', default: false })
  platformDeclarationAccepted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  platformDeclarationAcceptedAt: Date | null;

  @Column({ type: 'int', default: 1 })
  versionNumber: number;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'::jsonb" })
  versionHistory: HearingStatementVersionSnapshot[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

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

  @ManyToOne('HearingStatementEntity', { nullable: true })
  @JoinColumn({ name: 'retractionOfStatementId' })
  retractionOfStatement: HearingStatementEntity;
}

// =============================================================================
// HEARING QUESTION ENTITY (Cﾃ｢u h盻淑 t盻ｫ Admin)
// =============================================================================

@Entity('hearing_questions')
export class HearingQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hearingId: string;

  @Column()
  askedById: string; // Admin ﾄ黛ｺｷt cﾃ｢u h盻淑

  @Column()
  targetUserId: string; // Ngﾆｰ盻拱 c蘯ｧn tr蘯｣ l盻拱

  @Column({ type: 'varchar', length: 2000 })
  question: string;

  @Column({ type: 'varchar', length: 5000, nullable: true })
  answer: string;

  @Column({
    type: 'enum',
    enum: HearingQuestionStatus,
    default: HearingQuestionStatus.PENDING_ANSWER,
  })
  status: HearingQuestionStatus;

  @Column({ type: 'timestamp', nullable: true })
  answeredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date; // Answer deadline

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancelledById: string; // Moderator who cancelled

  @Column({ default: false })
  isRequired: boolean; // B蘯ｯt bu盻冂 tr蘯｣ l盻拱 trﾆｰ盻嫩 khi k蘯ｿt phiﾃｪn

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

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cancelledById' })
  cancelledBy: any;
}
