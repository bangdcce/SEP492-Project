import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceSingleActiveRootDisputePerMilestone1774600000000 implements MigrationInterface {
  name = 'EnforceSingleActiveRootDisputePerMilestone1774600000000';

  private readonly activeRootDisputeIndex = 'UQ_disputes_active_root_per_milestone';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "${this.activeRootDisputeIndex}"
      ON "disputes" ("milestoneId")
      WHERE "parentDisputeId" IS NULL
        AND "status" IN (
          'OPEN',
          'TRIAGE_PENDING',
          'PREVIEW',
          'PENDING_REVIEW',
          'INFO_REQUESTED',
          'IN_MEDIATION',
          'REJECTION_APPEALED',
          'APPEALED'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "${this.activeRootDisputeIndex}"`);
  }
}
