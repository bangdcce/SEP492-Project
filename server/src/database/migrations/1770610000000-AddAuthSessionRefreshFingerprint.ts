import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSessionRefreshFingerprint1770610000000 implements MigrationInterface {
  name = 'AddAuthSessionRefreshFingerprint1770610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "refreshTokenFingerprint" character varying(64)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_auth_sessions_refresh_token_fingerprint" ON "auth_sessions" ("refreshTokenFingerprint")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_auth_sessions_refresh_token_fingerprint"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP COLUMN IF EXISTS "refreshTokenFingerprint"`,
    );
  }
}
