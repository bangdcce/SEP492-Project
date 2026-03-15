import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffMilestoneReviewFlow1773001000000 implements MigrationInterface {
  name = 'AddStaffMilestoneReviewFlow1773001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "milestones_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_STAFF_REVIEW'`,
    );
    await queryRunner.query(
      `ALTER TYPE "milestones_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_CLIENT_APPROVAL'`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'projects_staffInviteStatus_enum'
        ) THEN
          CREATE TYPE "projects_staffInviteStatus_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'milestones_staffRecommendation_enum'
        ) THEN
          CREATE TYPE "milestones_staffRecommendation_enum" AS ENUM ('ACCEPT', 'REJECT');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "projects" ADD "staffId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "projects" ADD "staffInviteStatus" "projects_staffInviteStatus_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "milestones" ADD "reviewedByStaffId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD "staffRecommendation" "milestones_staffRecommendation_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "milestones" ADD "staffReviewNote" text`);

    await queryRunner.query(`CREATE INDEX "IDX_projects_staffId" ON "projects" ("staffId")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_staffInviteStatus" ON "projects" ("staffInviteStatus")`,
    );

    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_staffId_users_id" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_milestones_reviewedByStaffId_users_id" FOREIGN KEY ("reviewedByStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP CONSTRAINT "FK_milestones_reviewedByStaffId_users_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_staffId_users_id"`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_projects_staffInviteStatus"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_staffId"`);

    await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "staffReviewNote"`);
    await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "staffRecommendation"`);
    await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "reviewedByStaffId"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "staffInviteStatus"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "staffId"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "milestones_staffRecommendation_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "projects_staffInviteStatus_enum"`);
  }
}
