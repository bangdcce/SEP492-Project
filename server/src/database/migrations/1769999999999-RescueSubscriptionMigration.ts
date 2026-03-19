import { MigrationInterface, QueryRunner } from 'typeorm';

export class RescueSubscriptionMigration1769999999999 implements MigrationInterface {
  name = 'RescueSubscriptionMigration1769999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "migrations" ("timestamp", "name")
      SELECT 1770000000000, 'AddSubscriptionSystem1770000000000'
      WHERE NOT EXISTS (
        SELECT 1 FROM "migrations" WHERE "timestamp" = 1770000000000
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "migrations"
      WHERE "timestamp" = 1770000000000
        AND "name" = 'AddSubscriptionSystem1770000000000';
    `);
  }
}
