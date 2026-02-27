import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoShowNoteToDisputeHearings1772305000000 implements MigrationInterface {
  name = 'AddNoShowNoteToDisputeHearings1772305000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      ADD COLUMN IF NOT EXISTS "noShowNote" text;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "dispute_hearings"."noShowNote"
      IS 'Structured no-show documentation for required absent participants';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "dispute_hearings"
      DROP COLUMN IF EXISTS "noShowNote";
    `);
  }
}
