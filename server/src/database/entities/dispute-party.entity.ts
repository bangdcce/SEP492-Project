import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserRole } from './user.entity';

export enum DisputePartySide {
  RAISER = 'RAISER',
  DEFENDANT = 'DEFENDANT',
  THIRD_PARTY = 'THIRD_PARTY',
}

@Entity('dispute_parties')
@Unique('UQ_dispute_parties_group_user', ['groupId', 'userId'])
@Index('IDX_dispute_parties_group_id', ['groupId'])
@Index('IDX_dispute_parties_dispute_id', ['disputeId'])
export class DisputePartyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupId: string;

  @Column({ nullable: true })
  disputeId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  role: UserRole;

  @Column({ type: 'enum', enum: DisputePartySide, default: DisputePartySide.THIRD_PARTY })
  side: DisputePartySide;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
