import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceAuditLogsTraceability1773100000000 implements MigrationInterface {
  name = 'EnhanceAuditLogsTraceability1773100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "request_id" character varying(120),
      ADD COLUMN IF NOT EXISTS "session_id" character varying(120),
      ADD COLUMN IF NOT EXISTS "route" character varying(255),
      ADD COLUMN IF NOT EXISTS "http_method" character varying(16),
      ADD COLUMN IF NOT EXISTS "status_code" integer,
      ADD COLUMN IF NOT EXISTS "source" character varying(20),
      ADD COLUMN IF NOT EXISTS "event_category" character varying(40),
      ADD COLUMN IF NOT EXISTS "event_name" character varying(120),
      ADD COLUMN IF NOT EXISTS "journey_step" character varying(120),
      ADD COLUMN IF NOT EXISTS "error_code" character varying(120),
      ADD COLUMN IF NOT EXISTS "error_message" text,
      ADD COLUMN IF NOT EXISTS "changed_fields" jsonb,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_request_created"
      ON "audit_logs" ("request_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_session_created"
      ON "audit_logs" ("session_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_session_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_request_created"`);
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "changed_fields",
      DROP COLUMN IF EXISTS "error_message",
      DROP COLUMN IF EXISTS "error_code",
      DROP COLUMN IF EXISTS "journey_step",
      DROP COLUMN IF EXISTS "event_name",
      DROP COLUMN IF EXISTS "event_category",
      DROP COLUMN IF EXISTS "source",
      DROP COLUMN IF EXISTS "status_code",
      DROP COLUMN IF EXISTS "http_method",
      DROP COLUMN IF EXISTS "route",
      DROP COLUMN IF EXISTS "session_id",
      DROP COLUMN IF EXISTS "request_id"
    `);
  }
}
