import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractMilestoneSnapshotAndActivatedAt1772000000000
  implements MigrationInterface
{
  name = 'AddContractMilestoneSnapshotAndActivatedAt1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "activatedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "milestoneSnapshot" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "milestoneSnapshot",
      DROP COLUMN IF EXISTS "activatedAt";
    `);
  }
}
