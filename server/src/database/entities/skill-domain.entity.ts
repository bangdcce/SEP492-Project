// =============================================================================
// SKILL DOMAIN ENTITY (Lĩnh vực/Categories - Layer 1)
// =============================================================================
// Master list of domains/categories - Managed by Admin only
// Example: E-commerce, FinTech, EdTech, Healthcare, Mobile App, Web System
// =============================================================================

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('skill_domains')
@Index(['slug'], { unique: true })
export class SkillDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === BASIC INFO ===
  @Column({ type: 'varchar', length: 100, comment: 'Display name (e.g., "E-commerce")' })
  name: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'URL-friendly slug (e.g., "e-commerce")',
  })
  slug: string;

  @Column({ type: 'text', nullable: true, comment: 'Description of the domain' })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'Icon name (e.g., "shopping-cart")',
  })
  icon: string | null;

  // === WIZARD MAPPING ===
  @Column({
    type: 'jsonb',
    nullable: true,
    comment:
      'Mapping from wizard answers to auto-tag. E.g., {"Q1": ["A", "B"]} → client answers these → auto-tag',
  })
  wizardMapping: Record<string, string[]> | null;

  // === SCORING WEIGHTS ===
  @Column({
    type: 'int',
    default: 30,
    comment: 'Weight for matching algorithm (default 30% for domain matching)',
  })
  matchingWeight: number;

  // === STATUS ===
  @Column({ type: 'boolean', default: true, comment: 'Is this domain active for selection?' })
  isActive: boolean;

  @Column({ type: 'int', default: 0, comment: 'Display order in UI' })
  sortOrder: number;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === RELATIONS ===
  @OneToMany('SkillEntity', 'domain')
  skills: any[];
}
