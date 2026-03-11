import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';

export interface ContractMilestoneSnapshotItem {
  projectMilestoneId: string;
  sourceSpecMilestoneId: string | null;
  title: string;
  description?: string | null;
  amount: number;
  dueDate?: string | null;
  sortOrder?: number | null;
  deliverableType?: string | null;
  retentionAmount?: number | null;
  acceptanceCriteria?: string[] | null;
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  SIGNED = 'SIGNED',
  ACTIVATED = 'ACTIVATED',
  ARCHIVED = 'ARCHIVED',
}

@Index('UQ_contracts_sourceSpecId', ['sourceSpecId'], { unique: true })
@Entity('contracts')
export class ContractEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: string;

  @Column({ nullable: true })
  sourceSpecId: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string;

  @Column({ type: 'varchar' })
  contractUrl: string;

  @Column({ type: 'text', nullable: true })
  termsContent: string;

  @Column({ type: 'varchar', default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  milestoneSnapshot: ContractMilestoneSnapshotItem[] | null;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('ProjectEntity', 'contracts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: any;

  @ManyToOne('ProjectSpecEntity', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sourceSpecId' })
  sourceSpec: any;

  @ManyToOne('UserEntity', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy' })
  creator: any;

  @OneToMany('DigitalSignatureEntity', 'contract')
  signatures: any[];
}
