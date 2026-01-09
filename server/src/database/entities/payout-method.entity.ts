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

@Entity('payout_methods')
@Index(['userId'])
export class PayoutMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  bankName: string; // Vietcombank, Techcombank

  @Column({ type: 'varchar', length: 20, nullable: true })
  bankCode: string; // VCB, TCB (cho BIN lookup)

  @Column({ type: 'varchar', length: 30 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 255 })
  accountHolderName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  branchName: string;

  @Column({ default: false })
  isDefault: boolean; // Tài khoản mặc định để rút

  @Column({ default: false })
  isVerified: boolean; // Đã xác minh (test transfer 1000đ)

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
