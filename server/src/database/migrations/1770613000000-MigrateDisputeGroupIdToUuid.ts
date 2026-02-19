import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateDisputeGroupIdToUuid1770613000000 implements MigrationInterface {
  name = 'MigrateDisputeGroupIdToUuid1770613000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        group_id_type text;
      BEGIN
        SELECT data_type
        INTO group_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'disputes'
          AND column_name = 'groupId';

        IF group_id_type = 'uuid' THEN
          CREATE INDEX IF NOT EXISTS "IDX_disputes_groupId" ON "disputes" ("groupId");
          RETURN;
        END IF;

        ALTER TABLE "disputes"
        ADD COLUMN IF NOT EXISTS "groupId_uuid_tmp" uuid;

        UPDATE "disputes"
        SET "groupId_uuid_tmp" = CASE
          WHEN "groupId" IS NULL THEN NULL
          WHEN "groupId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN "groupId"::uuid
          ELSE NULL
        END;

        -- Root disputes should have a stable group chain id.
        UPDATE "disputes"
        SET "groupId_uuid_tmp" = "id"
        WHERE "groupId_uuid_tmp" IS NULL
          AND "parentDisputeId" IS NULL;

        ALTER TABLE "disputes" DROP COLUMN "groupId";
        ALTER TABLE "disputes" RENAME COLUMN "groupId_uuid_tmp" TO "groupId";

        CREATE INDEX IF NOT EXISTS "IDX_disputes_groupId" ON "disputes" ("groupId");
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "disputes"
      ALTER COLUMN "groupId" TYPE varchar
      USING "groupId"::text;
    `);
  }
}
