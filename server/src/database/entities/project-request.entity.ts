import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

export enum RequestStatus {
  PUBLIC_DRAFT = 'PUBLIC_DRAFT', // Visible in marketplace
  PRIVATE_DRAFT = 'PRIVATE_DRAFT', // Invite only
  PENDING_SPECS = 'PENDING_SPECS', // Deal locked, Broker drafting specs (was PENDING)
  HIRING = 'HIRING', // Broker hired, looking for freelancers
  IN_PROGRESS = 'IN_PROGRESS', // Project execution
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  
  // Legacy mappings (will be migrated or kept for safety during transition)
  DRAFT = 'DRAFT', 
  PENDING = 'PENDING',
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
