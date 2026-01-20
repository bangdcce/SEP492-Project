import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

// =============================================================================
// STAFF PERFORMANCE ENTITY (Theo dõi hiệu suất Staff)
// =============================================================================

/**
 * Tracking performance của Staff theo tháng/quý.
 * Dùng để đánh giá chất lượng xử lý dispute và phân bổ công việc.
 */
@Entity('staff_performances')
@Index(['staffId', 'period'])
export class StaffPerformanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: 'User có role = STAFF' })
  staffId: string;

  // === PERIOD ===
  @Column({ type: 'varchar', length: 7, comment: 'YYYY-MM (e.g., 2026-01) hoặc YYYY-QX' })
  period: string;

  // === DISPUTE STATS ===
  @Column({ default: 0, comment: 'Số vụ được gán trong kỳ' })
  totalDisputesAssigned: number;

  @Column({ default: 0, comment: 'Số vụ đã xử lý xong' })
  totalDisputesResolved: number;

  @Column({ default: 0, comment: 'Số vụ đang pending' })
  totalDisputesPending: number;

  @Column({ default: 0, comment: 'Số vụ bị kháng cáo' })
  totalAppealed: number;

  @Column({ default: 0, comment: 'Số vụ bị Admin đảo ngược quyết định' })
  totalOverturnedByAdmin: number;

  // === QUALITY METRICS ===
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '% bị appeal = totalAppealed/totalResolved * 100',
  })
  appealRate: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: '% bị đảo = totalOverturned/totalAppealed * 100',
  })
  overturnRate: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: 'Thời gian xử lý trung bình (giờ)',
  })
  avgResolutionTimeHours: number;

  // === USER SATISFACTION ===
  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
    comment: 'Rating trung bình từ user (1.00-5.00)',
  })
  avgUserRating: number;

  @Column({ default: 0, comment: 'Số lượt rating từ user' })
  totalUserRatings: number;

  // === HEARING STATS ===
  @Column({ default: 0, comment: 'Số phiên điều trần đã chủ trì' })
  totalHearingsConducted: number;

  @Column({ default: 0, comment: 'Số phiên bị reschedule (do Staff)' })
  totalHearingsRescheduled: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATION ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: any;
}
