import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractDraftSnapshotLifecycle1772700000000 implements MigrationInterface {
  name = 'ContractDraftSnapshotLifecycle1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "contentHash" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "commercialContext" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "project_specs"
      ADD COLUMN IF NOT EXISTS "lockedByContractId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "project_specs"
      ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "milestones"
      ADD COLUMN IF NOT EXISTS "sourceContractMilestoneKey" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      ADD COLUMN IF NOT EXISTS "contentHash" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      ADD COLUMN IF NOT EXISTS "signerRole" character varying(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      ADD COLUMN IF NOT EXISTS "userAgent" text
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "contracts"
          WHERE "sourceSpecId" IS NOT NULL
            AND COALESCE("status", '') <> 'ARCHIVED'
          GROUP BY "sourceSpecId"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enforce active unique sourceSpecId on contracts: duplicate live rows already exist.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_contracts_sourceSpecId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contracts_sourceSpecId"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_contracts_sourceSpecId_active"
      ON "contracts" ("sourceSpecId")
      WHERE "sourceSpecId" IS NOT NULL
        AND "status" <> 'ARCHIVED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_contracts_sourceSpecId_active"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_contracts_sourceSpecId"
      ON "contracts" ("sourceSpecId")
      WHERE "sourceSpecId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      DROP COLUMN IF EXISTS "userAgent"
    `);
    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      DROP COLUMN IF EXISTS "signerRole"
    `);
    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      DROP COLUMN IF EXISTS "contentHash"
    `);
    await queryRunner.query(`
      ALTER TABLE "milestones"
      DROP COLUMN IF EXISTS "sourceContractMilestoneKey"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_specs"
      DROP COLUMN IF EXISTS "lockedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_specs"
      DROP COLUMN IF EXISTS "lockedByContractId"
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "commercialContext"
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "contentHash"
    `);
  }
}
