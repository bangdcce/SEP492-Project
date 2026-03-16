import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from './user.entity';
import type { ProjectSpecEntity } from './project-spec.entity';

export enum RequestStatus {
  PUBLIC_DRAFT = 'PUBLIC_DRAFT',
  PRIVATE_DRAFT = 'PRIVATE_DRAFT',
  BROKER_ASSIGNED = 'BROKER_ASSIGNED',
  SPEC_APPROVED = 'SPEC_APPROVED',
  CONTRACT_PENDING = 'CONTRACT_PENDING',
  HIRING = 'HIRING',
  CONVERTED_TO_PROJECT = 'CONVERTED_TO_PROJECT',

  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',

  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PENDING_SPECS = 'PENDING_SPECS',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  SPEC_SUBMITTED = 'SPEC_SUBMITTED',
}

export interface ProjectRequestAttachmentMetadata {
  filename: string;
  url: string;
  mimetype?: string | null;
  size?: number | null;
  category?: 'requirements' | 'attachment';
}

@Entity('project_requests')
export class ProjectRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'clientId' })
  clientId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'budgetRange', type: 'varchar', nullable: true })
  budgetRange: string;

  @Column({ name: 'intendedTimeline', type: 'varchar', nullable: true })
  intendedTimeline: string;

  @Column({ name: 'techPreferences', type: 'varchar', nullable: true })
  techPreferences: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: ProjectRequestAttachmentMetadata[] | null;

  @Column({ type: 'int', nullable: true, default: 1 })
  wizardProgressStep: number | null;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ name: 'brokerId', nullable: true })
  brokerId: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.clientRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.brokerRequests, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brokerId' })
  broker: UserEntity;

  @OneToMany('ProjectRequestAnswerEntity', 'request')
  answers: any[];

  @OneToMany('ProjectRequestProposalEntity', 'request')
  proposals: any[];

  @OneToMany('ProjectSpecEntity', 'request')
  specs: ProjectSpecEntity[];

  // Legacy field kept for API compatibility; populated manually at service layer.
  spec?: ProjectSpecEntity | null;

  @OneToMany('BrokerProposalEntity', 'request')
  brokerProposals: any[];
}
