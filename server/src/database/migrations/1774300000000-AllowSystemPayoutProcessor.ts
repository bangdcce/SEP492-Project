import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowSystemPayoutProcessor1774300000000 implements MigrationInterface {
  name = 'AllowSystemPayoutProcessor1774300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      DROP CONSTRAINT IF EXISTS "FK_2efebf9c50eb838dd24d5816cc5"
    `);

    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ALTER COLUMN "processedBy" TYPE text
      USING CASE
        WHEN "processedBy" IS NULL THEN NULL
        ELSE "processedBy"::text
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ALTER COLUMN "processedBy" TYPE uuid
      USING CASE
        WHEN "processedBy" IS NULL THEN NULL
        WHEN "processedBy" ~* '^[0-9a-f-]{36}$' THEN "processedBy"::uuid
        ELSE NULL
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "payout_requests"
      ADD CONSTRAINT "FK_2efebf9c50eb838dd24d5816cc5"
      FOREIGN KEY ("processedBy") REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }
}
