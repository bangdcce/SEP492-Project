// =============================================================================
// USER SKILL ENTITY (User-Skill Junction Table)
// =============================================================================
// Links users to skills with additional metadata:
// - Primary vs Secondary skill
// - Verified status (from completed projects)
// - Proficiency level (optional, for future)
// =============================================================================

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { UserRole } from './user.entity';

export enum SkillPriority {
  PRIMARY = 'PRIMARY', // Thế mạnh chính - High weight in matching
  SECONDARY = 'SECONDARY', // Biết thêm - Lower weight
}

export enum SkillVerificationStatus {
  SELF_DECLARED = 'SELF_DECLARED', // User tự khai
  PORTFOLIO_LINKED = 'PORTFOLIO_LINKED', // Có portfolio/github linked
  PROJECT_VERIFIED = 'PROJECT_VERIFIED', // Đã hoàn thành dự án với skill này
  ADMIN_VERIFIED = 'ADMIN_VERIFIED', // Admin xác nhận (rare)
}

@Entity('user_skills')
@Unique(['userId', 'skillId']) // Each user can have each skill only once
@Index(['userId', 'priority'])
@Index(['skillId', 'verificationStatus'])
export class UserSkillEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === REFERENCES ===
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  skillId: string;

  // === SKILL METADATA ===
  @Column({
    type: 'enum',
    enum: SkillPriority,
    default: SkillPriority.SECONDARY,
    comment: 'PRIMARY = main strength, SECONDARY = additional skill',
  })
  priority: SkillPriority;

  @Column({
    type: 'enum',
    enum: SkillVerificationStatus,
    default: SkillVerificationStatus.SELF_DECLARED,
    comment: 'How was this skill verified?',
  })
  verificationStatus: SkillVerificationStatus;

  // === EVIDENCE ===
  @Column({ type: 'text', nullable: true, comment: 'Link to portfolio or proof' })
  portfolioUrl: string | null;

  @Column({ type: 'int', default: 0, comment: 'Number of completed projects using this skill' })
  completedProjectsCount: number;

  @Column({ type: 'timestamp', nullable: true, comment: 'When last used in a completed project' })
  lastUsedAt: Date | null;

  // === PROFICIENCY (Future use for advanced matching) ===
  @Column({
    type: 'int',
    nullable: true,
    comment: 'Self-rated proficiency 1-10 (optional, for future)',
  })
  proficiencyLevel: number | null;

  @Column({
    type: 'int',
    nullable: true,
    comment: 'Years of experience with this skill',
  })
  yearsOfExperience: number | null;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @ManyToOne('SkillEntity', 'userSkills', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: any;
}

// =============================================================================
// STAFF EXPERTISE ENTITY (Staff's Audit Skills for Dispute Assignment)
// =============================================================================
// Separate table for Staff audit capabilities
// Used by staff-assignment algorithm to match Staff with dispute type
// Example: "Security Auditor" staff assigned to fraud disputes
// =============================================================================

@Entity('staff_expertise')
@Unique(['staffId', 'skillId'])
@Index(['staffId'])
@Index(['skillId'])
export class StaffExpertiseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === REFERENCES ===
  @Column({ type: 'uuid', comment: 'Staff user ID' })
  staffId: string;

  @Column({ type: 'uuid', comment: 'Skill (should have forStaff=true)' })
  skillId: string;

  // === EXPERTISE LEVEL ===
  @Column({
    type: 'int',
    default: 1,
    comment: 'Expertise level 1-5 (affects assignment priority)',
  })
  expertiseLevel: number;

  // === CERTIFICATION (Optional) ===
  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Certification name if any' })
  certificationName: string | null;

  @Column({ type: 'date', nullable: true, comment: 'Certification expiry date' })
  certificationExpiry: Date | null;

  // === PERFORMANCE ===
  @Column({ type: 'int', default: 0, comment: 'Disputes handled with this expertise' })
  disputesHandled: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    comment: 'Success rate % for disputes in this area',
  })
  successRate: number;

  // === STATUS ===
  @Column({ type: 'boolean', default: true, comment: 'Is this expertise active?' })
  isActive: boolean;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: any;

  @ManyToOne('SkillEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: any;
}
