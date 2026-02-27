import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWitnessObserverSpeakerRoles1772100000000 implements MigrationInterface {
  name = 'AddWitnessObserverSpeakerRoles1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add WITNESS_ONLY and OBSERVER_ONLY to the existing speaker role enum
    await queryRunner.query(
      `ALTER TYPE "public"."dispute_hearings_currentspeakerrole_enum" ADD VALUE IF NOT EXISTS 'WITNESS_ONLY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."dispute_hearings_currentspeakerrole_enum" ADD VALUE IF NOT EXISTS 'OBSERVER_ONLY'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing values from an enum directly.
    // Reset any rows using the new values back to MUTED_ALL, then recreate the enum.
    await queryRunner.query(
      `UPDATE "dispute_hearings" SET "currentSpeakerRole" = 'MUTED_ALL' WHERE "currentSpeakerRole" IN ('WITNESS_ONLY', 'OBSERVER_ONLY')`,
    );
    await queryRunner.query(
      `UPDATE "dispute_hearings" SET "speakerRoleBeforePause" = 'MUTED_ALL' WHERE "speakerRoleBeforePause" IN ('WITNESS_ONLY', 'OBSERVER_ONLY')`,
    );

    // Rename old enum, create new without the values, migrate columns, drop old
    await queryRunner.query(
      `ALTER TYPE "public"."dispute_hearings_currentspeakerrole_enum" RENAME TO "dispute_hearings_currentspeakerrole_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."dispute_hearings_currentspeakerrole_enum" AS ENUM('ALL', 'MODERATOR_ONLY', 'RAISER_ONLY', 'DEFENDANT_ONLY', 'MUTED_ALL')`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispute_hearings" ALTER COLUMN "currentSpeakerRole" TYPE "public"."dispute_hearings_currentspeakerrole_enum" USING "currentSpeakerRole"::"text"::"public"."dispute_hearings_currentspeakerrole_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dispute_hearings" ALTER COLUMN "speakerRoleBeforePause" TYPE "public"."dispute_hearings_currentspeakerrole_enum" USING "speakerRoleBeforePause"::"text"::"public"."dispute_hearings_currentspeakerrole_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."dispute_hearings_currentspeakerrole_enum_old"`);
  }
}
