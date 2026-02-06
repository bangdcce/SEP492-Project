import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskLinksAndSubtasks1770051200000 implements MigrationInterface {
    name = 'AddTaskLinksAndSubtasks1770051200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "parentTaskId" uuid`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_parentTask" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "task_links" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "url" text NOT NULL, "title" character varying(255), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "PK_task_links_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "task_links" ADD CONSTRAINT "FK_task_links_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_links" DROP CONSTRAINT "FK_task_links_task"`);
        await queryRunner.query(`DROP TABLE "task_links"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_parentTask"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "parentTaskId"`);
    }
}
