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
import { numericTransformer } from '../transformers/column-numeric.transformer';

export enum FundingGateway {
  INTERNAL_SANDBOX = 'INTERNAL_SANDBOX',
  PAYPAL = 'PAYPAL',
  STRIPE = 'STRIPE',
}

export enum FundingIntentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('funding_intents')
@Index(['milestoneId'])
@Index(['payerId'])
@Index(['paymentMethodId'])
@Index(['payerId', 'milestoneId', 'idempotencyKey'], {
  unique: true,
})
export class FundingIntentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  milestoneId: string;

  @Column()
  payerId: string;

  @Column()
  paymentMethodId: string;

  @Column({
    type: 'enum',
    enum: FundingGateway,
  })
  gateway: FundingGateway;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: FundingIntentStatus,
    default: FundingIntentStatus.PENDING,
  })
  status: FundingIntentStatus;

  @Column({ type: 'varchar', length: 255 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerReference: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('MilestoneEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: unknown;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payerId' })
  payer: unknown;

  @ManyToOne('PaymentMethodEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: unknown;
}
