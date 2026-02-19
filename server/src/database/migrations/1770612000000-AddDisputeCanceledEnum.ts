import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeCanceledEnum1770612000000 implements MigrationInterface {
  name = 'AddDisputeCanceledEnum1770612000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'CANCELED';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TYPE "public"."dispute_activities_action_enum" ADD VALUE IF NOT EXISTS 'CANCELED';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END
      $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres enum values cannot be removed safely in-place. Intentionally no-op.
  }
}
