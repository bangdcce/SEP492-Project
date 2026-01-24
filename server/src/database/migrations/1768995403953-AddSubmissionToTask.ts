import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionToTask1768995403953 implements MigrationInterface {
  name = 'AddSubmissionToTask1768995403953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD "submissionNote" text`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "proofLink" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "submittedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TYPE "public"."calendar_events_type_enum" RENAME TO "calendar_events_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."calendar_events_type_enum" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'TASK_DEADLINE', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_events" ALTER COLUMN "type" TYPE "public"."calendar_events_type_enum" USING "type"::"text"::"public"."calendar_events_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "public"."auto_schedule_rules_eventtype_enum" RENAME TO "auto_schedule_rules_eventtype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auto_schedule_rules_eventtype_enum" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'TASK_DEADLINE', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "eventType" TYPE "public"."auto_schedule_rules_eventtype_enum" USING "eventType"::"text"::"public"."auto_schedule_rules_eventtype_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."auto_schedule_rules_eventtype_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auto_schedule_rules_eventtype_enum_old" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "eventType" TYPE "public"."auto_schedule_rules_eventtype_enum_old" USING "eventType"::"text"::"public"."auto_schedule_rules_eventtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."auto_schedule_rules_eventtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."auto_schedule_rules_eventtype_enum_old" RENAME TO "auto_schedule_rules_eventtype_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."calendar_events_type_enum_old" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'OTHER')`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_events" ALTER COLUMN "type" TYPE "public"."calendar_events_type_enum_old" USING "type"::"text"::"public"."calendar_events_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."calendar_events_type_enum_old" RENAME TO "calendar_events_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submittedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "proofLink"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submissionNote"`);
  }
}
