import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeScheduleProposals1770615000000 implements MigrationInterface {
  name = 'AddDisputeScheduleProposals1770615000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."dispute_schedule_proposals_status_enum" AS ENUM (
          'ACTIVE',
          'SUBMITTED',
          'WITHDRAWN'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_schedule_proposals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "startTime" TIMESTAMPTZ NOT NULL,
        "endTime" TIMESTAMPTZ NOT NULL,
        "status" "public"."dispute_schedule_proposals_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "note" text,
        "submittedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_schedule_proposals_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_schedule_proposals_dispute" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_dispute_schedule_proposals_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_schedule_proposals_dispute_user_start"
      ON "dispute_schedule_proposals" ("disputeId", "userId", "startTime");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_schedule_proposals_dispute_range"
      ON "dispute_schedule_proposals" ("disputeId", "startTime", "endTime");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_schedule_proposals_dispute_status"
      ON "dispute_schedule_proposals" ("disputeId", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dispute_schedule_proposals_dispute_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dispute_schedule_proposals_dispute_range"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dispute_schedule_proposals_dispute_user_start"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_schedule_proposals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."dispute_schedule_proposals_status_enum"`);
  }
}
