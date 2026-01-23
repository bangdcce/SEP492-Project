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
// DISPUTE RESOLUTION FEEDBACK ENTITY (User đánh giá Staff)
// =============================================================================

/**
 * User đánh giá Staff sau khi dispute được resolve.
 * Cả raiser và defendant đều có thể đánh giá.
 */
@Entity('dispute_resolution_feedbacks')
@Index(['disputeId', 'userId'])
@Index(['staffId', 'createdAt'])
export class DisputeResolutionFeedbackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({ comment: 'Staff đã xử lý dispute' })
  staffId: string;

  @Column({ comment: 'User đánh giá (raiser hoặc defendant)' })
  userId: string;

  @Column({ comment: 'Role của user khi đánh giá' })
  userRole: string;

  // === RATING ===
  @Column({ type: 'int', comment: 'Rating tổng thể (1-5 sao)' })
  rating: number;

  @Column({ type: 'text', nullable: true, comment: 'Nhận xét chi tiết (optional)' })
  comment: string;

  // === DETAILED CRITERIA (Optional - chi tiết hơn) ===
  @Column({ type: 'int', nullable: true, comment: 'Công bằng trong xử lý (1-5)' })
  fairnessRating: number;

  @Column({ type: 'int', nullable: true, comment: 'Tốc độ phản hồi (1-5)' })
  responsivenessRating: number;

  @Column({ type: 'int', nullable: true, comment: 'Chuyên nghiệp (1-5)' })
  professionalismRating: number;

  @Column({ type: 'int', nullable: true, comment: 'Giải thích rõ ràng (1-5)' })
  clarityRating: number;

  // === FLAGS ===
  @Column({ default: false, comment: 'User có hài lòng với kết quả?' })
  isSatisfied: boolean;

  @Column({ default: false, comment: 'Feedback bị report (spam/không hợp lệ)' })
  isReported: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
