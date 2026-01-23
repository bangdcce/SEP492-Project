import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('auth_sessions')
export class AuthSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar' })
  refreshTokenHash: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  replacedBySessionId: string;

  @Column({ type: 'timestamp', nullable: true })
  validAccessFrom: Date;

  // Relations
  @ManyToOne('UserEntity', 'authSessions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @ManyToOne('AuthSessionEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replacedBySessionId' })
  replacedBySession: any;
}
