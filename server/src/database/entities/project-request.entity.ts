import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

export enum RequestStatus {
  DRAFT = 'DRAFT',
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
}
