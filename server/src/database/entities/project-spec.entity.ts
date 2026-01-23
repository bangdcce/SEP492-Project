import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectRequestEntity } from './project-request.entity';
import type { MilestoneEntity } from './milestone.entity';

export enum ProjectSpecStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_AUDIT = 'PENDING_AUDIT', // Staff review required
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * JSON Schema for Feature item (stored in features JSONB column)
 * Each feature contains acceptance criteria for verification
 */
export interface SpecFeature {
  id: string; // UUID
  title: string;
  description: string;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  acceptanceCriteria: string[]; // Each must be > 10 chars
  inputOutputSpec?: string; // Optional JSON for API input/output
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

  /**
   * Structured features list with acceptance criteria
   * This replaces free-text description for detailed specs
   */
  @Column({ type: 'jsonb', nullable: true })
  features: SpecFeature[];

  /**
   * Technology stack definition (e.g., "NestJS, React, PostgreSQL")
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  techStack: string;

  /**
   * Reference links (Figma, ERD, external docs)
   */
  @Column({ type: 'jsonb', nullable: true })
  referenceLinks: { label: string; url: string }[];

  @Column({
    type: 'enum',
    enum: ProjectSpecStatus,
    default: ProjectSpecStatus.DRAFT,
  })
  status: ProjectSpecStatus;

  /**
   * Staff rejection reason (for REJECTED status)
   */
  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToOne(() => ProjectRequestEntity, (request) => request.spec, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: ProjectRequestEntity;

  @OneToMany('MilestoneEntity', 'projectSpec')
  milestones: MilestoneEntity[];
}

