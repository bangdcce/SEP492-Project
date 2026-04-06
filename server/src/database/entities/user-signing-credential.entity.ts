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
import { UserEntity } from './user.entity';

@Entity('user_signing_credentials')
@Index('UQ_user_signing_credentials_userId', ['userId'], { unique: true })
@Index('IDX_user_signing_credentials_keyFingerprint', ['keyFingerprint'])
export class UserSigningCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  publicKeyPem: string;

  @Column({ type: 'text' })
  encryptedPrivateKeyPem: string;

  @Column({ type: 'varchar', length: 128 })
  encryptionSalt: string;

  @Column({ type: 'varchar', length: 64 })
  encryptionIv: string;

  @Column({ type: 'varchar', length: 64 })
  encryptionAuthTag: string;

  @Column({ type: 'int', default: 210000 })
  kdfIterations: number;

  @Column({ type: 'varchar', length: 32, default: 'RSA-2048' })
  keyAlgorithm: string;

  @Column({ type: 'varchar', length: 64 })
  keyFingerprint: string;

  @Column({ type: 'int', default: 0 })
  failedPinAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'int', default: 1 })
  keyVersion: number;

  @Column({ type: 'timestamp', nullable: true })
  rotatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
