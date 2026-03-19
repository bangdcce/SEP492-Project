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

export interface ContractCommercialFeature {
  title: string;
  description: string;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  acceptanceCriteria: string[];
  inputOutputSpec?: string | null;
}

export interface ContractEscrowSplit {
  developerPercentage: number;
  brokerPercentage: number;
  platformPercentage: number;
}

export interface ContractCommercialContext {
  sourceSpecId: string | null;
  sourceSpecUpdatedAt: string | null;
  requestId: string | null;
  projectTitle: string;
  clientId: string;
  brokerId: string;
  freelancerId: string | null;
  totalBudget: number;
  currency: string;
  description?: string | null;
  techStack?: string | null;
  scopeNarrativeRichContent?: Record<string, unknown> | null;
  scopeNarrativePlainText?: string | null;
  features?: ContractCommercialFeature[] | null;
  escrowSplit?: ContractEscrowSplit | null;
}

export interface ContractMilestoneSnapshotItem {
  contractMilestoneKey: string;
  sourceSpecMilestoneId: string | null;
  title: string;
  description?: string | null;
  amount: number;
  startDate?: string | null;
  dueDate?: string | null;
  sortOrder?: number | null;
  deliverableType?: string | null;
  retentionAmount?: number | null;
  acceptanceCriteria?: string[] | null;
  // Legacy compatibility for already-activated contracts created before immutable snapshot mapping.
  projectMilestoneId?: string | null;
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  SIGNED = 'SIGNED',
  ACTIVATED = 'ACTIVATED',
  ARCHIVED = 'ARCHIVED',
}

@Index('UQ_contracts_sourceSpecId_active', ['sourceSpecId'], {
  unique: true,
  where: `"sourceSpecId" IS NOT NULL AND "status" <> 'ARCHIVED'`,
})
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

  @Column({ type: 'varchar', nullable: true })
  archiveStoragePath: string | null;

  @Column({ type: 'timestamp', nullable: true })
  archivePersistedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  archiveDocumentHash: string | null;

  @Column({ type: 'text', nullable: true })
  termsContent: string;

  @Column({ type: 'varchar', nullable: true })
  contentHash: string | null;

  @Column({ type: 'varchar', default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  commercialContext: ContractCommercialContext | null;

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
