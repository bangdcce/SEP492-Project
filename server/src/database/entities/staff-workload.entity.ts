import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

// =============================================================================
// STAFF WORKLOAD ENTITY (Theo dõi công việc Staff theo ngày)
// =============================================================================

/**
 * Tracking workload của Staff theo ngày.
 * Dùng cho auto-assignment: Chọn Staff có workload thấp nhất.
 */
@Entity('staff_workloads')
@Index(['staffId', 'date'])
export class StaffWorkloadEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: 'User có role = STAFF' })
  staffId: string;

  @Column({ type: 'date', comment: 'Ngày tính workload' })
  date: Date;

  // === CURRENT LOAD ===
  @Column({ default: 0, comment: 'Số event đã lên lịch trong ngày' })
  totalEventsScheduled: number;

  @Column({ default: 0, comment: 'Số dispute đang xử lý (tổng thể - chưa resolve)' })
  totalDisputesPending: number;

  @Column({ default: 0, comment: 'Tổng số phút đã book trong ngày' })
  scheduledMinutes: number;

  // === CAPACITY ===
  @Column({ default: 480, comment: 'Sức chứa tối đa (default 8h = 480 phút)' })
  dailyCapacityMinutes: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '= scheduledMinutes / dailyCapacityMinutes * 100',
  })
  utilizationRate: number;

  // === FLAGS ===
  @Column({ default: false, comment: 'TRUE = utilizationRate > 90%' })
  isOverloaded: boolean;

  @Column({ default: true, comment: 'TRUE = có thể nhận thêm việc (utilizationRate < 80%)' })
  canAcceptNewEvent: boolean;

  @Column({ default: false, comment: 'TRUE = Staff đánh dấu nghỉ ngày này' })
  isOnLeave: boolean;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATION ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: any;
}
