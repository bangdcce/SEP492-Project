import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeFundingGateway1774100000000 implements MigrationInterface {
  name = 'AddStripeFundingGateway1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'STRIPE'
            AND enumtypid = 'public.funding_intents_gateway_enum'::regtype
        ) THEN
          ALTER TYPE "public"."funding_intents_gateway_enum" ADD VALUE 'STRIPE';
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Postgres enum values can't be removed safely in a reversible way here.
  }
}
