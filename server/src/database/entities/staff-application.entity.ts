import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum StaffApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('staff_applications')
@Index(['userId'], { unique: true })
@Index(['status', 'createdAt'])
export class StaffApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: StaffApplicationStatus,
    enumName: 'staff_application_status_enum',
    default: StaffApplicationStatus.PENDING,
  })
  status: StaffApplicationStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cvStorageKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cvOriginalFilename: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cvMimeType: string | null;

  @Column({ type: 'integer', nullable: true })
  cvSize: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fullNameOnDocument: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  documentType: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  documentNumber: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  idCardFrontStorageKey: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  idCardBackStorageKey: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  selfieStorageKey: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne('UserEntity', 'staffApplication', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @ManyToOne('UserEntity', 'reviewedStaffApplications', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: any;
}
