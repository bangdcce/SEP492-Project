import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  REVISIONS_REQUIRED = 'REVISIONS_REQUIRED',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  milestoneId: string;

  @Column()
  projectId: string;

  @Column({ type: 'uuid', nullable: true })
  parentTaskId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate: Date;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;

  // ─────────────────────────────────────────────────────────────────────────
  // PROOF OF WORK FIELDS (for task submission / dispute resolution)
  // ─────────────────────────────────────────────────────────────────────────

  @Column({ name: 'submission_note', type: 'text', nullable: true })
  submissionNote: string;

  @Column({ name: 'proof_link', type: 'varchar', length: 500, nullable: true })
  proofLink: string;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('MilestoneEntity', 'tasks', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: any;

  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('TaskEntity', 'subtasks', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parentTaskId' })
  parentTask: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedTo' })
  assignee: any;

  @Column({ nullable: true })
  reporterId: string;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reporterId' })
  reporter: any;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({ type: 'int', nullable: true })
  storyPoints: number;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'simple-array', nullable: true })
  labels: string[];

  @OneToMany('TaskAttachmentEntity', 'task')
  attachments: any[];

  @OneToMany('TaskEntity', 'parentTask')
  subtasks: any[];

  @OneToMany('TaskLinkEntity', 'task')
  links: any[];

  @OneToMany('TaskSubmissionEntity', 'task')
  submissions: any[];
}
