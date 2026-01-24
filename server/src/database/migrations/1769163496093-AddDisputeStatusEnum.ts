import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisputeStatusEnum1769163496093 implements MigrationInterface {
    name = 'AddDisputeStatusEnum1769163496093'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "pendingAppealCases" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."pendingAppealCases" IS 'Số case đang IN_APPEAL chưa đóng (loại khỏi calculation)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "totalCasesFinalized" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."totalCasesFinalized" IS 'Số case đã finalized (used for accurate calculation)'`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "infoRequestReason" text`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "infoRequestedById" character varying`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "infoRequestedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "infoProvidedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "dismissalHoldUntil" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "rejectionAppealReason" text`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "rejectionAppealedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "rejectionAppealResolvedById" character varying`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "rejectionAppealResolution" text`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "rejectionAppealResolvedAt" TIMESTAMP`);
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
        await queryRunner.query(`ALTER TYPE "public"."projects_status_enum" RENAME TO "projects_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('INITIALIZING', 'PLANNING', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'PAID', 'DISPUTED', 'CANCELED')`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."projects_status_enum" USING "status"::"text"::"public"."projects_status_enum"`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PLANNING'`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "project_specs" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`ALTER TABLE "project_specs" ALTER COLUMN "updatedAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."deliverable_type_enum" RENAME TO "deliverable_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."milestones_deliverabletype_enum" AS ENUM('DESIGN_PROTOTYPE', 'API_DOCS', 'DEPLOYMENT', 'SOURCE_CODE', 'SYS_OPERATION_DOCS', 'CREDENTIAL_VAULT', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" TYPE "public"."milestones_deliverabletype_enum" USING "deliverableType"::"text"::"public"."milestones_deliverabletype_enum"`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" SET DEFAULT 'OTHER'`);
        await queryRunner.query(`DROP TYPE "public"."deliverable_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" SET NOT NULL`);
        await queryRunner.query(
            `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'REJECTION_APPEALED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'APPEALED'`,
        );
        await queryRunner.query(`ALTER TYPE "public"."dispute_activities_action_enum" RENAME TO "dispute_activities_action_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."dispute_activities_action_enum" AS ENUM('CREATED', 'ESCALATED', 'RESOLVED', 'REJECTED', 'REVIEW_ACCEPTED', 'INFO_REQUESTED', 'INFO_PROVIDED', 'REJECTION_APPEALED', 'REJECTION_APPEAL_RESOLVED', 'REOPENED', 'EVIDENCE_ADDED', 'EVIDENCE_REMOVED', 'DEFENDANT_RESPONDED', 'DEFENDANT_EVIDENCE_ADDED', 'NOTE_ADDED', 'PRIORITY_CHANGED', 'CATEGORY_CHANGED', 'ASSIGNED', 'DEADLINE_EXTENDED', 'APPEAL_SUBMITTED', 'APPEAL_RESOLVED', 'MESSAGE_SENT', 'NOTIFICATION_SENT')`);
        await queryRunner.query(`ALTER TABLE "dispute_activities" ALTER COLUMN "action" TYPE "public"."dispute_activities_action_enum" USING "action"::"text"::"public"."dispute_activities_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."dispute_activities_action_enum_old"`);
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
        await queryRunner.query(`CREATE TYPE "public"."dispute_activities_action_enum_old" AS ENUM('APPEAL_RESOLVED', 'APPEAL_SUBMITTED', 'ASSIGNED', 'CATEGORY_CHANGED', 'CREATED', 'DEADLINE_EXTENDED', 'DEFENDANT_EVIDENCE_ADDED', 'DEFENDANT_RESPONDED', 'ESCALATED', 'EVIDENCE_ADDED', 'EVIDENCE_REMOVED', 'MESSAGE_SENT', 'NOTE_ADDED', 'NOTIFICATION_SENT', 'PRIORITY_CHANGED', 'REJECTED', 'REOPENED', 'RESOLVED')`);
        await queryRunner.query(`ALTER TABLE "dispute_activities" ALTER COLUMN "action" TYPE "public"."dispute_activities_action_enum_old" USING "action"::"text"::"public"."dispute_activities_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."dispute_activities_action_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."dispute_activities_action_enum_old" RENAME TO "dispute_activities_action_enum"`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" DROP NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."deliverable_type_enum_old" AS ENUM('API_DOCS', 'CREDENTIAL_VAULT', 'DEPLOYMENT', 'DESIGN_PROTOTYPE', 'OTHER', 'SOURCE_CODE', 'SYS_OPERATION_DOCS')`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" TYPE "public"."deliverable_type_enum_old" USING "deliverableType"::"text"::"public"."deliverable_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "deliverableType" SET DEFAULT 'OTHER'`);
        await queryRunner.query(`DROP TYPE "public"."milestones_deliverabletype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deliverable_type_enum_old" RENAME TO "deliverable_type_enum"`);
        await queryRunner.query(`ALTER TABLE "project_specs" ALTER COLUMN "updatedAt" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "project_specs" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL'`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum_old" AS ENUM('CANCELED', 'COMPLETED', 'DISPUTED', 'IN_PROGRESS', 'PAID', 'PLANNING', 'TESTING')`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."projects_status_enum_old" USING "status"::"text"::"public"."projects_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PLANNING'`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."projects_status_enum_old" RENAME TO "projects_status_enum"`);
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
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "rejectionAppealResolvedAt"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "rejectionAppealResolution"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "rejectionAppealResolvedById"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "rejectionAppealedAt"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "rejectionAppealReason"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "dismissalHoldUntil"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "infoProvidedAt"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "infoRequestedAt"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "infoRequestedById"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "infoRequestReason"`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."totalCasesFinalized" IS 'Số case đã finalized (used for accurate calculation)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "totalCasesFinalized"`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."pendingAppealCases" IS 'Số case đang IN_APPEAL chưa đóng (loại khỏi calculation)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "pendingAppealCases"`);
    }

}
