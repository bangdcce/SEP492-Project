import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTimeZoneAndTimestamptz1769482000000 implements MigrationInterface {
    name = 'AddUserTimeZoneAndTimestamptz1769482000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timeZone" character varying(64) NOT NULL DEFAULT 'UTC'`);
        await queryRunner.query(`UPDATE "users" SET "timeZone" = 'UTC' WHERE "timeZone" IS NULL`);

        await queryRunner.query(
            `ALTER TABLE "calendar_events" ALTER COLUMN "startTime" TYPE timestamptz USING "startTime" AT TIME ZONE 'UTC'`,
        );
        await queryRunner.query(
            `ALTER TABLE "calendar_events" ALTER COLUMN "endTime" TYPE timestamptz USING "endTime" AT TIME ZONE 'UTC'`,
        );

        await queryRunner.query(
            `ALTER TABLE "user_availabilities" ALTER COLUMN "startTime" TYPE timestamptz USING "startTime" AT TIME ZONE 'UTC'`,
        );
        await queryRunner.query(
            `ALTER TABLE "user_availabilities" ALTER COLUMN "endTime" TYPE timestamptz USING "endTime" AT TIME ZONE 'UTC'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "user_availabilities" ALTER COLUMN "endTime" TYPE timestamp USING "endTime" AT TIME ZONE 'UTC'`,
        );
        await queryRunner.query(
            `ALTER TABLE "user_availabilities" ALTER COLUMN "startTime" TYPE timestamp USING "startTime" AT TIME ZONE 'UTC'`,
        );
        await queryRunner.query(
            `ALTER TABLE "calendar_events" ALTER COLUMN "endTime" TYPE timestamp USING "endTime" AT TIME ZONE 'UTC'`,
        );
        await queryRunner.query(
            `ALTER TABLE "calendar_events" ALTER COLUMN "startTime" TYPE timestamp USING "startTime" AT TIME ZONE 'UTC'`,
        );

        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "timeZone"`);
    }
}
