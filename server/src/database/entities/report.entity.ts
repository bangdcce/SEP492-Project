import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ReviewEntity } from './review.entity';

export enum ReportStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum ReportReason {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  DOXING = 'DOXING',
  FAKE_REVIEW = 'FAKE_REVIEW',
  INAPPROPRIATE_LANGUAGE = 'INAPPROPRIATE_LANGUAGE',
  OFF_TOPIC = 'OFF_TOPIC',
  OTHER = 'OTHER',
}

@Entity('reports')
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @Column({ name: 'review_id', type: 'uuid' })
  reviewId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'reporter_id' })
  reporter: UserEntity;

  @ManyToOne(() => ReviewEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'review_id' })
  review: ReviewEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'resolved_by' })
  resolver: UserEntity;
}
