import { MigrationInterface, QueryRunner } from "typeorm";

export class EditTaskSubmissionColumnApproval1771009827919 implements MigrationInterface {
    name = 'EditTaskSubmissionColumnApproval1771009827919'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_users_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_deletedAt"`);
        await queryRunner.query(`ALTER TABLE "task_submissions" ADD "reviewNote" text`);
        await queryRunner.query(`ALTER TABLE "task_submissions" ADD "reviewerId" uuid`);
        await queryRunner.query(`ALTER TABLE "task_submissions" ADD "reviewedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TYPE "public"."users_status_enum" RENAME TO "users_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'DELETED')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "task_submissions" ADD CONSTRAINT "FK_ffd7e03786e2ac6c1aed69a0503" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_submissions" DROP CONSTRAINT "FK_ffd7e03786e2ac6c1aed69a0503"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum_old" AS ENUM('ACTIVE', 'DELETED')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum_old" USING "status"::"text"::"public"."users_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_status_enum_old" RENAME TO "users_status_enum"`);
        await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "reviewedAt"`);
        await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "reviewerId"`);
        await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "reviewNote"`);
        await queryRunner.query(`CREATE INDEX "IDX_users_deletedAt" ON "users" ("deletedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_users_status" ON "users" ("status") `);
    }

}
