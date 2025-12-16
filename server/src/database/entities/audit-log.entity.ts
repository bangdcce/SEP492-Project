import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('audit_logs')
@Index(['actorId', 'entityId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'actor_id' })
  actorId: number;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'entity_type', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id' })
  entityId: number;

  // --- CỘT MỚI THÊM ---
  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent: string;
  // --------------------

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData: Record<string, any>;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_id' })
  actor: UserEntity;
}
