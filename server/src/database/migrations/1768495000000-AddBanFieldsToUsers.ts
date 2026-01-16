import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBanFieldsToUsers1768495000000 implements MigrationInterface {
  name = 'AddBanFieldsToUsers1768495000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isBanned column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "isBanned" boolean NOT NULL DEFAULT false
    `);

    // Add banReason column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "banReason" text
    `);

    // Add bannedAt column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP
    `);

    // Add bannedBy column (admin user ID)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "bannedBy" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bannedBy"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bannedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "banReason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isBanned"`);
  }
}
