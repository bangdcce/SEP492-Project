// =============================================================================
// SKILL ENTITY (Kỹ năng/Tech Stacks - Layer 2)
// =============================================================================
// Master list of skills - Managed by Admin only
// Example: ReactJS, NestJS, Flutter, AWS, UI/UX Design, Manual Testing
// =============================================================================

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

export enum SkillCategory {
  // For Freelancers
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  MOBILE = 'MOBILE',
  DATABASE = 'DATABASE',
  DEVOPS = 'DEVOPS',
  DESIGN = 'DESIGN',
  TESTING = 'TESTING',
  DATA = 'DATA',
  AI_ML = 'AI_ML',

  // For Brokers
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',
  PROJECT_MANAGEMENT = 'PROJECT_MANAGEMENT',
  CONSULTING = 'CONSULTING',
  DOMAIN_EXPERTISE = 'DOMAIN_EXPERTISE',

  // For Staff (Audit skills)
  AUDIT_SECURITY = 'AUDIT_SECURITY',
  AUDIT_CODE_QUALITY = 'AUDIT_CODE_QUALITY',
  AUDIT_FINANCE = 'AUDIT_FINANCE',
  AUDIT_LEGAL = 'AUDIT_LEGAL',
  AUDIT_TECHNICAL = 'AUDIT_TECHNICAL',

  OTHER = 'OTHER',
}

@Entity('skills')
@Index(['slug'], { unique: true })
@Index(['domainId', 'category'])
export class SkillEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === PARENT DOMAIN ===
  @Column({ type: 'uuid', nullable: true, comment: 'Parent domain (Layer 1)' })
  domainId: string | null;

  // === BASIC INFO ===
  @Column({ type: 'varchar', length: 100, comment: 'Display name (e.g., "ReactJS")' })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'URL-friendly slug (e.g., "reactjs")',
  })
  slug: string;

  @Column({ type: 'text', nullable: true, comment: 'Description of the skill' })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Icon name or URL' })
  icon: string | null;

  // === CATEGORIZATION ===
  @Column({
    type: 'enum',
    enum: SkillCategory,
    default: SkillCategory.OTHER,
    comment: 'Skill category for filtering',
  })
  category: SkillCategory;

  @Column({
    type: 'simple-array',
    nullable: true,
    comment: 'Alternative names/aliases for search. E.g., ["React", "React.js"]',
  })
  aliases: string[] | null;

  // === ROLE APPLICABILITY ===
  @Column({ type: 'boolean', default: true, comment: 'Can Freelancers select this skill?' })
  forFreelancer: boolean;

  @Column({ type: 'boolean', default: false, comment: 'Can Brokers select this skill?' })
  forBroker: boolean;

  @Column({ type: 'boolean', default: false, comment: 'Is this an audit skill for Staff?' })
  forStaff: boolean;

  // === SCORING WEIGHTS ===
  @Column({
    type: 'int',
    default: 70,
    comment: 'Weight for matching algorithm (default 70% for skill matching)',
  })
  matchingWeight: number;

  // === STATUS ===
  @Column({ type: 'boolean', default: true, comment: 'Is this skill active for selection?' })
  isActive: boolean;

  @Column({ type: 'int', default: 0, comment: 'Display order in UI' })
  sortOrder: number;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('SkillDomainEntity', 'skills', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'domainId' })
  domain: any;

  @OneToMany('UserSkillEntity', 'skill')
  userSkills: any[];
}
