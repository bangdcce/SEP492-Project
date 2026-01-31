import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskAttachments1769710000000 implements MigrationInterface {
    name = 'AddTaskAttachments1769710000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "task_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "uploaderId" uuid NOT NULL, "url" text NOT NULL, "fileName" character varying(255) NOT NULL DEFAULT 'attachment', "fileType" character varying(50) NOT NULL DEFAULT 'image', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "PK_7f18b8e8a6c6a0c87b987a7b0db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "task_attachments" ADD CONSTRAINT "FK_task_attachments_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_attachments" ADD CONSTRAINT "FK_task_attachments_user" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_attachments" DROP CONSTRAINT "FK_task_attachments_user"`);
        await queryRunner.query(`ALTER TABLE "task_attachments" DROP CONSTRAINT "FK_task_attachments_task"`);
        await queryRunner.query(`DROP TABLE "task_attachments"`);
    }
}
