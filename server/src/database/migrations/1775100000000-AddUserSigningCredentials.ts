import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSigningCredentials1775100000000 implements MigrationInterface {
  name = 'AddUserSigningCredentials1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_signing_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "publicKeyPem" text NOT NULL,
        "encryptedPrivateKeyPem" text NOT NULL,
        "encryptionSalt" character varying(128) NOT NULL,
        "encryptionIv" character varying(64) NOT NULL,
        "encryptionAuthTag" character varying(64) NOT NULL,
        "kdfIterations" integer NOT NULL DEFAULT 210000,
        "keyAlgorithm" character varying(32) NOT NULL DEFAULT 'RSA-2048',
        "keyFingerprint" character varying(64) NOT NULL,
        "failedPinAttempts" integer NOT NULL DEFAULT 0,
        "lockedUntil" TIMESTAMP,
        "keyVersion" integer NOT NULL DEFAULT 1,
        "rotatedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_signing_credentials_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_signing_credentials_userId"
      ON "user_signing_credentials" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_signing_credentials_keyFingerprint"
      ON "user_signing_credentials" ("keyFingerprint")
    `);

    await queryRunner.query(`
      ALTER TABLE "user_signing_credentials"
      ADD CONSTRAINT "FK_user_signing_credentials_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_signing_credentials"
      DROP CONSTRAINT IF EXISTS "FK_user_signing_credentials_userId"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_signing_credentials_keyFingerprint"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_user_signing_credentials_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_signing_credentials"`);
  }
}
