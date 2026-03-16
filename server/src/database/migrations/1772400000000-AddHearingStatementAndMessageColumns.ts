import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHearingStatementAndMessageColumns1772400000000 implements MigrationInterface {
  name = 'AddHearingStatementAndMessageColumns1772400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add WITNESS_TESTIMONY to hearing_statements_type_enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'WITNESS_TESTIMONY'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_statements_type_enum')
        ) THEN
          ALTER TYPE "hearing_statements_type_enum" ADD VALUE 'WITNESS_TESTIMONY';
        END IF;
      END
      $$;
    `);

    // 2. Add OBJECTION to hearing_statements_type_enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'OBJECTION'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_statements_type_enum')
        ) THEN
          ALTER TYPE "hearing_statements_type_enum" ADD VALUE 'OBJECTION';
        END IF;
      END
      $$;
    `);

    // 3. Add SURREBUTTAL to hearing_statements_type_enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'SURREBUTTAL'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_statements_type_enum')
        ) THEN
          ALTER TYPE "hearing_statements_type_enum" ADD VALUE 'SURREBUTTAL';
        END IF;
      END
      $$;
    `);

    // 4. Add objection_status column to hearing_statements
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'hearing_statements' AND column_name = 'objection_status'
        ) THEN
          ALTER TABLE "hearing_statements"
            ADD COLUMN "objection_status" varchar(20) DEFAULT NULL;
          COMMENT ON COLUMN "hearing_statements"."objection_status"
            IS 'PENDING | SUSTAINED | OVERRULED (only for OBJECTION statements)';
        END IF;
      END
      $$;
    `);

    // 5. Add deadline column to hearing_statements
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'hearing_statements' AND column_name = 'deadline'
        ) THEN
          ALTER TABLE "hearing_statements"
            ADD COLUMN "deadline" TIMESTAMP DEFAULT NULL;
          COMMENT ON COLUMN "hearing_statements"."deadline"
            IS 'Deadline for submitting this statement type during the current phase';
        END IF;
      END
      $$;
    `);

    // 6. Add attached_evidence_ids jsonb column to dispute_messages
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'dispute_messages' AND column_name = 'attached_evidence_ids'
        ) THEN
          ALTER TABLE "dispute_messages"
            ADD COLUMN "attached_evidence_ids" jsonb DEFAULT NULL;
          COMMENT ON COLUMN "dispute_messages"."attached_evidence_ids"
            IS 'Array of evidence IDs attached to this message (Zalo-style file sharing)';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns (enum values cannot be removed in PostgreSQL without recreation)
    await queryRunner.query(`
      ALTER TABLE "dispute_messages" DROP COLUMN IF EXISTS "attached_evidence_ids";
    `);
    await queryRunner.query(`
      ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "deadline";
    `);
    await queryRunner.query(`
      ALTER TABLE "hearing_statements" DROP COLUMN IF EXISTS "objection_status";
    `);
  }
}
