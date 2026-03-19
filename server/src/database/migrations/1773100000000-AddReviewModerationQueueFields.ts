import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewModerationQueueFields1773100000000 implements MigrationInterface {
  name = 'AddReviewModerationQueueFields1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "opened_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "current_assignee_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "last_assigned_by_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "last_assigned_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "assignment_version" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reviews_opened_by_id" ON "reviews" ("opened_by_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reviews_current_assignee_id" ON "reviews" ("current_assignee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reviews_last_assigned_by_id" ON "reviews" ("last_assigned_by_id")`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_reviews_opened_by_id_users'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "FK_reviews_opened_by_id_users"
          FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_reviews_current_assignee_id_users'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "FK_reviews_current_assignee_id_users"
          FOREIGN KEY ("current_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_reviews_last_assigned_by_id_users'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "FK_reviews_last_assigned_by_id_users"
          FOREIGN KEY ("last_assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_last_assigned_by_id_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_current_assignee_id_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_opened_by_id_users"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_last_assigned_by_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_current_assignee_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_opened_by_id"`);

    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "assignment_version"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "last_assigned_at"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "last_assigned_by_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "current_assignee_id"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN IF EXISTS "opened_by_id"`);
  }
}
