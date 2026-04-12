import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from '../../../database/entities/task.entity';
import { UserEntity } from '../../../database/entities/user.entity';

export enum TaskSubmissionStatus {
  PENDING = 'PENDING',
  PENDING_CLIENT_REVIEW = 'PENDING_CLIENT_REVIEW',
  APPROVED = 'APPROVED',
  AUTO_APPROVED = 'AUTO_APPROVED',
  REJECTED = 'REJECTED',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
}

@Entity('task_submissions')
export class TaskSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: string[];

  @Column({ type: 'int' })
  version: number;

  @Column({
    type: 'enum',
    enum: TaskSubmissionStatus,
    default: TaskSubmissionStatus.PENDING,
  })
  status: TaskSubmissionStatus;

  @Column({ type: 'uuid' })
  submitterId: string;

  @Column({ type: 'uuid' })
  taskId: string;

  @Column({ type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  brokerReviewNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  brokerReviewerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  brokerReviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  clientReviewNote: string | null;

  @Column({ type: 'uuid', nullable: true })
  clientReviewerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  clientReviewedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  clientReviewDueAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  autoApprovedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: UserEntity;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brokerReviewerId' })
  brokerReviewer: UserEntity;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'clientReviewerId' })
  clientReviewer: UserEntity;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'submitterId' })
  submitter: UserEntity;

  @ManyToOne('TaskEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;
}
