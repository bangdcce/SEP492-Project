import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecContractPhaseFlow1770800000000 implements MigrationInterface {
  name = 'SpecContractPhaseFlow1770800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_specs_status_enum') THEN
          ALTER TYPE project_specs_status_enum ADD VALUE IF NOT EXISTS 'CLIENT_REVIEW';
          ALTER TYPE project_specs_status_enum ADD VALUE IF NOT EXISTS 'CLIENT_APPROVED';
          ALTER TYPE project_specs_status_enum ADD VALUE IF NOT EXISTS 'FINAL_REVIEW';
          ALTER TYPE project_specs_status_enum ADD VALUE IF NOT EXISTS 'ALL_SIGNED';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'spec_phase_enum') THEN
          CREATE TYPE spec_phase_enum AS ENUM ('CLIENT_SPEC', 'FULL_SPEC');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "project_specs"
      ADD COLUMN IF NOT EXISTS "specPhase" spec_phase_enum,
      ADD COLUMN IF NOT EXISTS "parentSpecId" uuid,
      ADD COLUMN IF NOT EXISTS "clientFeatures" jsonb,
      ADD COLUMN IF NOT EXISTS "estimatedTimeline" character varying(255),
      ADD COLUMN IF NOT EXISTS "projectCategory" character varying(120),
      ADD COLUMN IF NOT EXISTS "clientApprovedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "richContentJson" jsonb;
    `);

    await queryRunner.query(`
      UPDATE "project_specs"
      SET "specPhase" = 'FULL_SPEC'::spec_phase_enum
      WHERE "specPhase" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "project_specs"
      ALTER COLUMN "specPhase" SET DEFAULT 'FULL_SPEC';
    `);

    await queryRunner.query(`
      DO $$
      DECLARE rec RECORD;
      BEGIN
        FOR rec IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'project_specs'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE '%"requestId"%'
        LOOP
          EXECUTE format('ALTER TABLE "project_specs" DROP CONSTRAINT IF EXISTS %I', rec.conname);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'project_specs'
            AND constraint_name = 'FK_project_specs_parent_spec'
        ) THEN
          ALTER TABLE "project_specs"
          ADD CONSTRAINT "FK_project_specs_parent_spec"
          FOREIGN KEY ("parentSpecId") REFERENCES "project_specs"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_project_specs_parentSpecId"
      ON "project_specs" ("parentSpecId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_spec_signatures" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "specId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "signerRole" character varying(32) NOT NULL,
        "signedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_spec_signatures_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_spec_signatures_spec_user" UNIQUE ("specId", "userId"),
        CONSTRAINT "FK_project_spec_signatures_spec" FOREIGN KEY ("specId") REFERENCES "project_specs"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_project_spec_signatures_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "sourceSpecId" uuid;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'contracts'
            AND constraint_name = 'FK_contracts_source_spec'
        ) THEN
          ALTER TABLE "contracts"
          ADD CONSTRAINT "FK_contracts_source_spec"
          FOREIGN KEY ("sourceSpecId") REFERENCES "project_specs"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_sourceSpecId"
      ON "contracts" ("sourceSpecId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contracts_sourceSpecId"`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT IF EXISTS "FK_contracts_source_spec"`);
    await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN IF EXISTS "sourceSpecId"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "project_spec_signatures"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_project_specs_parentSpecId"`);
    await queryRunner.query(
      `ALTER TABLE "project_specs" DROP CONSTRAINT IF EXISTS "FK_project_specs_parent_spec"`,
    );
    await queryRunner.query(`
      ALTER TABLE "project_specs"
      DROP COLUMN IF EXISTS "richContentJson",
      DROP COLUMN IF EXISTS "clientApprovedAt",
      DROP COLUMN IF EXISTS "projectCategory",
      DROP COLUMN IF EXISTS "estimatedTimeline",
      DROP COLUMN IF EXISTS "clientFeatures",
      DROP COLUMN IF EXISTS "parentSpecId",
      DROP COLUMN IF EXISTS "specPhase";
    `);
    // Enum values are intentionally kept for backward compatibility.
  }
}
