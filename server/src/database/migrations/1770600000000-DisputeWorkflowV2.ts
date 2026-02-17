import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisputeWorkflowV21770600000000 implements MigrationInterface {
  name = 'DisputeWorkflowV21770600000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'TRIAGE_PENDING'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'PREVIEW'`,
    );

    await queryRunner.query(
      `ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'TRIAGE_PENDING'`,
    );
    await queryRunner.query(
      `UPDATE "disputes" SET "status" = 'TRIAGE_PENDING' WHERE "status" = 'OPEN'`,
    );

    await queryRunner.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "triageReason" text`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "triageActorId" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "triageAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "triagePreviousStatus" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "infoRequestDeadline" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "previewCompletedById" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "previewCompletedAt" TIMESTAMP`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."dispute_parties_side_enum" AS ENUM('RAISER', 'DEFENDANT', 'THIRD_PARTY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_parties" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "groupId" uuid NOT NULL,
        "disputeId" uuid,
        "userId" uuid NOT NULL,
        "role" "public"."users_role_enum",
        "side" "public"."dispute_parties_side_enum" NOT NULL DEFAULT 'THIRD_PARTY',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_parties_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_dispute_parties_group_user" UNIQUE ("groupId", "userId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_parties_group_id" ON "dispute_parties" ("groupId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_parties_dispute_id" ON "dispute_parties" ("disputeId")`,
    );

    await queryRunner.query(`
      INSERT INTO "dispute_parties" ("groupId", "disputeId", "userId", "role", "side")
      SELECT
        COALESCE(
          CASE
            WHEN d."groupId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN d."groupId"::uuid
            ELSE NULL
          END,
          d."id"
        ),
        d."id",
        d."raisedById",
        d."raiserRole"::text::"public"."users_role_enum",
        'RAISER'
      FROM "disputes" d
      WHERE d."raisedById" IS NOT NULL
      ON CONFLICT ("groupId", "userId") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "dispute_parties" ("groupId", "disputeId", "userId", "role", "side")
      SELECT
        COALESCE(
          CASE
            WHEN d."groupId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN d."groupId"::uuid
            ELSE NULL
          END,
          d."id"
        ),
        d."id",
        d."defendantId",
        d."defendantRole"::text::"public"."users_role_enum",
        'DEFENDANT'
      FROM "disputes" d
      WHERE d."defendantId" IS NOT NULL
      ON CONFLICT ("groupId", "userId") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_ledgers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "eventType" character varying(80) NOT NULL,
        "actorId" character varying,
        "reason" text,
        "payload" jsonb,
        "previousHash" character varying(128),
        "canonicalPayload" text NOT NULL,
        "hash" character varying(128) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_ledgers_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_ledgers_dispute_id_created_at" ON "dispute_ledgers" ("disputeId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_ledgers_hash" ON "dispute_ledgers" ("hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_dispute_ledgers_hash"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_dispute_ledgers_dispute_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_ledgers"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_dispute_parties_dispute_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_dispute_parties_group_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_parties"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."dispute_parties_side_enum"`);

    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "previewCompletedAt"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "previewCompletedById"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "infoRequestDeadline"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "triagePreviousStatus"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "triageAt"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "triageActorId"`);
    await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN IF EXISTS "triageReason"`);

    await queryRunner.query(
      `UPDATE "disputes" SET "status" = 'OPEN' WHERE "status" = 'TRIAGE_PENDING'`,
    );
    await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'OPEN'`);
  }
}
