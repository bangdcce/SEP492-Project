import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('dispute_internal_memberships')
@Index(['disputeId', 'userId'], { unique: true })
export class DisputeInternalMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  grantedBy: string;

  @Column({ type: 'varchar', length: 100, default: 'manual' })
  source: string;

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
