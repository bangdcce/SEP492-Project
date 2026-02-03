import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeaveManagement1769866012747 implements MigrationInterface {
    name = 'AddLeaveManagement1769866012747'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_attachments" DROP CONSTRAINT "FK_task_attachments_task"`);
        await queryRunner.query(`ALTER TABLE "task_attachments" DROP CONSTRAINT "FK_task_attachments_user"`);
        await queryRunner.query(`CREATE TYPE "public"."staff_leave_requests_type_enum" AS ENUM('SHORT_TERM', 'LONG_TERM')`);
        await queryRunner.query(`CREATE TYPE "public"."staff_leave_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "staff_leave_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "staffId" uuid NOT NULL, "type" "public"."staff_leave_requests_type_enum" NOT NULL, "status" "public"."staff_leave_requests_status_enum" NOT NULL DEFAULT 'PENDING', "startTime" TIMESTAMP WITH TIME ZONE NOT NULL, "endTime" TIMESTAMP WITH TIME ZONE NOT NULL, "durationMinutes" integer NOT NULL DEFAULT '0', "reason" text, "isAutoApproved" boolean NOT NULL DEFAULT false, "processedById" uuid, "processedAt" TIMESTAMP WITH TIME ZONE, "processedNote" text, "cancelledById" uuid, "cancelledAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_066c3ab8534c6675f094d717d2f" PRIMARY KEY ("id")); COMMENT ON COLUMN "staff_leave_requests"."staffId" IS 'User co role = STAFF'; COMMENT ON COLUMN "staff_leave_requests"."startTime" IS 'Th?i gian b?t ??u ngh? phep'; COMMENT ON COLUMN "staff_leave_requests"."endTime" IS 'Th?i gian k?t thuc ngh? phep'; COMMENT ON COLUMN "staff_leave_requests"."durationMinutes" IS 'T?ng s? phut ngh? (trong gi? lam vi?c)'; COMMENT ON COLUMN "staff_leave_requests"."isAutoApproved" IS 'TRUE = T? ??ng duy?t (short-term)'`);
        await queryRunner.query(`CREATE INDEX "IDX_f06364d9c26debe2955aefb18c" ON "staff_leave_requests" ("staffId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_fe6affc86bd737d0ed35ae638a" ON "staff_leave_requests" ("staffId", "startTime", "endTime") `);
        await queryRunner.query(`CREATE TABLE "staff_leave_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "staffId" uuid NOT NULL, "monthlyAllowanceMinutes" integer NOT NULL DEFAULT '480', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_249a599c0551a94ce801a856a99" PRIMARY KEY ("id")); COMMENT ON COLUMN "staff_leave_policies"."staffId" IS 'User co role = STAFF'; COMMENT ON COLUMN "staff_leave_policies"."monthlyAllowanceMinutes" IS 'T?ng s? phut ngh? phep m?i thang (default 480 = 1 ngay)'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_59315b31da1e22039f4adaeb7f" ON "staff_leave_policies" ("staffId") `);
        await queryRunner.query(`ALTER TABLE "user_availabilities" ADD "linkedLeaveRequestId" uuid`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."linkedLeaveRequestId" IS 'LeaveRequest created this availability'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "totalLeaveMinutes" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."totalLeaveMinutes" IS 'Tổng số phút nghỉ phép trong kỳ (giờ làm việc)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "leaveRequestCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."leaveRequestCount" IS 'Số lượt nghỉ phép trong kỳ'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" ADD "leaveOverageMinutes" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."leaveOverageMinutes" IS 'Số phút nghỉ vượt quota trong kỳ'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."recurringStartTime" IS 'GiềEbắt đầu recurring (08:00)'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."recurringEndTime" IS 'GiềEkết thúc recurring (17:00)'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."recurringEndDate" IS 'Ngày kết thúc hiệu lực (null = vĩnh viềE)'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."note" IS 'Ghi chú (Họp nội bềE NghềEphép...)'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "FK_3ac65a6dc7c2a47a1307d8faaa4" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "FK_6c53a2e5caa7d94888aa08ccfdd" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_availabilities" ADD CONSTRAINT "FK_0ad39d7a62d181f5e03d24b967b" FOREIGN KEY ("linkedLeaveRequestId") REFERENCES "staff_leave_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_leave_policies" ADD CONSTRAINT "FK_59315b31da1e22039f4adaeb7ff" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_attachments" ADD CONSTRAINT "FK_47d3c46e4edb30cdaf97ccdb8d8" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_attachments" ADD CONSTRAINT "FK_4070df3ea94ef8eb1fc86192174" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_attachments" DROP CONSTRAINT "FK_4070df3ea94ef8eb1fc86192174"`);
        await queryRunner.query(`ALTER TABLE "task_attachments" DROP CONSTRAINT "FK_47d3c46e4edb30cdaf97ccdb8d8"`);
        await queryRunner.query(`ALTER TABLE "staff_leave_policies" DROP CONSTRAINT "FK_59315b31da1e22039f4adaeb7ff"`);
        await queryRunner.query(`ALTER TABLE "user_availabilities" DROP CONSTRAINT "FK_0ad39d7a62d181f5e03d24b967b"`);
        await queryRunner.query(`ALTER TABLE "staff_leave_requests" DROP CONSTRAINT "FK_6c53a2e5caa7d94888aa08ccfdd"`);
        await queryRunner.query(`ALTER TABLE "staff_leave_requests" DROP CONSTRAINT "FK_3ac65a6dc7c2a47a1307d8faaa4"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."note" IS 'Ghi chú (Họp nội bộ, Nghỉ phép...)'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."recurringEndDate" IS 'Ngày kết thúc hiệu lực (null = vĩnh viễn)'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."recurringEndTime" IS 'Giờ kết thúc recurring (17:00)'`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."recurringStartTime" IS 'Giờ bắt đầu recurring (08:00)'`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."leaveOverageMinutes" IS 'Số phút nghỉ vượt quota trong kỳ'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "leaveOverageMinutes"`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."leaveRequestCount" IS 'Số lượt nghỉ phép trong kỳ'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "leaveRequestCount"`);
        await queryRunner.query(`COMMENT ON COLUMN "staff_performances"."totalLeaveMinutes" IS 'Tổng số phút nghỉ phép trong kỳ (giờ làm việc)'`);
        await queryRunner.query(`ALTER TABLE "staff_performances" DROP COLUMN "totalLeaveMinutes"`);
        await queryRunner.query(`COMMENT ON COLUMN "user_availabilities"."linkedLeaveRequestId" IS 'LeaveRequest created this availability'`);
        await queryRunner.query(`ALTER TABLE "user_availabilities" DROP COLUMN "linkedLeaveRequestId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_59315b31da1e22039f4adaeb7f"`);
        await queryRunner.query(`DROP TABLE "staff_leave_policies"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe6affc86bd737d0ed35ae638a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f06364d9c26debe2955aefb18c"`);
        await queryRunner.query(`DROP TABLE "staff_leave_requests"`);
        await queryRunner.query(`DROP TYPE "public"."staff_leave_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."staff_leave_requests_type_enum"`);
        await queryRunner.query(`ALTER TABLE "task_attachments" ADD CONSTRAINT "FK_task_attachments_user" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_attachments" ADD CONSTRAINT "FK_task_attachments_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
