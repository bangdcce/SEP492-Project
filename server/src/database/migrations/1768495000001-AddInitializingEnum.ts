import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInitializingEnum1768495000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add INITIALIZING to projects_status_enum
    // Note: Postgres cannot straightforwardly 'ALTER TYPE ... ADD VALUE IF NOT EXISTS' inside a transaction block in older versions,
    // but TypeORM migrations usually run in transactions. We use a safety check block.
    // 'INITIALIZING' for Project
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid  
          WHERE t.typname = 'projects_status_enum' AND e.enumlabel = 'INITIALIZING') THEN
          ALTER TYPE "projects_status_enum" ADD VALUE 'INITIALIZING';
        END IF;
      END
      $$;
    `);

    // 2. Ensure PENDING exists for escrows_status_enum (Plan check)
    // The previous analysis showed Escrow entity uses EscrowStatus.PENDING = 'PENDING'.
    // Default is usually PENDING. Just in case, we verify 'PENDING' exists.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid  
          WHERE t.typname = 'escrows_status_enum' AND e.enumlabel = 'PENDING') THEN
          ALTER TYPE "escrows_status_enum" ADD VALUE 'PENDING';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting enums in Postgres is complex (requires creating new type, migrating data, dropping old type).
    // For this project scope, we will skip the down migration for ENUM add value or just leave it.
    // Ideally, we would not remove an enum value that might be in use.
  }
}
