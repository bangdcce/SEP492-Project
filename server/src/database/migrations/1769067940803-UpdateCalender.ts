import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCalender1769067940803 implements MigrationInterface {
    name = 'UpdateCalender1769067940803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationToken"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "termsAcceptedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "privacyAcceptedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "registrationIp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "registrationUserAgent"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "submission_note" text`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "proof_link" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "submitted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "pendingAppealCases" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."pendingAppealCases" IS 'Số case đang IN_APPEAL chưa đóng (loại khỏi calculation)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "totalCasesFinalized" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."totalCasesFinalized" IS 'Số case đã finalized (used for accurate calculation)'`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" ADD "lastOnlineAt" TIMESTAMP`);
        await queryRunner.query(`COMMENT ON COLUMN "hearing_participants"."lastOnlineAt" IS 'Lần online gần nhất'`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" ADD "totalOnlineMinutes" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "hearing_participants"."totalOnlineMinutes" IS 'Tổng phút online trong phiên'`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD "title" character varying(255)`);
        await queryRunner.query(`CREATE TYPE "public"."hearing_statements_status_enum" AS ENUM('DRAFT', 'SUBMITTED')`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD "status" "public"."hearing_statements_status_enum" NOT NULL DEFAULT 'DRAFT'`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD "retractionOfStatementId" uuid`);
        await queryRunner.query(`CREATE TYPE "public"."hearing_questions_status_enum" AS ENUM('PENDING_ANSWER', 'ANSWERED', 'CANCELLED_BY_MODERATOR')`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD "status" "public"."hearing_questions_status_enum" NOT NULL DEFAULT 'PENDING_ANSWER'`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD "cancelledAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD "cancelledById" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."calendar_events_type_enum" RENAME TO "calendar_events_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."calendar_events_type_enum" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'TASK_DEADLINE', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ALTER COLUMN "type" TYPE "public"."calendar_events_type_enum" USING "type"::"text"::"public"."calendar_events_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."auto_schedule_rules_eventtype_enum" RENAME TO "auto_schedule_rules_eventtype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."auto_schedule_rules_eventtype_enum" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'TASK_DEADLINE', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "eventType" TYPE "public"."auto_schedule_rules_eventtype_enum" USING "eventType"::"text"::"public"."auto_schedule_rules_eventtype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."auto_schedule_rules_eventtype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD CONSTRAINT "FK_563a966c8469466df1c6200004e" FOREIGN KEY ("retractionOfStatementId") REFERENCES "hearing_statements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD CONSTRAINT "FK_0a74115a3ce8722a5a4580a37f3" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP CONSTRAINT "FK_0a74115a3ce8722a5a4580a37f3"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP CONSTRAINT "FK_563a966c8469466df1c6200004e"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`CREATE TYPE "public"."auto_schedule_rules_eventtype_enum_old" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "eventType" TYPE "public"."auto_schedule_rules_eventtype_enum_old" USING "eventType"::"text"::"public"."auto_schedule_rules_eventtype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."auto_schedule_rules_eventtype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."auto_schedule_rules_eventtype_enum_old" RENAME TO "auto_schedule_rules_eventtype_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."calendar_events_type_enum_old" AS ENUM('DISPUTE_HEARING', 'PROJECT_MEETING', 'INTERNAL_MEETING', 'PERSONAL_BLOCK', 'REVIEW_SESSION', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "calendar_events" ALTER COLUMN "type" TYPE "public"."calendar_events_type_enum_old" USING "type"::"text"::"public"."calendar_events_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."calendar_events_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."calendar_events_type_enum_old" RENAME TO "calendar_events_type_enum"`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP COLUMN "cancelledById"`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP COLUMN "cancelledAt"`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."hearing_questions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP COLUMN "retractionOfStatementId"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."hearing_statements_status_enum"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP COLUMN "title"`);
        await queryRunner.query(`COMMENT ON COLUMN "hearing_participants"."totalOnlineMinutes" IS 'Tổng phút online trong phiên'`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" DROP COLUMN "totalOnlineMinutes"`);
        await queryRunner.query(`COMMENT ON COLUMN "hearing_participants"."lastOnlineAt" IS 'Lần online gần nhất'`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" DROP COLUMN "lastOnlineAt"`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."totalCasesFinalized" IS 'Số case đã finalized (used for accurate calculation)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "totalCasesFinalized"`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."pendingAppealCases" IS 'Số case đang IN_APPEAL chưa đóng (loại khỏi calculation)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "pendingAppealCases"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submitted_at"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "proof_link"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submission_note"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "registrationUserAgent" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "registrationIp" character varying(45)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "privacyAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "termsAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationExpires" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationToken" character varying(64)`);
    }

}
