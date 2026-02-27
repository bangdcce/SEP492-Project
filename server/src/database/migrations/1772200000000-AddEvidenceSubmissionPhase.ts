import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvidenceSubmissionPhase1772200000000 implements MigrationInterface {
  name = 'AddEvidenceSubmissionPhase1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add EVIDENCE_SUBMISSION to dispute_phase_enum
    // Using IF NOT EXISTS pattern for idempotency
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'EVIDENCE_SUBMISSION'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'disputes_phase_enum')
        ) THEN
          ALTER TYPE "disputes_phase_enum" ADD VALUE 'EVIDENCE_SUBMISSION';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
    // The value will remain but won't be used after rollback.
    // To fully remove, you'd need to recreate the enum type.
    this.name; // keep linter happy
  }
}
