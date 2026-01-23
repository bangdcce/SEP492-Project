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

export enum ParticipantRole {
  ORGANIZER = 'ORGANIZER', // Người tạo event
  MODERATOR = 'MODERATOR', // Staff/Admin điều hành
  REQUIRED = 'REQUIRED', // Bắt buộc tham gia
  OPTIONAL = 'OPTIONAL', // Tùy chọn
  OBSERVER = 'OBSERVER', // Quan sát
}

export enum ParticipantStatus {
  PENDING = 'PENDING', // Chưa phản hồi
  ACCEPTED = 'ACCEPTED', // Đã xác nhận
  DECLINED = 'DECLINED', // Từ chối
  TENTATIVE = 'TENTATIVE', // Chưa chắc chắn
  NO_RESPONSE = 'NO_RESPONSE', // Quá hạn không phản hồi
}

export enum AttendanceStatus {
  NOT_STARTED = 'NOT_STARTED', // Event chưa bắt đầu
  ON_TIME = 'ON_TIME', // Đúng giờ
  LATE = 'LATE', // Trễ (trong 15 phút)
  VERY_LATE = 'VERY_LATE', // Rất trễ (sau 15 phút)
  NO_SHOW = 'NO_SHOW', // Vắng mặt không phép
  EXCUSED = 'EXCUSED', // Vắng có phép
}

// =============================================================================
// EVENT PARTICIPANT ENTITY (Người tham gia event)
// =============================================================================

/**
 * Lưu thông tin người tham gia event.
 * Tracking: Invite -> Response -> Attendance
 */
@Entity('event_participants')
@Index(['eventId', 'userId'])
@Index(['userId', 'status'])
export class EventParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: ParticipantRole })
  role: ParticipantRole;

  // === INVITATION RESPONSE ===
  @Column({ type: 'enum', enum: ParticipantStatus, default: ParticipantStatus.PENDING })
  status: ParticipantStatus;

  @Column({ type: 'timestamp', nullable: true, comment: 'Hạn phản hồi lời mời' })
  responseDeadline: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date;

  @Column({ type: 'text', nullable: true, comment: 'Lý do từ chối/ghi chú' })
  responseNote: string;

  // === ATTENDANCE (Sau khi event diễn ra) ===
  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.NOT_STARTED,
  })
  attendanceStatus: AttendanceStatus;

  @Column({ type: 'timestamp', nullable: true, comment: 'Thời điểm vào event' })
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: 'Thời điểm rời event' })
  leftAt: Date;

  @Column({ default: false })
  isOnline: boolean;

  @Column({ type: 'int', nullable: true, comment: 'Số phút trễ (nếu LATE)' })
  lateMinutes: number;

  // === EXCUSE (Nếu vắng có phép) ===
  @Column({ type: 'text', nullable: true })
  excuseReason: string;

  @Column({ default: false })
  excuseApproved: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('CalendarEventEntity', 'participants', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
