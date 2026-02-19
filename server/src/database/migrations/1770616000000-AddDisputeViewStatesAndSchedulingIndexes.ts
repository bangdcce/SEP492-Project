import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeViewStatesAndSchedulingIndexes1770616000000
  implements MigrationInterface
{
  name = 'AddDisputeViewStatesAndSchedulingIndexes1770616000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_view_states" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "lastViewedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_view_states_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_view_states_dispute" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_dispute_view_states_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dispute_view_states_dispute_user"
      ON "dispute_view_states" ("disputeId", "userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_view_states_user_updated"
      ON "dispute_view_states" ("userId", "updatedAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_raised_status_updated"
      ON "disputes" ("raisedById", "status", "updatedAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_defendant_status_updated"
      ON "disputes" ("defendantId", "status", "updatedAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_schedule_proposals_dispute_user_status_start"
      ON "dispute_schedule_proposals" ("disputeId", "userId", "status", "startTime");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dispute_schedule_proposals_dispute_user_status_start"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_defendant_status_updated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_raised_status_updated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_view_states_user_updated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_dispute_view_states_dispute_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_view_states"`);
  }
}

