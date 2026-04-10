import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowAppealVerdictPerDispute1775600000000 implements MigrationInterface {
  name = 'AllowAppealVerdictPerDispute1775600000000';

  private readonly legacySingleVerdictConstraint = 'REL_a027522850799c0ff026bceb1c';
  private readonly disputeAppealFlagUniqueIndex = 'UQ_dispute_verdicts_dispute_appeal_flag';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dispute_verdicts" DROP CONSTRAINT IF EXISTS "${this.legacySingleVerdictConstraint}"`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${this.disputeAppealFlagUniqueIndex}"
      ON "dispute_verdicts" ("disputeId", "isAppealVerdict")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${this.disputeAppealFlagUniqueIndex}"`,
    );

    await queryRunner.query(
      `ALTER TABLE "dispute_verdicts" ADD CONSTRAINT "${this.legacySingleVerdictConstraint}" UNIQUE ("disputeId")`,
    );
  }
}

