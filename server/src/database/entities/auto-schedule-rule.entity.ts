import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventType } from './calendar-event.entity';

// =============================================================================
// ENUMS
// =============================================================================

export enum SchedulingStrategy {
  BALANCED = 'BALANCED', // Cân bằng workload giữa các Staff
  URGENT_FIRST = 'URGENT_FIRST', // Ưu tiên urgent events
  ROUND_ROBIN = 'ROUND_ROBIN', // Luân phiên đều giữa Staff
  LEAST_BUSY = 'LEAST_BUSY', // Chọn Staff ít bận nhất
}

// =============================================================================
// AUTO SCHEDULE RULE ENTITY (Quy tắc tự động lên lịch)
// =============================================================================

/**
 * Cấu hình thuật toán auto-scheduling cho từng loại event.
 * Admin có thể tùy chỉnh để phù hợp với workflow.
 */
@Entity('auto_schedule_rules')
export class AutoScheduleRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // === SCOPE ===
  @Column({ type: 'enum', enum: EventType, comment: 'Rule áp dụng cho loại event nào' })
  eventType: EventType;

  @Column({ type: 'enum', enum: SchedulingStrategy, default: SchedulingStrategy.BALANCED })
  strategy: SchedulingStrategy;

  // === DEFAULT VALUES ===
  @Column({ default: 60, comment: 'Thời lượng mặc định (phút)' })
  defaultDurationMinutes: number;

  @Column({ default: 15, comment: 'Khoảng trống tối thiểu giữa 2 event (phút)' })
  bufferMinutes: number;

  // === STAFF CONSTRAINTS ===
  @Column({ default: 80, comment: 'Staff chỉ nhận việc khi utilizationRate < X%' })
  maxStaffUtilizationRate: number;

  @Column({ default: 5, comment: 'Số event tối đa mỗi Staff/ngày' })
  maxEventsPerStaffPerDay: number;

  // === WORKING HOURS ===
  @Column({ type: 'time', default: '08:00', comment: 'Giờ bắt đầu làm việc' })
  workingHoursStart: string;

  @Column({ type: 'time', default: '18:00', comment: 'Giờ kết thúc làm việc' })
  workingHoursEnd: string;

  @Column({ type: 'jsonb', default: [1, 2, 3, 4, 5], comment: 'Ngày làm việc (1=T2, 5=T6)' })
  workingDays: number[];

  // === PREFERENCES ===
  @Column({ default: true, comment: 'Ưu tiên khung giờ user đánh dấu PREFERRED' })
  respectUserPreferredSlots: boolean;

  @Column({ default: true, comment: 'Tránh giờ nghỉ trưa (11:30-13:00)' })
  avoidLunchHours: boolean;

  @Column({ type: 'time', nullable: true, default: '11:30' })
  lunchStartTime: string;

  @Column({ type: 'time', nullable: true, default: '13:00' })
  lunchEndTime: string;

  // === RESCHEDULE RULES ===
  @Column({ default: 2, comment: 'Số lần dời lịch tối đa' })
  maxRescheduleCount: number;

  @Column({ default: 24, comment: 'Phải dời trước ít nhất X giờ' })
  minRescheduleNoticeHours: number;

  // === AUTO-ASSIGNMENT ===
  @Column({ default: true, comment: 'Tự động gán Staff khi tạo event' })
  autoAssignStaff: boolean;

  // === STATUS ===
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false, comment: 'Rule mặc định cho eventType này' })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
