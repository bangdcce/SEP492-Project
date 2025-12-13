import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

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
