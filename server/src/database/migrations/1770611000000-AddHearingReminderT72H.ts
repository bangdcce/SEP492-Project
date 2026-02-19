import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHearingReminderT72H1770611000000 implements MigrationInterface {
  name = 'AddHearingReminderT72H1770611000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TYPE "public"."hearing_reminder_deliveries_remindertype_enum" ADD VALUE IF NOT EXISTS 'T72H';
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
