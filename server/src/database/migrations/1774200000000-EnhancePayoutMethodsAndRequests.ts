import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhancePayoutMethodsAndRequests1774200000000 implements MigrationInterface {
  name = 'EnhancePayoutMethodsAndRequests1774200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'payout_methods_type_enum'
        ) THEN
          CREATE TYPE "public"."payout_methods_type_enum" AS ENUM('BANK_ACCOUNT', 'PAYPAL_EMAIL');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ADD COLUMN IF NOT EXISTS "type" "public"."payout_methods_type_enum" DEFAULT 'BANK_ACCOUNT'
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ADD COLUMN IF NOT EXISTS "displayName" character varying(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ADD COLUMN IF NOT EXISTS "paypalEmail" character varying(255)
    `);
    await queryRunner.query(`
      UPDATE "payout_methods"
      SET "type" = COALESCE("type", 'BANK_ACCOUNT')
    `);
    await queryRunner.query(`
      UPDATE "payout_methods"
      SET "displayName" = COALESCE(
        NULLIF(TRIM("displayName"), ''),
        NULLIF(TRIM("bankName"), ''),
        'Payout account'
      )
      WHERE "displayName" IS NULL OR TRIM("displayName") = ''
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "type" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "displayName" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "bankName" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "accountNumber" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "accountHolderName" DROP NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'FAILED'
            AND enumtypid = 'public.payout_requests_status_enum'::regtype
        ) THEN
          ALTER TYPE "public"."payout_requests_status_enum" ADD VALUE 'FAILED';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN IF NOT EXISTS "errorCode" character varying(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD COLUMN IF NOT EXISTS "failureReason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      DROP COLUMN IF EXISTS "failureReason"
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      DROP COLUMN IF EXISTS "errorCode"
    `);

    await queryRunner.query(`
      DELETE FROM "payout_methods"
      WHERE "type" = 'PAYPAL_EMAIL'
    `);

    await queryRunner.query(`
      UPDATE "payout_methods"
      SET "bankName" = COALESCE("bankName", 'PayPal'),
          "accountNumber" = COALESCE("accountNumber", SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 12)),
          "accountHolderName" = COALESCE("accountHolderName", "displayName")
    `);

    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "accountHolderName" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "accountNumber" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      ALTER COLUMN "bankName" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      DROP COLUMN IF EXISTS "paypalEmail"
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      DROP COLUMN IF EXISTS "displayName"
    `);
    await queryRunner.query(`
      ALTER TABLE "payout_methods"
      DROP COLUMN IF EXISTS "type"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."payout_methods_type_enum"
    `);
  }
}
