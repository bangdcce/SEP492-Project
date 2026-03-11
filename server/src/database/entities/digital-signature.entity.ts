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
  ipAddress: string;

  @CreateDateColumn()
  signedAt: Date;

  @ManyToOne('ContractEntity', 'signatures', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contractId' })
  contract: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: any;
}
