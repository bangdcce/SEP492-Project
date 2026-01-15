import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

export enum RequestStatus {
  PUBLIC_DRAFT = 'PUBLIC_DRAFT', // Visible in marketplace
  PRIVATE_DRAFT = 'PRIVATE_DRAFT', // Invite only
  BROKER_ASSIGNED = 'BROKER_ASSIGNED', // Phase 2: Broker hired, drafting specs
  SPEC_APPROVED = 'SPEC_APPROVED', // Phase 3: Specs agreed, looking for freelancers
  CONTRACT_PENDING = 'CONTRACT_PENDING', // Phase 4: Found freelancers, negotiating contract
  HIRING = 'HIRING', // (Deprecated or reused?) Let's keep for backward compat but prefer SPEC_APPROVED for Phase 3 start.
  CONVERTED_TO_PROJECT = 'CONVERTED_TO_PROJECT', // Project started
  
  IN_PROGRESS = 'IN_PROGRESS', // Legacy or direct execution
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  
  // Legacy
  DRAFT = 'DRAFT', 
  PENDING = 'PENDING',
  PENDING_SPECS = 'PENDING_SPECS', // Deprecated in favor of BROKER_ASSIGNED or kept for transition
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
  @ManyToOne('UserEntity', 'clientRequests', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: any;

  @ManyToOne('UserEntity', 'brokerRequests', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brokerId' })
  broker: any;

  @OneToMany('ProjectRequestAnswerEntity', 'request')
  answers: any[];

  @OneToMany('ProjectRequestProposalEntity', 'request')
  proposals: any[];

  @OneToMany('BrokerProposalEntity', 'request')
  brokerProposals: any[];
}
