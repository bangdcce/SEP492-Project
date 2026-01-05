import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, ManyToMany, JoinColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  BROKER = 'BROKER',
  CLIENT = 'CLIENT',
  FREELANCER = 'FREELANCER',
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

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  currentTrustScore: number;

  @Column({ type: 'varchar', length: 6, nullable: true, name: 'resetpasswordotp' })
  resetPasswordOtp: string;

  @Column({ type: 'timestamp', nullable: true, name: 'resetpasswordotpexpires' })
  resetPasswordOtpExpires: Date;

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

  @OneToMany('ProjectEntity', 'client')
  clientProjects: any[];

  @OneToMany('ProjectEntity', 'broker')
  brokerProjects: any[];

  @OneToMany('ProjectEntity', 'freelancer')
  freelancerProjects: any[];
}
