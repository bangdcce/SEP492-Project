import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeStatusEnums1769100000000 implements MigrationInterface {
  name = 'AddDisputeStatusEnums1769100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'REJECTION_APPEALED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."disputes_status_enum" ADD VALUE IF NOT EXISTS 'APPEALED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum value removal in Postgres is not straightforward; leave as-is.
  }
}
