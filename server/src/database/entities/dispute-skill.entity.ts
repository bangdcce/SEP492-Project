// =============================================================================
// DISPUTE SKILL REQUIREMENT ENTITY
// =============================================================================
// Tags disputes with required audit skills for Staff assignment matching
// Example: Fraud dispute → requires "Security Auditor" + "Financial Logic Expert"
// =============================================================================

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

export enum DisputeSkillSource {
  AUTO_DETECTED = 'AUTO_DETECTED', // System auto-detected from dispute category
  MANUAL_TAGGED = 'MANUAL_TAGGED', // Staff manually added
  ESCALATION = 'ESCALATION', // Added during escalation/appeal
}

@Entity('dispute_skill_requirements')
@Unique(['disputeId', 'skillId'])
@Index(['disputeId'])
@Index(['skillId'])
export class DisputeSkillRequirementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === REFERENCES ===
  @Column({ type: 'uuid' })
  disputeId: string;

  @Column({ type: 'uuid', comment: 'Required audit skill' })
  skillId: string;

  // === METADATA ===
  @Column({
    type: 'enum',
    enum: DisputeSkillSource,
    default: DisputeSkillSource.AUTO_DETECTED,
    comment: 'How was this skill requirement added?',
  })
  source: DisputeSkillSource;

  @Column({
    type: 'int',
    default: 1,
    comment: 'Required expertise level (1-5). Higher = need more expert staff',
  })
  requiredLevel: number;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Is this a mandatory requirement? false = nice-to-have',
  })
  isMandatory: boolean;

  @Column({ type: 'uuid', nullable: true, comment: 'Who added this requirement (if manual)' })
  addedById: string | null;

  @Column({ type: 'text', nullable: true, comment: 'Notes about why this skill is needed' })
  notes: string | null;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('DisputeEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: any;

  @ManyToOne('SkillEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: any;

  @ManyToOne('UserEntity', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'addedById' })
  addedBy: any;
}

// =============================================================================
// SKILL MAPPING RULES ENTITY
// =============================================================================
// Auto-mapping rules: DisputeCategory → Required Skills
// Example: FRAUD → ["Security Auditor", "Financial Logic Expert"]
// =============================================================================

@Entity('skill_mapping_rules')
@Index(['entityType', 'entityValue'])
export class SkillMappingRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // === MAPPING SOURCE ===
  @Column({
    type: 'varchar',
    length: 50,
    comment: 'Entity type to map from. E.g., "DISPUTE_CATEGORY", "WIZARD_ANSWER"',
  })
  entityType: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'Entity value to match. E.g., "FRAUD", "PAYMENT"',
  })
  entityValue: string;

  // === MAPPING TARGET ===
  @Column({ type: 'uuid', comment: 'Skill to auto-assign when matched' })
  skillId: string;

  @Column({
    type: 'int',
    default: 1,
    comment: 'Minimum required expertise level for auto-assignment',
  })
  requiredLevel: number;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Is this a mandatory skill when rule matches?',
  })
  isMandatory: boolean;

  // === STATUS ===
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0, comment: 'Priority when multiple rules match' })
  priority: number;

  // === TIMESTAMPS ===
  @CreateDateColumn()
  createdAt: Date;

  // === RELATIONS ===
  @ManyToOne('SkillEntity', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: any;
}
