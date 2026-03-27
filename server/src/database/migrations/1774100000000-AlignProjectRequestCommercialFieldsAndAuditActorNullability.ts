import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignProjectRequestCommercialFieldsAndAuditActorNullability1774100000000
  implements MigrationInterface
{
  name = 'AlignProjectRequestCommercialFieldsAndAuditActorNullability1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_requests"
      ADD COLUMN IF NOT EXISTS "commercialBaseline" jsonb,
      ADD COLUMN IF NOT EXISTS "activeCommercialChangeRequest" jsonb
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'actor_id'
        ) THEN
          ALTER TABLE "audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'project_requests'
            AND column_name = 'activeCommercialChangeRequest'
        ) THEN
          ALTER TABLE "project_requests" DROP COLUMN "activeCommercialChangeRequest";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'project_requests'
            AND column_name = 'commercialBaseline'
        ) THEN
          ALTER TABLE "project_requests" DROP COLUMN "commercialBaseline";
        END IF;
      END
      $$;
    `);
  }
}
