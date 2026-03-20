import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceMessageReplyReference1774000000000 implements MigrationInterface {
  name = 'AddWorkspaceMessageReplyReference1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_messages"
      ADD COLUMN IF NOT EXISTS "replyToId" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_workspace_messages_reply_to'
        ) THEN
          ALTER TABLE "workspace_messages"
          ADD CONSTRAINT "FK_workspace_messages_reply_to"
          FOREIGN KEY ("replyToId")
          REFERENCES "workspace_messages"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_messages"
      DROP CONSTRAINT IF EXISTS "FK_workspace_messages_reply_to"
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_messages"
      DROP COLUMN IF EXISTS "replyToId"
    `);
  }
}
