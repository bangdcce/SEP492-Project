import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureStaffPerformanceUpsertConstraint1772315000000
  implements MigrationInterface
{
  name = 'EnsureStaffPerformanceUpsertConstraint1772315000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "staffId", "period"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
          ) AS rn
        FROM "staff_performances"
      )
      DELETE FROM "staff_performances" perf
      USING ranked
      WHERE perf."id" = ranked."id"
        AND ranked.rn > 1;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_f470385602469dc1fb0615d4c6";
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_staff_performances_staff_period"
      ON "staff_performances" ("staffId", "period");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_staff_performances_staff_period";
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_f470385602469dc1fb0615d4c6"
      ON "staff_performances" ("staffId", "period");
    `);
  }
}
