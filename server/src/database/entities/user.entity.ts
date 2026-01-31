import { Expose } from 'class-transformer';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  BROKER = 'BROKER',
  CLIENT = 'CLIENT',
  CLIENT_SME = 'CLIENT_SME',
  FREELANCER = 'FREELANCER',
}

export enum BadgeType {
  NEW = 'NEW',
  VERIFIED = 'VERIFIED',
  TRUSTED = 'TRUSTED',
  WARNING = 'WARNING',
  NORMAL = 'NORMAL',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timeZone: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  // --- NHÓM THỐNG KÊ HIỆU SUẤT (Tự động cập nhật khi Project đổi status) ---

  @Column({ default: 0 })
  totalProjectsFinished: number; // Số dự án đã xong

  @Column({ default: 0 })
  totalProjectsCancelled: number; // Số dự án bị hủy (do lỗi user)

  @Column({ default: 0 })
  totalDisputesLost: number; // Số lần thua tranh chấp (Cực quan trọng)

  @Column({ default: 0 })
  totalLateProjects: number; // Số lần trễ deadline

  // --- ĐIỂM SỐ CUỐI CÙNG ---
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  currentTrustScore: number; // Kết quả của thuật toán

  @Column({ type: 'varchar', length: 6, nullable: true, name: 'resetpasswordotp' })
  resetPasswordOtp: string;

  @Column({ type: 'timestamp', nullable: true, name: 'resetpasswordotpexpires' })
  resetPasswordOtpExpires: Date;

  // --- EMAIL VERIFICATION FIELDS ---
  @Column({ type: 'varchar', length: 64, nullable: true, name: 'emailVerificationToken' })
  emailVerificationToken: string;

  @Column({ type: 'timestamp', nullable: true, name: 'emailVerificationExpires' })
  emailVerificationExpires: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'emailVerifiedAt' })
  emailVerifiedAt: Date;

  // --- LEGAL CONSENT FIELDS ---
  @Column({ type: 'timestamp', nullable: true, name: 'termsAcceptedAt' })
  termsAcceptedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'privacyAcceptedAt' })
  privacyAcceptedAt: Date;

  // --- REGISTRATION TRACKING FIELDS ---
  @Column({ type: 'varchar', length: 45, nullable: true, name: 'registrationIp' })
  registrationIp: string;

  @Column({ type: 'text', nullable: true, name: 'registrationUserAgent' })
  registrationUserAgent: string;

  // --- BAN/UNBAN FIELDS (Admin only) ---
  @Column({ type: 'boolean', default: false })
  isBanned: boolean;

  @Column({ type: 'text', nullable: true })
  banReason: string;

  @Column({ type: 'timestamp', nullable: true })
  bannedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  bannedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToOne('ProfileEntity', 'user')
  profile: any;

  @OneToMany('SocialAccountEntity', 'user')
  socialAccounts: any[];

  @OneToMany('AuthSessionEntity', 'user')
  authSessions: any[];

  @OneToMany('UserTokenEntity', 'user')
  userTokens: any[];

  @OneToMany('SavedFreelancerEntity', 'client')
  savedFreelancers: any[];

  @OneToMany('ProjectRequestEntity', 'client')
  clientRequests: any[];

  @OneToMany('ProjectRequestEntity', 'broker')
  brokerRequests: any[];

  @OneToMany('ProjectRequestProposalEntity', 'freelancer')
  freelancerProposals: any[];

  @OneToMany('BrokerProposalEntity', 'broker')
  brokerProposals: any[];

  @OneToMany('ProjectEntity', 'client')
  clientProjects: any[];

  @OneToMany('ProjectEntity', 'broker')
  brokerProjects: any[];

  @OneToMany('ProjectEntity', 'freelancer')
  freelancerProjects: any[];

  // NEW: Relation với user_flags
  @OneToMany('UserFlagEntity', 'user')
  flags: any[];

  // --- E05: LOGIC HUY HIỆU (VIRTUAL PROPERTY) ---
  // @Expose: Báo cho NestJS biết là "Hãy trả field này về cho Frontend dù nó không có trong DB"
  @Expose()
  get badge(): BadgeType {
    // 1. Ưu tiên cảnh báo - NHƯNG cho phép redemption
    // Chỉ WARNING nếu: có dispute thua VÀ chưa phục hồi đủ (ít hơn 3 dự án thành công sau dispute)
    // Hoặc có nhiều hơn 2 disputes thua (nghiêm trọng)
    if (this.totalDisputesLost > 0) {
      // Redemption logic: Nếu hoàn thành >= 3 dự án thành công VÀ chỉ có 1 dispute thua
      // → Cho phép "ân xá" và không hiện WARNING nữa
      const hasRedeemed = this.totalProjectsFinished >= 3 && this.totalDisputesLost === 1;

      if (!hasRedeemed) {
        return BadgeType.WARNING; // Vẫn cảnh báo nếu chưa phục hồi
      }
      // Nếu đã redemption → tiếp tục check các badge khác
    }

    // 2. Check thâm niên
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    const isNewUser = this.createdAt
      ? new Date().getTime() - this.createdAt.getTime() < ONE_MONTH
      : true; // Nếu chưa có createdAt thì coi như user mới

    if (this.totalProjectsFinished === 0 && isNewUser) {
      return BadgeType.NEW;
    }

    //3.Check đẳng cấp (Trusted)
    // Điều kiện: Đã KYC + Điểm cao > 4.5 + Làm nhiều > 5 dự án
    if (
      this.isVerified &&
      Number(this.currentTrustScore) >= 4.5 &&
      this.totalProjectsFinished >= 5
    ) {
      return BadgeType.TRUSTED;
    }

    // 4. Check đã xác thực
    if (this.isVerified) {
      return BadgeType.VERIFIED;
    }
    return BadgeType.NORMAL;
  }

  // --- E06: Gom nhóm thống kê cho Frontend dễ dùng (Optional) ---
  @Expose()
  get stats() {
    return {
      finished: this.totalProjectsFinished,
      disputes: this.totalDisputesLost,
      score: Number(this.currentTrustScore), // Đảm bảo là số
    };
  }

  // --- E07: Warning level từ flags (tính toán từ DB) ---
  // Note: Đây chỉ là placeholder, actual logic nên lấy từ UserWarningService
  // vì cần query database để lấy flags active
  @Expose()
  get warningLevel(): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'SEVERE' {
    // Dựa trên totalDisputesLost để estimate warning level
    // (Thực tế sẽ được override bởi API response từ UserWarningService)
    if (this.totalDisputesLost >= 4) return 'SEVERE';
    if (this.totalDisputesLost >= 3) return 'CRITICAL';
    if (this.totalDisputesLost >= 2) return 'HIGH';
    if (this.totalDisputesLost >= 1) return 'MEDIUM';
    return 'NONE';
  }
}
