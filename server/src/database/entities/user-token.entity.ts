import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum UserTokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum UserTokenStatus {
  PENDING = 'PENDING',
  USED = 'USED',
  REVOKED = 'REVOKED',
}

@Entity('user_tokens')
export class UserTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: UserTokenType,
  })
  type: UserTokenType;

  @Column({ type: 'varchar' })
  tokenHash: string;

  @Column({
    type: 'enum',
    enum: UserTokenStatus,
    default: UserTokenStatus.PENDING,
  })
  status: UserTokenStatus;

  @Column({ type: 'int', default: 1 })
  maxUses: number;

  @Column({ type: 'int', default: 0 })
  useCount: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  createdIp: string;

  @Column({ type: 'varchar', nullable: true })
  lastUsedIp: string;

  @Column({ type: 'varchar', nullable: true })
  lastUsedUserAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne('UserEntity', 'userTokens', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
