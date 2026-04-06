import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractArchiveMetadata1773900000000 implements MigrationInterface {
  name = 'AddContractArchiveMetadata1773900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "archiveStoragePath" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "archivePersistedAt" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      ADD COLUMN IF NOT EXISTS "archiveDocumentHash" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "archiveDocumentHash"
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "archivePersistedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "contracts"
      DROP COLUMN IF EXISTS "archiveStoragePath"
    `);
  }
}
