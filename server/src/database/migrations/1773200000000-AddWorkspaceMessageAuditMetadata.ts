import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceMessageAuditMetadata1773200000000
  implements MigrationInterface
{
  name = 'AddWorkspaceMessageAuditMetadata1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "messageType" character varying(16) NOT NULL DEFAULT 'USER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ADD "riskFlags" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ALTER COLUMN "senderId" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "workspace_messages" WHERE "messageType" = 'SYSTEM' OR "senderId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspace_messages" ALTER COLUMN "senderId" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "riskFlags"`);
    await queryRunner.query(`ALTER TABLE "workspace_messages" DROP COLUMN "messageType"`);
  }
}
