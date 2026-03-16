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

export enum PaymentMethodType {
  PAYPAL_ACCOUNT = 'PAYPAL_ACCOUNT',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
}

@Entity('payment_methods')
@Index(['userId'])
export class PaymentMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  type: PaymentMethodType;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paypalEmail: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankCode: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accountHolderName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branchName: string | null;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: unknown;
}
