import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Index('UQ_digital_signatures_contract_user', ['contractId', 'userId'], { unique: true })
@Entity('digital_signatures')
export class DigitalSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contractId: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar' })
  signatureHash: string;

  @Column({ type: 'varchar', nullable: true })
  contentHash: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  signerRole: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  providerSessionId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  legalStatus: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificateSerial: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  providerPayload: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  signedAt: Date;

  @ManyToOne('ContractEntity', 'signatures', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractId' })
  contract: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
