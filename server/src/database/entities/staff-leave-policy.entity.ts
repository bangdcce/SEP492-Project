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
import { UserEntity } from './user.entity';

// =============================================================================
// STAFF LEAVE POLICY ENTITY (Monthly allowance per staff)
// =============================================================================

@Entity('staff_leave_policies')
@Index(['staffId'], { unique: true })
export class StaffLeavePolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: 'User co role = STAFF' })
  staffId: string;

  @Column({
    type: 'int',
    default: 480,
    comment: 'T?ng s? phut ngh? phep m?i thang (default 480 = 1 ngay)',
  })
  monthlyAllowanceMinutes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: UserEntity;
}
