import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandLegalSignatureTermsVersion1775400000000 implements MigrationInterface {
  name = 'ExpandLegalSignatureTermsVersion1775400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "legal_signatures" ALTER COLUMN "termsVersion" TYPE character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "legal_signatures" ALTER COLUMN "termsVersion" TYPE character varying(10)`,
    );
  }
}
