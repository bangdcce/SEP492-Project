import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedinAndCvToProfiles1736445000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
      ADD COLUMN "linkedinUrl" text,
      ADD COLUMN "cvUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
      DROP COLUMN "linkedinUrl",
      DROP COLUMN "cvUrl"
    `);
  }
}
