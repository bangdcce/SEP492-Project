import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHearingReminderDeliveries1770605000000 implements MigrationInterface {
  name = 'CreateHearingReminderDeliveries1770605000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."hearing_reminder_deliveries_remindertype_enum" AS ENUM('T24H', 'T1H', 'T10M');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "hearing_reminder_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hearingId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "reminderType" "public"."hearing_reminder_deliveries_remindertype_enum" NOT NULL,
        "scheduledFor" TIMESTAMP NOT NULL,
        "notificationId" uuid,
        "emailSent" boolean NOT NULL DEFAULT false,
        "emailSentAt" TIMESTAMP,
        "deliveredAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hearing_reminder_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hearing_reminder_deliveries_hearing_user_type" UNIQUE ("hearingId", "userId", "reminderType")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_hearing_reminder_deliveries_hearing_type"
      ON "hearing_reminder_deliveries" ("hearingId", "reminderType")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_hearing_reminder_deliveries_delivered_at"
      ON "hearing_reminder_deliveries" ("deliveredAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_hearing_reminder_deliveries_delivered_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_hearing_reminder_deliveries_hearing_type"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "hearing_reminder_deliveries"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."hearing_reminder_deliveries_remindertype_enum"`,
    );
  }
}
