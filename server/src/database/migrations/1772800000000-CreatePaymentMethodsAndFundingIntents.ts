import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentMethodsAndFundingIntents1772800000000 implements MigrationInterface {
  name = 'CreatePaymentMethodsAndFundingIntents1772800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_methods_type_enum') THEN
          CREATE TYPE "public"."payment_methods_type_enum" AS ENUM('PAYPAL_ACCOUNT', 'BANK_ACCOUNT');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funding_intents_gateway_enum') THEN
          CREATE TYPE "public"."funding_intents_gateway_enum" AS ENUM('INTERNAL_SANDBOX', 'PAYPAL');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'funding_intents_status_enum') THEN
          CREATE TYPE "public"."funding_intents_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "public"."payment_methods_type_enum" NOT NULL,
        "displayName" character varying(255) NOT NULL,
        "paypalEmail" character varying(255),
        "bankName" character varying(100),
        "bankCode" character varying(20),
        "accountNumber" character varying(30),
        "accountHolderName" character varying(255),
        "branchName" character varying(100),
        "isDefault" boolean NOT NULL DEFAULT false,
        "isVerified" boolean NOT NULL DEFAULT false,
        "verifiedAt" TIMESTAMP,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_methods_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_methods_userId"
      ON "payment_methods" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "funding_intents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "milestoneId" uuid NOT NULL,
        "payerId" uuid NOT NULL,
        "paymentMethodId" uuid NOT NULL,
        "gateway" "public"."funding_intents_gateway_enum" NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "status" "public"."funding_intents_status_enum" NOT NULL DEFAULT 'PENDING',
        "idempotencyKey" character varying(255) NOT NULL,
        "providerReference" character varying(255),
        "errorCode" character varying(100),
        "errorMessage" text,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_funding_intents_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_funding_intents_milestoneId"
      ON "funding_intents" ("milestoneId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_funding_intents_payerId"
      ON "funding_intents" ("payerId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_funding_intents_paymentMethodId"
      ON "funding_intents" ("paymentMethodId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_funding_intents_idempotency"
      ON "funding_intents" ("payerId", "milestoneId", "idempotencyKey")
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      ADD CONSTRAINT "FK_payment_methods_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "funding_intents"
      ADD CONSTRAINT "FK_funding_intents_milestoneId"
      FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "funding_intents"
      ADD CONSTRAINT "FK_funding_intents_payerId"
      FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "funding_intents"
      ADD CONSTRAINT "FK_funding_intents_paymentMethodId"
      FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "funding_intents"
      DROP CONSTRAINT IF EXISTS "FK_funding_intents_paymentMethodId"
    `);
    await queryRunner.query(`
      ALTER TABLE "funding_intents"
      DROP CONSTRAINT IF EXISTS "FK_funding_intents_payerId"
    `);
    await queryRunner.query(`
      ALTER TABLE "funding_intents"
      DROP CONSTRAINT IF EXISTS "FK_funding_intents_milestoneId"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_methods"
      DROP CONSTRAINT IF EXISTS "FK_payment_methods_userId"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_funding_intents_idempotency"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_funding_intents_paymentMethodId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_funding_intents_payerId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_funding_intents_milestoneId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "funding_intents"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payment_methods_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_methods"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."funding_intents_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."funding_intents_gateway_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payment_methods_type_enum"`);
  }
}
