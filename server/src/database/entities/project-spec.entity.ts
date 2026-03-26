import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import {
  ProjectRequestCommercialBaseline,
  ProjectRequestEntity,
  ProjectRequestScopeBaseline,
} from './project-request.entity';
import type { MilestoneEntity } from './milestone.entity';

export enum SpecPhase {
  CLIENT_SPEC = 'CLIENT_SPEC',
  FULL_SPEC = 'FULL_SPEC',
}

export enum ProjectSpecStatus {
  DRAFT = 'DRAFT',
  CLIENT_REVIEW = 'CLIENT_REVIEW',
  CLIENT_APPROVED = 'CLIENT_APPROVED',
  FINAL_REVIEW = 'FINAL_REVIEW',
  ALL_SIGNED = 'ALL_SIGNED',
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
  approvedClientFeatureIds?: string[] | null;
}

export interface ClientFeature {
  id: string;
  title: string;
  description: string;
  priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'NICE_TO_HAVE';
}

export interface ReferenceLink {
  label: string;
  url: string;
}

export interface SpecSubmissionSnapshot {
  phase: SpecPhase;
  title: string;
  description: string;
  totalBudget: number;
  projectCategory?: string | null;
  estimatedTimeline?: string | null;
  clientFeatures?: ClientFeature[] | null;
  features?: SpecFeature[] | null;
  techStack?: string | null;
  referenceLinks?: ReferenceLink[] | null;
  milestones?: Array<{
    title: string;
    description: string;
    amount: number;
    deliverableType: string;
    retentionAmount: number;
    startDate?: string | null;
    dueDate?: string | null;
    sortOrder?: number | null;
    acceptanceCriteria?: string[] | null;
    approvedClientFeatureIds?: string[] | null;
  }> | null;
}

export interface SpecFieldDiffEntry {
  field: string;
  label: string;
  previous: unknown;
  next: unknown;
}

export interface SpecRejectionHistoryEntry {
  phase: SpecPhase;
  reason: string;
  rejectedByUserId?: string | null;
  rejectedAt: string;
}

export interface ProjectSpecRequestContext {
  originalRequest: {
    title?: string | null;
    description?: string | null;
    budgetRange?: string | null;
    requestedDeadline?: string | null;
    productTypeLabel?: string | null;
    projectGoalSummary?: string | null;
  };
  approvedCommercialBaseline: Pick<
    ProjectRequestCommercialBaseline,
    'source' | 'agreedBudget' | 'agreedDeliveryDeadline' | 'agreedClientFeatures'
  > | null;
}

@Entity('project_specs')
export class ProjectSpecEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column({
    type: 'enum',
    enum: SpecPhase,
    default: SpecPhase.FULL_SPEC, // Keep legacy rows as FULL_SPEC-compatible
  })
  specPhase: SpecPhase;

  @Column({ type: 'uuid', nullable: true })
  parentSpecId: string | null;

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
  features: SpecFeature[] | null;

  /**
   * Client-readable feature list for c_spec phase
   */
  @Column({ type: 'jsonb', nullable: true })
  clientFeatures: ClientFeature[] | null;

  /**
   * Technology stack definition (e.g., "NestJS, React, PostgreSQL")
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  techStack: string | null;

  /**
   * Reference links (Figma, ERD, external docs)
   */
  @Column({ type: 'jsonb', nullable: true })
  referenceLinks: ReferenceLink[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  estimatedTimeline: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  projectCategory: string | null;

  @Column({ type: 'jsonb', nullable: true })
  richContentJson: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  submissionVersion: number;

  @Column({ type: 'jsonb', nullable: true })
  lastSubmittedSnapshot: SpecSubmissionSnapshot | null;

  @Column({ type: 'jsonb', nullable: true })
  lastSubmittedDiff: SpecFieldDiffEntry[] | null;

  @Column({ type: 'text', nullable: true })
  changeSummary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rejectionHistory: SpecRejectionHistoryEntry[] | null;

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
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  lockedByContractId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  clientApprovedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => ProjectRequestEntity, (request) => request.specs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: ProjectRequestEntity;

  @OneToMany('MilestoneEntity', 'projectSpec')
  milestones: MilestoneEntity[];

  @ManyToOne(() => ProjectSpecEntity, (spec) => spec.childSpecs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parentSpecId' })
  parentSpec: ProjectSpecEntity | null;

  @OneToMany(() => ProjectSpecEntity, (spec) => spec.parentSpec)
  childSpecs: ProjectSpecEntity[];

  @OneToMany('ProjectSpecSignatureEntity', 'spec')
  signatures: any[];

  requestContext?: ProjectSpecRequestContext | null;
}
