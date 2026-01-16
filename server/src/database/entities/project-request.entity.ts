import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
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

  @OneToOne('ProjectSpecEntity', 'request')
  spec: ProjectSpecEntity;

  @OneToMany('BrokerProposalEntity', 'request')
  brokerProposals: any[];
}
