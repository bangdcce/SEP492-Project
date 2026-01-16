import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum KycStatus {
  PENDING = 'PENDING', // Chờ duyệt
  APPROVED = 'APPROVED', // Đã xác thực
  REJECTED = 'REJECTED', // Bị từ chối
  EXPIRED = 'EXPIRED', // Hết hạn (cần xác thực lại)
}

export enum DocumentType {
  CCCD = 'CCCD',
  PASSPORT = 'PASSPORT',
  DRIVER_LICENSE = 'DRIVER_LICENSE',
}

@Entity('kyc_verifications')
export class KycVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  userId: string;

  // --- THÔNG TIN CƠ BẢN ---
  @Column({ type: 'varchar', length: 255 })
  fullNameOnDocument: string; // Tên trên CCCD
  @Column({ type: 'varchar', length: 20 })
  documentNumber: string; // Số CCCD

  @Column({ type: 'enum', enum: DocumentType, default: DocumentType.CCCD })
  documentType: DocumentType;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;
  @Column({ type: 'date', nullable: true })
  documentExpiryDate: Date | null; // Ngày hết hạn CCCD

  // --- ẢNH TÀI LIỆU (URL từ Cloud Storage) ---
  @Column({ type: 'varchar', length: 500 })
  documentFrontUrl: string; // Ảnh mặt trước CCCD

  @Column({ type: 'varchar', length: 500 })
  documentBackUrl: string; // Ảnh mặt sau CCCD
  @Column({ type: 'varchar', length: 500 })
  selfieUrl: string; // Ảnh selfie cầm CCCD

  // --- TRẠNG THÁI XÉT DUYỆT ---
  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  status: KycStatus;
  @Column({ type: 'text', nullable: true })
  rejectionReason: string; // Lý do từ chối (nếu có)

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string; // Admin/Staff đã duyệt
  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;
  // --- RELATIONS ---
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;
  @ManyToOne('UserEntity')
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: any;
}
