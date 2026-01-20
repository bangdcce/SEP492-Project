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

export enum RescheduleRequestStatus {
  PENDING = 'PENDING', // Đang chờ xử lý
  APPROVED = 'APPROVED', // Đã duyệt
  REJECTED = 'REJECTED', // Từ chối
  AUTO_RESOLVED = 'AUTO_RESOLVED', // Hệ thống tự xử lý
  WITHDRAWN = 'WITHDRAWN', // Người yêu cầu tự rút
}

// =============================================================================
// EVENT RESCHEDULE REQUEST ENTITY (Yêu cầu dời lịch)
// =============================================================================

/**
 * Lưu trữ yêu cầu dời lịch event.
 * Hỗ trợ cả manual (user chọn giờ) và auto (hệ thống tự tìm).
 */
@Entity('event_reschedule_requests')
@Index(['eventId', 'status'])
export class EventRescheduleRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column({ comment: 'Người yêu cầu dời lịch' })
  requesterId: string;

  // === LÝ DO ===
  @Column({ type: 'text', comment: 'Lý do xin dời lịch' })
  reason: string;

  // === PROPOSED TIME (Nếu user tự chọn) ===
  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Các khung giờ user đề xuất (tối đa 3)',
  })
  proposedTimeSlots: Array<{ start: Date; end: Date }>;

  // === AUTO-SCHEDULE (Nếu để hệ thống tự chọn) ===
  @Column({ default: false, comment: 'TRUE = Để hệ thống tự tìm giờ phù hợp' })
  useAutoSchedule: boolean;

  // === STATUS & PROCESSING ===
  @Column({ type: 'enum', enum: RescheduleRequestStatus, default: RescheduleRequestStatus.PENDING })
  status: RescheduleRequestStatus;

  @Column({ nullable: true, comment: 'Staff/Admin xử lý' })
  processedById: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true, comment: 'Ghi chú khi approve/reject' })
  processNote: string;

  // === RESULT ===
  @Column({ nullable: true, comment: 'Event mới được tạo (nếu approved)' })
  newEventId: string;

  @Column({ type: 'timestamp', nullable: true, comment: 'Thời gian mới được chọn' })
  selectedNewStartTime: Date;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('CalendarEventEntity', 'rescheduleRequests', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requesterId' })
  requester: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'processedById' })
  processedBy: any;

  @ManyToOne('CalendarEventEntity', { nullable: true })
  @JoinColumn({ name: 'newEventId' })
  newEvent: any;
}
