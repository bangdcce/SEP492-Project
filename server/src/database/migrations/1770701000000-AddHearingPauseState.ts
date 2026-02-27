import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHearingPauseState1770701000000 implements MigrationInterface {
  name = 'AddHearingPauseState1770701000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'dispute_hearings_status_enum'
            AND e.enumlabel = 'PAUSED'
        ) THEN
          ALTER TYPE "public"."dispute_hearings_status_enum" ADD VALUE 'PAUSED';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "pausedById" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "pauseReason" text
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "accumulatedPauseSeconds" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "speakerRoleBeforePause" "public"."dispute_hearings_currentspeakerrole_enum"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_hearings_status_pausedAt"
      ON "dispute_hearings" ("status", "pausedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_hearings_status_pausedAt"`);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "speakerRoleBeforePause"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "accumulatedPauseSeconds"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "pauseReason"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "pausedById"
    `);
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "pausedAt"
    `);
  }
}
