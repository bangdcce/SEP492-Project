import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffApplications1774500000000 implements MigrationInterface {
  name = 'AddStaffApplications1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'staff_application_status_enum'
        ) THEN
          CREATE TYPE "public"."staff_application_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "status" "public"."staff_application_status_enum" NOT NULL DEFAULT 'PENDING',
        "reviewedBy" uuid,
        "reviewedAt" TIMESTAMP,
        "rejectionReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_staff_applications_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_staff_applications_userId" UNIQUE ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_staff_applications_status_createdAt"
      ON "staff_applications" ("status", "createdAt")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_staff_applications_userId_users'
        ) THEN
          ALTER TABLE "staff_applications"
          ADD CONSTRAINT "FK_staff_applications_userId_users"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_staff_applications_reviewedBy_users'
        ) THEN
          ALTER TABLE "staff_applications"
          ADD CONSTRAINT "FK_staff_applications_reviewedBy_users"
          FOREIGN KEY ("reviewedBy") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      INSERT INTO "staff_applications" (
        "userId",
        "status",
        "reviewedAt",
        "createdAt",
        "updatedAt"
      )
      SELECT
        "id",
        'APPROVED',
        COALESCE("updatedAt", "createdAt", now()),
        COALESCE("createdAt", now()),
        COALESCE("updatedAt", "createdAt", now())
      FROM "users"
      WHERE "role" = 'STAFF'
      ON CONFLICT ("userId") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "isVerified" = true
      WHERE "role" = 'STAFF'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP CONSTRAINT IF EXISTS "FK_staff_applications_reviewedBy_users"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP CONSTRAINT IF EXISTS "FK_staff_applications_userId_users"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_staff_applications_status_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_applications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."staff_application_status_enum"`);
  }
}
