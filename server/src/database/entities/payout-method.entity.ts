// src/database/entities/payout-method.entity.ts

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

export enum PayoutMethodType {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  PAYPAL_EMAIL = 'PAYPAL_EMAIL',
}

@Entity('payout_methods')
@Index(['userId'])
@Index(['userId', 'type'])
export class PayoutMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  @Column({
    type: 'enum',
    enum: PayoutMethodType,
    enumName: 'payout_methods_type_enum',
    default: PayoutMethodType.BANK_ACCOUNT,
  })
  type: PayoutMethodType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paypalEmail: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string | null; // Vietcombank, Techcombank

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankCode: string | null; // VCB, TCB (cho BIN lookup)

  @Column({ type: 'varchar', length: 30, nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  accountHolderName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branchName: string | null;

  @Column({ default: false })
  isDefault: boolean; // Tài khoản mặc định để rút

  @Column({ default: false })
  isVerified: boolean; // Đã xác minh (test transfer 1000đ)

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
