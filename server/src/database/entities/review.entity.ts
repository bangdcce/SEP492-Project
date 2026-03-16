import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProjectEntity } from './project.entity';
import { UserEntity } from './user.entity';

@Entity('reviews')
@Index(['projectId', 'reviewerId', 'targetUserId'], { unique: true })
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  reviewerId: string;

  @Column()
  targetUserId: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  comment: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  weight: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // --- SOFT DELETE (Admin only) ---
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;

  @Column({ name: 'delete_reason', type: 'varchar', length: 1000, nullable: true })
  deleteReason: string | null;

  @Column({ name: 'opened_by_id', type: 'uuid', nullable: true })
  openedById: string | null;

  @Column({ name: 'current_assignee_id', type: 'uuid', nullable: true })
  currentAssigneeId: string | null;

  @Column({ name: 'last_assigned_by_id', type: 'uuid', nullable: true })
  lastAssignedById: string | null;

  @Column({ name: 'last_assigned_at', type: 'timestamp', nullable: true })
  lastAssignedAt: Date | null;

  @Column({ name: 'assignment_version', type: 'int', default: 0 })
  assignmentVersion: number;

  // --- RELATIONS ---
  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: ProjectEntity;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: UserEntity;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: UserEntity;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'deleted_by' })
  deletedByUser?: UserEntity | null;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'opened_by_id' })
  openedByUser?: UserEntity | null;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'current_assignee_id' })
  currentAssigneeUser?: UserEntity | null;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'last_assigned_by_id' })
  lastAssignedByUser?: UserEntity | null;
}
