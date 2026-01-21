import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLinkedinAndCvToProfiles1736450000000 implements MigrationInterface {
  name = 'AddLinkedinAndCvToProfiles1736450000000';

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
