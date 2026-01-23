// =============================================================================
// USER SKILL DOMAIN ENTITY (User-Domain Junction Table)
// =============================================================================
// Links users to skill domains (Layer 1 - Lĩnh vực)
// Example: User John works in E-commerce, FinTech domains
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

@Entity('user_skill_domains')
@Unique(['userId', 'domainId']) // Each user can have each domain only once
@Index(['userId'])
@Index(['domainId'])
export class UserSkillDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === REFERENCES ===
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  domainId: string;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @ManyToOne('UserEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: any;

  @ManyToOne('SkillDomainEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'domainId' })
  domain: any;
}
