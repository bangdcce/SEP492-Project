import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTaskSubmissionTable1770358129036 implements MigrationInterface {
    name = 'CreateTaskSubmissionTable1770358129036'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_parentTask"`);
        await queryRunner.query(`ALTER TABLE "task_links" DROP CONSTRAINT "FK_task_links_task"`);
        await queryRunner.query(`CREATE TYPE "public"."task_submissions_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'REQUEST_CHANGES')`);
        await queryRunner.query(`CREATE TABLE "task_submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "attachments" jsonb NOT NULL DEFAULT '[]', "version" integer NOT NULL, "status" "public"."task_submissions_status_enum" NOT NULL DEFAULT 'PENDING', "submitterId" uuid NOT NULL, "taskId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8d19d6b5dd776e373113de50018" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_34701b0b8d466af308ba202e4ef" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_submissions" ADD CONSTRAINT "FK_244f39fcbecb5ec48e68b120f37" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_submissions" ADD CONSTRAINT "FK_8b64cdeb41cbea6ce153dde4881" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_links" ADD CONSTRAINT "FK_12e04786c9ec8436f467421b11d" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_links" DROP CONSTRAINT "FK_12e04786c9ec8436f467421b11d"`);
        await queryRunner.query(`ALTER TABLE "task_submissions" DROP CONSTRAINT "FK_8b64cdeb41cbea6ce153dde4881"`);
        await queryRunner.query(`ALTER TABLE "task_submissions" DROP CONSTRAINT "FK_244f39fcbecb5ec48e68b120f37"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_34701b0b8d466af308ba202e4ef"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`DROP TABLE "task_submissions"`);
        await queryRunner.query(`DROP TYPE "public"."task_submissions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "task_links" ADD CONSTRAINT "FK_task_links_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_parentTask" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
