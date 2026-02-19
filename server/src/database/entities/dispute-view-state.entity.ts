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

@Entity('dispute_view_states')
@Index('UQ_dispute_view_states_dispute_user', ['disputeId', 'userId'], { unique: true })
@Index('IDX_dispute_view_states_user_updated', ['userId', 'updatedAt'])
export class DisputeViewStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'timestamptz' })
  lastViewedAt: Date;

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

