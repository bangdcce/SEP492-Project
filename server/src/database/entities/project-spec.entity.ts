import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ProjectRequestEntity } from './project-request.entity';
import type { MilestoneEntity } from './milestone.entity';

export enum ProjectSpecStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('project_specs')
export class ProjectSpecEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  totalBudget: number;

  @Column({
    type: 'enum',
    enum: ProjectSpecStatus,
    default: ProjectSpecStatus.PENDING_APPROVAL,
  })
  status: ProjectSpecStatus;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToOne(() => ProjectRequestEntity, (request) => request.spec, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: ProjectRequestEntity;

  @OneToMany('MilestoneEntity', 'projectSpec')
  milestones: MilestoneEntity[];
}
