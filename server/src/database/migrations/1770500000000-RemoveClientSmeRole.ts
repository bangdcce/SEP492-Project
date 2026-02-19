import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * NOTE:
 * Supabase environments commonly attach RLS policies that reference users.role
 * (e.g. policies on storage.objects). Re-typing users.role enum will fail with:
 *   "cannot alter type of a column used in a policy definition"
 *
 * To keep migration chain reliable across environments, this migration performs
 * data normalization only (CLIENT_SME -> CLIENT) and intentionally skips enum
 * type replacement.
 */
export class RemoveClientSmeRole1770500000000 implements MigrationInterface {
  name = 'RemoveClientSmeRole1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
        ) THEN
          EXECUTE 'UPDATE "users" SET "role" = ''CLIENT'' WHERE "role"::text = ''CLIENT_SME''';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'dispute_notes' AND column_name = 'authorRole'
        ) THEN
          EXECUTE 'UPDATE "dispute_notes" SET "authorRole" = ''CLIENT'' WHERE "authorRole"::text = ''CLIENT_SME''';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'raiserRole'
        ) THEN
          EXECUTE 'UPDATE "disputes" SET "raiserRole" = ''CLIENT'' WHERE "raiserRole"::text = ''CLIENT_SME''';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name = 'defendantRole'
        ) THEN
          EXECUTE 'UPDATE "disputes" SET "defendantRole" = ''CLIENT'' WHERE "defendantRole"::text = ''CLIENT_SME''';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'dispute_activities' AND column_name = 'actorRole'
        ) THEN
          EXECUTE 'UPDATE "dispute_activities" SET "actorRole" = ''CLIENT'' WHERE "actorRole"::text = ''CLIENT_SME''';
        END IF;
      END
      $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible normalization migration. No-op on down.
  }
}
