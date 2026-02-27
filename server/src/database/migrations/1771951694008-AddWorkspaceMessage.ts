import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceMessage1771951694008 implements MigrationInterface {
    name = 'AddWorkspaceMessage1771951694008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "senderId" uuid NOT NULL, "taskId" uuid, "content" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_14251ac4c6011577acd5be2bf14" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_138633463ad39e31dc4473245a" ON "workspace_messages" ("taskId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_74fb4ec7c7b2120b7872a58b54" ON "workspace_messages" ("projectId", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "workspace_messages"`);
    }
}
