import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteFieldsToUsers1770400000000 implements MigrationInterface {
  name = 'AddSoftDeleteFieldsToUsers1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UserStatus enum type (follows users_<column>_enum convention)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_status_enum" AS ENUM ('ACTIVE', 'DELETED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add status column with default ACTIVE
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "status" "users_status_enum" NOT NULL DEFAULT 'ACTIVE'
    `);

    // Add deletedAt column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP
    `);

    // Add deletedReason column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "deletedReason" varchar(255)
    `);

    // Create index on status for faster queries filtering active users
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_status" ON "users" ("status")
    `);

    // Create index on deletedAt for cleanup queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_deletedAt" ON "users" ("deletedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_deletedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletedReason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_status_enum"`);
  }
}
