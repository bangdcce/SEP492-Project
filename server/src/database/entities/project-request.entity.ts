import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

export enum RequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
}

@Entity('project_requests')
export class ProjectRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'budget_range', type: 'varchar', nullable: true })
  budgetRange: string;

  @Column({ name: 'intended_timeline', type: 'varchar', nullable: true })
  intendedTimeline: string;

  @Column({ name: 'tech_preferences', type: 'varchar', nullable: true })
  techPreferences: string;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ name: 'broker_id', nullable: true })
  brokerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne('UserEntity', 'clientRequests', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: any;

  @ManyToOne('UserEntity', 'brokerRequests', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'broker_id' })
  broker: any;

  @OneToMany('ProjectRequestAnswerEntity', 'request')
  answers: any[];

  @OneToMany('ProjectRequestProposalEntity', 'request')
  proposals: any[];
}
