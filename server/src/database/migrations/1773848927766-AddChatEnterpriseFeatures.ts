import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatEnterpriseFeatures1773848927766
  implements MigrationInterface
{
  name = "AddChatEnterpriseFeatures1773848927766";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "attachments" jsonb DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "isPinned" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "isEdited" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "editHistory" jsonb DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "isDeleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "isDeleted"`);
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "editHistory"`);
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "isEdited"`);
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "isPinned"`);
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "attachments"`);
  }
}
