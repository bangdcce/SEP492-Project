import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureStaffWorkloadUpsertConstraint1772316000000 implements MigrationInterface {
  name = 'EnsureStaffWorkloadUpsertConstraint1772316000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          ROW_NUMBER() OVER (
            PARTITION BY "staffId", "date"
            ORDER BY "updatedAt" DESC, "id" DESC
          ) AS rn
        FROM "staff_workloads"
      )
      DELETE FROM "staff_workloads" workload
      USING ranked
      WHERE workload."id" = ranked."id"
        AND ranked.rn > 1;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_6ea8194aa51f091685b7189c83";
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_staff_workloads_staff_date"
      ON "staff_workloads" ("staffId", "date");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_staff_workloads_staff_date";
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_6ea8194aa51f091685b7189c83"
      ON "staff_workloads" ("staffId", "date");
    `);
  }
}
