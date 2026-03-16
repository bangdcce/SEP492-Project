import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dispute_ledgers')
@Index('IDX_dispute_ledgers_dispute_id_created_at', ['disputeId', 'createdAt'])
export class DisputeLedgerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @Column({ length: 80 })
  eventType: string;

  @Column({ nullable: true })
  actorId: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 128, nullable: true })
  previousHash: string;

  @Column({ type: 'text' })
  canonicalPayload: string;

  @Column({ type: 'varchar', length: 128 })
  hash: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;
}
