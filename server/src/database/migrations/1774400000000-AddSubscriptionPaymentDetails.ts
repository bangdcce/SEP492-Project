import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPaymentDetails1774400000000 implements MigrationInterface {
  name = 'AddSubscriptionPaymentDetails1774400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD COLUMN IF NOT EXISTS "payment_provider" character varying(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD COLUMN IF NOT EXISTS "payment_currency" character varying(3)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD COLUMN IF NOT EXISTS "payment_captured_amount" numeric(12,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      DROP COLUMN IF EXISTS "payment_captured_amount"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      DROP COLUMN IF EXISTS "payment_currency"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      DROP COLUMN IF EXISTS "payment_provider"
    `);
  }
}
