/**
 * WIZARD & PROJECT REQUEST ENTITIES
 */

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';

@Entity('wizard_options')
export class WizardOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  questionId: string;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;

  @ManyToOne('WizardQuestionEntity', 'options', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: any;
}

@Entity('project_request_answers')
export class ProjectRequestAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column()
  questionId: string;

  @Column({ nullable: true })
  optionId: string;

  @Column({ type: 'text', nullable: true })
  valueText: string;

  @ManyToOne('ProjectRequestEntity', 'answers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: any;

  @ManyToOne('WizardQuestionEntity', 'answers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: any;

  @ManyToOne('WizardOptionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'optionId' })
  option: any;
}

@Entity('project_request_proposals')
@Index(['requestId', 'freelancerId'], { unique: true })
export class ProjectRequestProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column()
  freelancerId: string;

  @Column({ nullable: true })
  brokerId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  proposedBudget: number;

  @Column({ type: 'varchar', nullable: true })
  estimatedDuration: string;

  @Column({ type: 'text', nullable: true })
  coverLetter: string;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectRequestEntity', 'proposals', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: any;

  @ManyToOne('UserEntity', 'freelancerProposals', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'freelancerId' })
  freelancer: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brokerId' })
  broker: any;
}

/**
 * PROJECT MANAGEMENT ENTITIES
 */

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  TESTING = 'TESTING',
  COMPLETED = 'COMPLETED',
  DISPUTED = 'DISPUTED',
  CANCELED = 'CANCELED',
}

export enum PricingModel {
  FIXED_PRICE = 'FIXED_PRICE',
  TIME_MATERIALS = 'TIME_MATERIALS',
}

@Entity('projects')
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  requestId: string;

  @Column()
  clientId: string;

  @Column()
  brokerId: string;

  @Column({ nullable: true })
  freelancerId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalBudget: number;

  @Column({ type: 'varchar', length: 10, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PricingModel,
    nullable: true,
  })
  pricingModel: PricingModel;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  status: ProjectStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @ManyToOne('ProjectRequestEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requestId' })
  request: any;

  @ManyToOne('UserEntity', 'clientProjects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: any;

  @ManyToOne('UserEntity', 'brokerProjects', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: any;

  @ManyToOne('UserEntity', 'freelancerProjects', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'freelancerId' })
  freelancer: any;

  @OneToMany('MilestoneEntity', 'project')
  milestones: any[];

  @OneToMany('ContractEntity', 'project')
  contracts: any[];

  @OneToMany('DocumentEntity', 'project')
  documents: any[];
}

@Entity('project_categories')
export class ProjectCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  LOCKED = 'LOCKED',
  COMPLETED = 'COMPLETED',
  PAID = 'PAID',
}

@Entity('milestones')
export class MilestoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

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

  @Column({ type: 'varchar', nullable: true })
  proofOfWork: string;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'int', nullable: true })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', 'milestones', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @OneToMany('TaskEntity', 'milestone')
  tasks: any[];
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  REVISIONS_REQUIRED = 'REVISIONS_REQUIRED',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
}

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  milestoneId: string;

  @Column()
  projectId: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('MilestoneEntity', 'tasks', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: any;

  @ManyToOne('ProjectEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedTo' })
  assignee: any;
}

@Entity('contracts')
export class ContractEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'varchar' })
  contractUrl: string;

  @Column({ type: 'text', nullable: true })
  termsContent: string;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', 'contracts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator: any;

  @OneToMany('DigitalSignatureEntity', 'contract')
  signatures: any[];
}

@Entity('digital_signatures')
export class DigitalSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contractId: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar' })
  signatureHash: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  signedAt: Date;

  @ManyToOne('ContractEntity', 'signatures', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractId' })
  contract: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: any;
}

export enum DocType {
  SRS = 'SRS',
  SDS = 'SDS',
  MOCKUP = 'MOCKUP',
  REPORT = 'REPORT',
  OTHER = 'OTHER',
}

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column()
  uploaderId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar' })
  fileUrl: string;

  @Column({
    type: 'enum',
    enum: DocType,
  })
  type: DocType;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', 'documents', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: any;
}
