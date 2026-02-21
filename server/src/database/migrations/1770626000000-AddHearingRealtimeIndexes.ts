import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHearingRealtimeIndexes1770626000000 implements MigrationInterface {
  name = 'AddHearingRealtimeIndexes1770626000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hearing_questions_hearing_status_created"
      ON "hearing_questions" ("hearingId", "status", "createdAt");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hearing_statements_hearing_status_created"
      ON "hearing_statements" ("hearingId", "status", "createdAt");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_dispute_messages_hearing_created_partial"
      ON "dispute_messages" ("hearingId", "createdAt")
      WHERE "hearingId" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hearing_participants_hearing_user"
      ON "hearing_participants" ("hearingId", "userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_participants_hearing_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_messages_hearing_created_partial"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_statements_hearing_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_questions_hearing_status_created"`);
  }
}
