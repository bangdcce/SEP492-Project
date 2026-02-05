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
import { UserEntity } from './user.entity';

// =============================================================================
// STAFF LEAVE REQUEST ENTITY
// =============================================================================

export enum LeaveType {
  SHORT_TERM = 'SHORT_TERM',
  LONG_TERM = 'LONG_TERM',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('staff_leave_requests')
@Index(['staffId', 'startTime', 'endTime'])
@Index(['staffId', 'status'])
export class StaffLeaveRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: 'User co role = STAFF' })
  staffId: string;

  @Column({ type: 'enum', enum: LeaveType })
  type: LeaveType;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ type: 'timestamptz', comment: 'Th?i gian b?t ??u ngh? phep' })
  startTime: Date;

  @Column({ type: 'timestamptz', comment: 'Th?i gian k?t thuc ngh? phep' })
  endTime: Date;

  @Column({ type: 'int', default: 0, comment: 'T?ng s? phut ngh? (trong gi? lam vi?c)' })
  durationMinutes: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ default: false, comment: 'TRUE = T? ??ng duy?t (short-term)' })
  isAutoApproved: boolean;

  @Column({ type: 'uuid', nullable: true })
  processedById?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  processedNote?: string | null;

  @Column({ type: 'uuid', nullable: true })
  cancelledById?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'processedById' })
  processedBy?: UserEntity | null;
}
