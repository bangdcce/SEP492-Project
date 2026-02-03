import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetCurrencyUsdDefaults1769999300000 implements MigrationInterface {
  name = 'SetCurrencyUsdDefaults1769999300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
    await queryRunner.query(
      `UPDATE "projects" SET "currency" = 'USD' WHERE "currency" IS NULL OR "currency" = 'VND'`,
    );

    await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
    await queryRunner.query(
      `UPDATE "wallets" SET "currency" = 'USD' WHERE "currency" IS NULL OR "currency" = 'VND'`,
    );

    await queryRunner.query(`ALTER TABLE "escrows" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
    await queryRunner.query(
      `UPDATE "escrows" SET "currency" = 'USD' WHERE "currency" IS NULL OR "currency" = 'VND'`,
    );

    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
    await queryRunner.query(
      `UPDATE "transactions" SET "currency" = 'USD' WHERE "currency" IS NULL OR "currency" = 'VND'`,
    );

    await queryRunner.query(
      `ALTER TABLE "payout_requests" ALTER COLUMN "currency" SET DEFAULT 'USD'`,
    );
    await queryRunner.query(
      `UPDATE "payout_requests" SET "currency" = 'USD' WHERE "currency" IS NULL OR "currency" = 'VND'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payout_requests" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'VND'`,
    );
    await queryRunner.query(`ALTER TABLE "escrows" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
    await queryRunner.query(`ALTER TABLE "wallets" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "currency" SET DEFAULT 'VND'`);
  }
}
