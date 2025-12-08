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

  @Column()
  clientId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  budgetRange: string;

  @Column({ type: 'varchar', nullable: true })
  intendedTimeline: string;

  @Column({ type: 'varchar', nullable: true })
  techPreferences: string;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ nullable: true })
  brokerId: string;

  @CreateDateColumn()
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
