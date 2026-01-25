import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskEntity1769280861997 implements MigrationInterface {
    name = 'AddTaskEntity1769280861997'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "task_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "actorId" uuid, "fieldChanged" character varying(50) NOT NULL, "oldValue" text, "newValue" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_716670443aea4a2f4a599bb7c53" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`);
        await queryRunner.query(`ALTER TABLE "task_history" ADD CONSTRAINT "FK_158887786322644785a61e6980e" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_history" ADD CONSTRAINT "FK_c1868055eed5213f0ea2cac9c1f" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_history" DROP CONSTRAINT "FK_c1868055eed5213f0ea2cac9c1f"`);
        await queryRunner.query(`ALTER TABLE "task_history" DROP CONSTRAINT "FK_158887786322644785a61e6980e"`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`);
        await queryRunner.query(`DROP TABLE "task_history"`);
    }

}
