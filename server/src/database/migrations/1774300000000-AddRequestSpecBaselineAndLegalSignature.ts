import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestSpecBaselineAndLegalSignature1774300000000
  implements MigrationInterface
{
  name = 'AddRequestSpecBaselineAndLegalSignature1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_requests"
      ADD COLUMN IF NOT EXISTS "requestedDeadline" varchar,
      ADD COLUMN IF NOT EXISTS "requestScopeBaseline" jsonb
    `);

    await queryRunner.query(`
      UPDATE "project_requests"
      SET "requestedDeadline" = "intendedTimeline"
      WHERE "requestedDeadline" IS NULL
        AND "intendedTimeline" ~ '^\\d{4}-\\d{2}-\\d{2}$'
    `);

    await queryRunner.query(`
      ALTER TABLE "project_specs"
      ADD COLUMN IF NOT EXISTS "submissionVersion" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lastSubmittedSnapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "lastSubmittedDiff" jsonb,
      ADD COLUMN IF NOT EXISTS "changeSummary" text,
      ADD COLUMN IF NOT EXISTS "rejectionHistory" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "milestones"
      ADD COLUMN IF NOT EXISTS "approvedClientFeatureIds" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "legalSignatureStatus" varchar(32) NOT NULL DEFAULT 'NOT_STARTED',
      ADD COLUMN IF NOT EXISTS "provider" varchar(120),
      ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "certificateSerial" varchar(255),
      ADD COLUMN IF NOT EXISTS "legalSignatureEvidence" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      ADD COLUMN IF NOT EXISTS "provider" varchar(120),
      ADD COLUMN IF NOT EXISTS "providerSessionId" varchar(120),
      ADD COLUMN IF NOT EXISTS "legalStatus" varchar(32),
      ADD COLUMN IF NOT EXISTS "certificateSerial" varchar(255),
      ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "providerPayload" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "digital_signatures"
      DROP COLUMN IF EXISTS "providerPayload",
      DROP COLUMN IF EXISTS "verifiedAt",
      DROP COLUMN IF EXISTS "certificateSerial",
      DROP COLUMN IF EXISTS "legalStatus",
      DROP COLUMN IF EXISTS "providerSessionId",
      DROP COLUMN IF EXISTS "provider"
    `);

    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "legalSignatureEvidence",
      DROP COLUMN IF EXISTS "certificateSerial",
      DROP COLUMN IF EXISTS "verifiedAt",
      DROP COLUMN IF EXISTS "provider",
      DROP COLUMN IF EXISTS "legalSignatureStatus"
    `);

    await queryRunner.query(`
      ALTER TABLE "milestones"
      DROP COLUMN IF EXISTS "approvedClientFeatureIds"
    `);

    await queryRunner.query(`
      ALTER TABLE "project_specs"
      DROP COLUMN IF EXISTS "rejectionHistory",
      DROP COLUMN IF EXISTS "changeSummary",
      DROP COLUMN IF EXISTS "lastSubmittedDiff",
      DROP COLUMN IF EXISTS "lastSubmittedSnapshot",
      DROP COLUMN IF EXISTS "submissionVersion"
    `);

    await queryRunner.query(`
      ALTER TABLE "project_requests"
      DROP COLUMN IF EXISTS "requestScopeBaseline",
      DROP COLUMN IF EXISTS "requestedDeadline"
    `);
  }
}
