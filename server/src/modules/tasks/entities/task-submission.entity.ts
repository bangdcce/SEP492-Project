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
  APPROVED = 'APPROVED',
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'submitterId' })
  submitter: UserEntity;

  @ManyToOne('TaskEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: TaskEntity;
}
