import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStructuredHearingStatements1772600000000 implements MigrationInterface {
  name = 'AddStructuredHearingStatements1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "structuredContent" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "citedEvidenceIds" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "platformDeclarationAccepted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "platformDeclarationAcceptedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "versionNumber" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "versionHistory" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "updatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "versionHistory"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "versionNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "platformDeclarationAcceptedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "platformDeclarationAccepted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "citedEvidenceIds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "structuredContent"`,
    );
  }
}
