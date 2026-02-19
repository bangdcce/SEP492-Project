import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DisputeScheduleProposalStatus {
  ACTIVE = 'ACTIVE',
  SUBMITTED = 'SUBMITTED',
  WITHDRAWN = 'WITHDRAWN',
}

@Entity('dispute_schedule_proposals')
@Index('IDX_dispute_schedule_proposals_dispute_user_start', ['disputeId', 'userId', 'startTime'])
@Index('IDX_dispute_schedule_proposals_dispute_range', ['disputeId', 'startTime', 'endTime'])
@Index('IDX_dispute_schedule_proposals_dispute_status', ['disputeId', 'status'])
export class DisputeScheduleProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: DisputeScheduleProposalStatus,
    default: DisputeScheduleProposalStatus.ACTIVE,
  })
  status: DisputeScheduleProposalStatus;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
