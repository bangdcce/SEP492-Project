import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHearingEvidenceIntakeAndWorkspaceIndexes1770632000000
  implements MigrationInterface
{
  name = 'AddHearingEvidenceIntakeAndWorkspaceIndexes1770632000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "isEvidenceIntakeOpen" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "evidenceIntakeOpenedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "evidenceIntakeClosedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "evidenceIntakeOpenedBy" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "evidenceIntakeReason" text
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_hearings_dispute_status_started"
      ON "dispute_hearings" ("disputeId", "status", "startedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_milestones_project_id"
      ON "milestones" ("projectId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_project_id"
      ON "contracts" ("projectId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contracts_project_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_milestones_project_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_hearings_dispute_status_started"`);

    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "evidenceIntakeReason"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "evidenceIntakeOpenedBy"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "evidenceIntakeClosedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "evidenceIntakeOpenedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "isEvidenceIntakeOpen"
    `);
  }
}

