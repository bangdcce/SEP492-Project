import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTaskColumns1768996214116 implements MigrationInterface {
  name = 'RenameTaskColumns1768996214116';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submissionNote"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "proofLink"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submittedAt"`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "submission_note" text`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "proof_link" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "submitted_at" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchEndTime" SET DEFAULT '13:00:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "lunchStartTime" SET DEFAULT '11:30:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursEnd" SET DEFAULT '18:00:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "auto_schedule_rules" ALTER COLUMN "workingHoursStart" SET DEFAULT '08:00:00'`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submitted_at"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "proof_link"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "submission_note"`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "submittedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "proofLink" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "submissionNote" text`);
  }
}
