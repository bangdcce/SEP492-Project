import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeHotPathIndexes1770614000000 implements MigrationInterface {
  name = 'AddDisputeHotPathIndexes1770614000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_status_assigned_created"
      ON "disputes" ("status", "assignedStaffId", "createdAt");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_status_resolution_deadline"
      ON "disputes" ("status", "resolutionDeadline");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_groupId"
      ON "disputes" ("groupId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_groupId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_status_resolution_deadline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_status_assigned_created"`);
  }
}
