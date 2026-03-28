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
@Index(['requestId', 'createdAt'])
@Index(['sessionId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'entity_type', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id' })
  entityId: string;

  @Column({ name: 'request_id', type: 'varchar', length: 120, nullable: true })
  requestId: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 120, nullable: true })
  sessionId: string | null;

  @Column({ name: 'route', type: 'varchar', length: 255, nullable: true })
  route: string | null;

  @Column({ name: 'http_method', type: 'varchar', length: 16, nullable: true })
  httpMethod: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ name: 'source', type: 'varchar', length: 20, nullable: true })
  source: string | null;

  @Column({ name: 'event_category', type: 'varchar', length: 40, nullable: true })
  eventCategory: string | null;

  @Column({ name: 'event_name', type: 'varchar', length: 120, nullable: true })
  eventName: string | null;

  @Column({ name: 'journey_step', type: 'varchar', length: 120, nullable: true })
  journeyStep: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 120, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  // --- CỘT MỚI THÊM ---
  @Column({ name: 'ip_address', nullable: true, length: 45 })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true, type: 'varchar', length: 500 })
  userAgent: string;
  // --------------------

  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData: Record<string, any>;

  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData: Record<string, any>;

  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields:
    | Array<{
        path: string;
        before: unknown;
        after: unknown;
      }>
    | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: UserEntity | null;
}
