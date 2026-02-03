import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import type { ProjectSpecEntity } from './project-spec.entity';

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED', // Awaiting client approval
  REVISIONS_REQUIRED = 'REVISIONS_REQUIRED',
  LOCKED = 'LOCKED',
  COMPLETED = 'COMPLETED',
  PAID = 'PAID',
}

/**
 * Loại sản phẩm bàn giao - dùng để xác định input validation khi nghiệm thu
 */
export enum DeliverableType {
  DESIGN_PROTOTYPE = 'DESIGN_PROTOTYPE', // Figma, Adobe XD link required
  API_DOCS = 'API_DOCS', // Swagger/Postman collection required
  DEPLOYMENT = 'DEPLOYMENT', // Demo link (Vercel/Netlify) required
  SOURCE_CODE = 'SOURCE_CODE', // Git repository link required
  SYS_OPERATION_DOCS = 'SYS_OPERATION_DOCS', // Docker, .env.example, Disaster Recovery
  CREDENTIAL_VAULT = 'CREDENTIAL_VAULT', // Keys, passwords (encrypted)
  OTHER = 'OTHER',
}

@Entity('milestones')
export class MilestoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  /**
   * Loại bàn giao - quy định input nghiệm thu (governance require)
   */
  @Column({
    type: 'enum',
    enum: DeliverableType,
    default: DeliverableType.OTHER,
  })
  deliverableType: DeliverableType;

  /**
   * Tiền giữ lại (Retention) - % giữ cho bảo hành
   * VD: 20% milestone cuối = retentionAmount
   */
  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  retentionAmount: number;

  /**
   * Acceptance Criteria (checklist) - từ Spec
   */
  @Column({ type: 'jsonb', nullable: true })
  acceptanceCriteria: string[];

  @Column({ nullable: true })
  projectSpecId: string;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: MilestoneStatus,
    default: MilestoneStatus.PENDING,
  })
  status: MilestoneStatus;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  proofOfWork: string;

  /**
   * Video Demo link (bắt buộc khi submit)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  videoDemoUrl: string;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', 'milestones', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: unknown;

  @OneToMany('TaskEntity', 'milestone')
  tasks: unknown[];

  @ManyToOne('ProjectSpecEntity', 'milestones', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectSpecId' })
  projectSpec: ProjectSpecEntity;
}

