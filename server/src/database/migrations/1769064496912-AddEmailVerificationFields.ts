import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerificationFields1769064496912 implements MigrationInterface {
    name = 'AddEmailVerificationFields1769064496912'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_skill_domains" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "domainId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4e65a495b8249281aff57084337" UNIQUE ("userId", "domainId"), CONSTRAINT "PK_ddaa8409d755b40b4e160994948" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_488f342c925037dc95dd38c407" ON "user_skill_domains" ("domainId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be126f755193c85b7b4359051" ON "user_skill_domains" ("userId") `);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "submission_note"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "proof_link"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "submitted_at"`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registrationIp" character varying(45)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registrationUserAgent" text`);
        await queryRunner.query(`ALTER TYPE "public"."calendar_events_type_enum" RENAME TO "calendar_events_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."calendar_events_type_enum" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ALTER COLUMN "type" TYPE "public"."calendar_events_type_enum" USING "type"::"text"::"public"."calendar_events_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."auto_schedule_rules_eventtype_enum" RENAME TO "auto_schedule_rules_eventtype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."auto_schedule_rules_eventtype_enum" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "eventType" TYPE "public"."auto_schedule_rules_eventtype_enum" USING "eventType"::"text"::"public"."auto_schedule_rules_eventtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."auto_schedule_rules_eventtype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "user_skill_domains" ADD CONSTRAINT "FK_4be126f755193c85b7b4359051b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_skill_domains" ADD CONSTRAINT "FK_488f342c925037dc95dd38c4077" FOREIGN KEY ("domainId") REFERENCES "skill_domains"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_skill_domains" DROP CONSTRAINT "FK_488f342c925037dc95dd38c4077"`);
        await queryRunner.query(`ALTER TABLE "user_skill_domains" DROP CONSTRAINT "FK_4be126f755193c85b7b4359051b"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`CREATE TYPE "public"."auto_schedule_rules_eventtype_enum_old" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'TASK_DEADLINE', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "eventType" TYPE "public"."auto_schedule_rules_eventtype_enum_old" USING "eventType"::"text"::"public"."auto_schedule_rules_eventtype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."auto_schedule_rules_eventtype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."auto_schedule_rules_eventtype_enum_old" RENAME TO "auto_schedule_rules_eventtype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."calendar_events_type_enum_old" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'TASK_DEADLINE', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ALTER COLUMN "type" TYPE "public"."calendar_events_type_enum_old" USING "type"::"text"::"public"."calendar_events_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."calendar_events_type_enum_old" RENAME TO "calendar_events_type_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "registrationUserAgent"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "registrationIp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "privacyAcceptedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "termsAcceptedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerifiedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationToken"`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "submitted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "proof_link" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "submission_note" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4be126f755193c85b7b4359051"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_488f342c925037dc95dd38c407"`);
        await queryRunner.query(`DROP TABLE "user_skill_domains"`);
    }

}
