// src/database/entities/wallet.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { numericTransformer } from '../transformers/column-numeric.transformer';

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  SUSPENDED = 'SUSPENDED',
}

@Entity('wallets')
@Index(['userId'], { unique: true }) // Mỗi user 1 wallet
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  // === SỐ DƯ CHÍNH ===
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  balance: number; // Số dư khả dụng

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  pendingBalance: number; // Tiền chờ xử lý (deposit pending)

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  heldBalance: number; // Tiền bị hold (trong escrow)

  // === THỐNG KÊ ===
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalDeposited: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalWithdrawn: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalEarned: number; // Cho Freelancer/Broker

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalSpent: number; // Cho Client

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @OneToMany('TransactionEntity', 'wallet')
  transactions: any[];
}
