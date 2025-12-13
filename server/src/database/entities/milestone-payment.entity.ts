import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('milestone_payments')
export class MilestonePaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  milestoneId: string;

  @Column({ nullable: true })
  holdTransactionId: string;

  @Column({ nullable: true })
  releaseTransactionId: string;

  @ManyToOne('MilestoneEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: any;

  @ManyToOne('TransactionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'holdTransactionId' })
  holdTransaction: any;

  @ManyToOne('TransactionEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'releaseTransactionId' })
  releaseTransaction: any;
}
