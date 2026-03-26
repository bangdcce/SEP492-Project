import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRequestMessages1774200000000 implements MigrationInterface {
  name = 'CreateRequestMessages1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "request_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requestId" uuid NOT NULL,
        "senderId" uuid,
        "replyToId" uuid,
        "messageType" character varying(16) NOT NULL DEFAULT 'USER',
        "content" text NOT NULL,
        "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "isEdited" boolean NOT NULL DEFAULT false,
        "editHistory" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_request_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_request_messages_request" FOREIGN KEY ("requestId") REFERENCES "project_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_request_messages_sender" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_request_messages_reply_to" FOREIGN KEY ("replyToId") REFERENCES "request_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_request_messages_request_created_at"
      ON "request_messages" ("requestId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_request_messages_reply_to"
      ON "request_messages" ("replyToId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_request_messages_sender"
      ON "request_messages" ("senderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_request_messages_sender"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_request_messages_reply_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_request_messages_request_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_messages"`);
  }
}
