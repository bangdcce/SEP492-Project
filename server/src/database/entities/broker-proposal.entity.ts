import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ProjectRequestEntity } from './project-request.entity';
import { UserEntity } from './user.entity';

export enum ProposalStatus {
  PENDING = 'PENDING',
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('broker_proposals')
@Index(['requestId', 'brokerId'], { unique: true })
export class BrokerProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requestId: string;

  @Column()
  brokerId: string;

  @Column({ type: 'text', nullable: true })
  coverLetter: string;

  @Column({
    type: 'enum',
    enum: ProposalStatus,
    default: ProposalStatus.PENDING,
  })
  status: ProposalStatus;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => ProjectRequestEntity, (request) => request.brokerProposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: ProjectRequestEntity;

  @ManyToOne(() => UserEntity, (user) => user.brokerProposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brokerId' })
  broker: UserEntity;
}
