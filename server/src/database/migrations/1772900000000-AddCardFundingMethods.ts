import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardFundingMethods1772900000000 implements MigrationInterface {
  name = 'AddCardFundingMethods1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'CARD_ACCOUNT'
            AND enumtypid = 'public.payment_methods_type_enum'::regtype
        ) THEN
          ALTER TYPE "public"."payment_methods_type_enum" ADD VALUE 'CARD_ACCOUNT';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      ADD COLUMN IF NOT EXISTS "cardBrand" character varying(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      ADD COLUMN IF NOT EXISTS "cardLast4" character varying(4)
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      ADD COLUMN IF NOT EXISTS "cardholderName" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      ADD COLUMN IF NOT EXISTS "cardExpiryMonth" smallint
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      ADD COLUMN IF NOT EXISTS "cardExpiryYear" smallint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      DROP COLUMN IF EXISTS "cardExpiryYear"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      DROP COLUMN IF EXISTS "cardExpiryMonth"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      DROP COLUMN IF EXISTS "cardholderName"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      DROP COLUMN IF EXISTS "cardLast4"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      DROP COLUMN IF EXISTS "cardBrand"
    `);
  }
}
