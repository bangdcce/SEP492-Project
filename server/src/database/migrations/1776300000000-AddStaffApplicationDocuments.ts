import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffApplicationDocuments1776300000000 implements MigrationInterface {
  name = 'AddStaffApplicationDocuments1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "cvStorageKey" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "cvOriginalFilename" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "cvMimeType" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "cvSize" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "fullNameOnDocument" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "documentType" varchar(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "documentNumber" varchar(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "dateOfBirth" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "address" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "idCardFrontStorageKey" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "idCardBackStorageKey" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" ADD COLUMN IF NOT EXISTS "selfieStorageKey" varchar(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "selfieStorageKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "idCardBackStorageKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "idCardFrontStorageKey"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "address"`);
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "dateOfBirth"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "documentNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "documentType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "fullNameOnDocument"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "cvSize"`);
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "cvMimeType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "cvOriginalFilename"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_applications" DROP COLUMN IF EXISTS "cvStorageKey"`,
    );
  }
}
