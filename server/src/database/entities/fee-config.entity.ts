// src/database/entities/fee-config.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { numericTransformer } from '../transformers/column-numeric.transformer';

export enum FeeType {
  PLATFORM_FEE = 'PLATFORM_FEE',
  BROKER_COMMISSION = 'BROKER_COMMISSION',
  WITHDRAWAL_FEE = 'WITHDRAWAL_FEE',
}

@Entity('fee_configs')
export class FeeConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: FeeType })
  feeType: FeeType;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  percentage: number; // 5.00 = 5%

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  minAmount: number; // Phí tối thiểu

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  maxAmount: number; // Phí tối đa (cap)

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  effectiveFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  effectiveTo: Date;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  updater: any;
}
