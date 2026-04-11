import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandTaskSubmissionReviewPhases1776200000000 implements MigrationInterface {
  name = 'ExpandTaskSubmissionReviewPhases1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."task_submissions_status_enum" RENAME TO "task_submissions_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_submissions_status_enum" AS ENUM('PENDING', 'PENDING_CLIENT_REVIEW', 'APPROVED', 'AUTO_APPROVED', 'REJECTED', 'REQUEST_CHANGES')`,
    );
    await queryRunner.query(`ALTER TABLE "task_submissions" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ALTER COLUMN "status" TYPE "public"."task_submissions_status_enum" USING "status"::"text"::"public"."task_submissions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."task_submissions_status_enum_old"`);

    await queryRunner.query(`ALTER TABLE "task_submissions" ADD "brokerReviewNote" text`);
    await queryRunner.query(`ALTER TABLE "task_submissions" ADD "brokerReviewerId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ADD "brokerReviewedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "task_submissions" ADD "clientReviewNote" text`);
    await queryRunner.query(`ALTER TABLE "task_submissions" ADD "clientReviewerId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ADD "clientReviewedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ADD "clientReviewDueAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ADD "autoApprovedAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_submissions" ADD CONSTRAINT "FK_task_submissions_broker_reviewer" FOREIGN KEY ("brokerReviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ADD CONSTRAINT "FK_task_submissions_client_reviewer" FOREIGN KEY ("clientReviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_submissions_status_clientReviewDueAt" ON "task_submissions" ("status", "clientReviewDueAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_task_submissions_status_clientReviewDueAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" DROP CONSTRAINT "FK_task_submissions_client_reviewer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" DROP CONSTRAINT "FK_task_submissions_broker_reviewer"`,
    );

    await queryRunner.query(
      `UPDATE "task_submissions" SET "status" = 'PENDING' WHERE "status" = 'PENDING_CLIENT_REVIEW'`,
    );
    await queryRunner.query(
      `UPDATE "task_submissions" SET "status" = 'APPROVED' WHERE "status" = 'AUTO_APPROVED'`,
    );

    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "autoApprovedAt"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "clientReviewDueAt"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "clientReviewedAt"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "clientReviewerId"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "clientReviewNote"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "brokerReviewedAt"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "brokerReviewerId"`);
    await queryRunner.query(`ALTER TABLE "task_submissions" DROP COLUMN "brokerReviewNote"`);

    await queryRunner.query(
      `ALTER TYPE "public"."task_submissions_status_enum" RENAME TO "task_submissions_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_submissions_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'REQUEST_CHANGES')`,
    );
    await queryRunner.query(`ALTER TABLE "task_submissions" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ALTER COLUMN "status" TYPE "public"."task_submissions_status_enum" USING "status"::"text"::"public"."task_submissions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_submissions" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."task_submissions_status_enum_old"`);
  }
}
