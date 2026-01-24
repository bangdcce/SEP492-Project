import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGovernanceFields1706450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────────────────────────────────
    // ADD NEW ENUM VALUES
    // ─────────────────────────────────────────────────────────────────────────

    // Add PENDING_AUDIT to project_specs_status_enum
    await queryRunner.query(`
      ALTER TYPE project_specs_status_enum ADD VALUE IF NOT EXISTS 'PENDING_AUDIT';
    `);

    // Add new MilestoneStatus values
    await queryRunner.query(`
      ALTER TYPE milestones_status_enum ADD VALUE IF NOT EXISTS 'SUBMITTED';
    `);
    await queryRunner.query(`
      ALTER TYPE milestones_status_enum ADD VALUE IF NOT EXISTS 'REVISIONS_REQUIRED';
    `);

    // Create DeliverableType enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE deliverable_type_enum AS ENUM (
          'DESIGN_PROTOTYPE',
          'API_DOCS',
          'DEPLOYMENT',
          'SOURCE_CODE',
          'SYS_OPERATION_DOCS',
          'CREDENTIAL_VAULT',
          'OTHER'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // ADD NEW COLUMNS TO project_specs
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      ALTER TABLE project_specs
      ADD COLUMN IF NOT EXISTS features JSONB,
      ADD COLUMN IF NOT EXISTS "techStack" VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "referenceLinks" JSONB,
      ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // ADD NEW COLUMNS TO milestones
    // ─────────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      ALTER TABLE milestones
      ADD COLUMN IF NOT EXISTS "deliverableType" deliverable_type_enum DEFAULT 'OTHER',
      ADD COLUMN IF NOT EXISTS "retentionAmount" DECIMAL(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "acceptanceCriteria" JSONB,
      ADD COLUMN IF NOT EXISTS "videoDemoUrl" VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns from milestones
    await queryRunner.query(`
      ALTER TABLE milestones
      DROP COLUMN IF EXISTS "deliverableType",
      DROP COLUMN IF EXISTS "retentionAmount",
      DROP COLUMN IF EXISTS "acceptanceCriteria",
      DROP COLUMN IF EXISTS "videoDemoUrl";
    `);

    // Remove columns from project_specs
    await queryRunner.query(`
      ALTER TABLE project_specs
      DROP COLUMN IF EXISTS features,
      DROP COLUMN IF EXISTS "techStack",
      DROP COLUMN IF EXISTS "referenceLinks",
      DROP COLUMN IF EXISTS "rejectionReason",
      DROP COLUMN IF EXISTS "updatedAt";
    `);

    // Note: Enum values cannot be removed safely in PostgreSQL
    // They will be left in place for backwards compatibility
  }
}
