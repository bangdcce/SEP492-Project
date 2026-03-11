import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenContractActivationInvariants1772600000000 implements MigrationInterface {
  name = 'HardenContractActivationInvariants1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "contracts"
          WHERE "sourceSpecId" IS NOT NULL
          GROUP BY "sourceSpecId"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enforce unique sourceSpecId on contracts: duplicate rows already exist.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "digital_signatures"
          GROUP BY "contractId", "userId"
          HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot enforce unique contract signer pairs: duplicate digital signatures already exist.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contracts_sourceSpecId"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_contracts_sourceSpecId"
      ON "contracts" ("sourceSpecId")
      WHERE "sourceSpecId" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_digital_signatures_contract_user"
      ON "digital_signatures" ("contractId", "userId")
    `);

    await queryRunner.query(`
      UPDATE "contracts"
      SET "status" = 'ACTIVATED'
      WHERE "activatedAt" IS NOT NULL
        AND COALESCE("status", '') <> 'ACTIVATED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_digital_signatures_contract_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_contracts_sourceSpecId"`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contracts_sourceSpecId"
      ON "contracts" ("sourceSpecId")
    `);
  }
}
