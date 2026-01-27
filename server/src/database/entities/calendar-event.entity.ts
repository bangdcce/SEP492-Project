import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

// =============================================================================
// ENUMS
// =============================================================================

export enum EventType {
  DISPUTE_HEARING = 'DISPUTE_HEARING', // Phiên điều trần
  PROJECT_MEETING = 'PROJECT_MEETING', // Họp dự án (Client-Freelancer-Broker)
  INTERNAL_MEETING = 'INTERNAL_MEETING', // Họp nội bộ (Staff/Admin)
  PERSONAL_BLOCK = 'PERSONAL_BLOCK', // Khóa lịch cá nhân (nghỉ, bận việc riêng)
  REVIEW_SESSION = 'REVIEW_SESSION', // Phiên review code/deliverable
  TASK_DEADLINE = 'TASK_DEADLINE', // Task deadline (auto-created from task)
  OTHER = 'OTHER',
}

export enum EventStatus {
  DRAFT = 'DRAFT', // Đang tạo
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION', // Chờ các bên xác nhận
  SCHEDULED = 'SCHEDULED', // Đã lên lịch
  IN_PROGRESS = 'IN_PROGRESS', // Đang diễn ra
  COMPLETED = 'COMPLETED', // Hoàn thành
  CANCELLED = 'CANCELLED', // Hủy
  RESCHEDULING = 'RESCHEDULING', // Đang trong quá trình dời lịch
}

export enum EventPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// =============================================================================
// CALENDAR EVENT ENTITY (Trung tâm của mọi sự kiện)
// =============================================================================

/**
 * Entity trung tâm cho hệ thống Calendar.
 * Phục vụ: Dispute Hearing, Project Meeting, Internal Meeting, etc.
 */
@Entity('calendar_events')
@Index(['startTime', 'endTime'])
@Index(['organizerId', 'startTime'])
@Index(['status', 'startTime'])
export class CalendarEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === EVENT INFO ===
  @Column({ type: 'enum', enum: EventType })
  type: EventType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: EventPriority, default: EventPriority.MEDIUM })
  priority: EventPriority;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  // === TIMING ===
  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'int', comment: 'Thời lượng (phút)' })
  durationMinutes: number;

  // === ORGANIZER ===
  @Column({ comment: 'Người tạo event (Staff/Admin/User)' })
  organizerId: string;

  // === REFERENCE (Polymorphic - Link tới entity khác) ===
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'DisputeHearing, Project, Task...',
  })
  referenceType: string;

  @Column({ nullable: true })
  referenceId: string;

  // === AUTO-SCHEDULING INFO ===
  @Column({ default: false, comment: 'TRUE = Hệ thống tự tạo' })
  isAutoScheduled: boolean;

  @Column({ nullable: true, comment: 'Rule đã dùng để auto-schedule' })
  autoScheduleRuleId: string;

  // === RESCHEDULE TRACKING ===
  @Column({ default: 0, comment: 'Số lần đã dời lịch (Max 2-3)' })
  rescheduleCount: number;

  @Column({ nullable: true, comment: 'Event cũ nếu là reschedule' })
  previousEventId: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRescheduledAt: Date;

  // === LOCATION/ONLINE ===
  @Column({ nullable: true, comment: 'Online, Room A, etc.' })
  location: string;

  @Column({ nullable: true, comment: 'Link Google Meet/Zoom nếu online (bên thứ 3)' })
  externalMeetingLink: string;

  // === REMINDERS ===
  @Column({ type: 'jsonb', nullable: true, comment: 'Cấu hình nhắc nhở [15, 60, 1440] phút trước' })
  reminderMinutes: number[];

  // === NOTES ===
  @Column({ type: 'text', nullable: true })
  notes: string;

  // === METADATA ===
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizerId' })
  organizer: any;

  @ManyToOne('CalendarEventEntity', { nullable: true })
  @JoinColumn({ name: 'previousEventId' })
  previousEvent: CalendarEventEntity;

  @OneToMany('EventParticipantEntity', 'event')
  participants: any[];

  @OneToMany('EventRescheduleRequestEntity', 'event')
  rescheduleRequests: any[];
}
