import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingEnumValues1768000000001 implements MigrationInterface {
    name = 'AddMissingEnumValues1768000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'BROKER_ASSIGNED'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'SPEC_APPROVED'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'CONTRACT_PENDING'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'CONVERTED_TO_PROJECT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Enums cannot easily remove values in Postgres without dropping and recreating type
        // For this task, we can leave them or strict revert would be complex.
        // Doing nothing for down is acceptable for additive enum changes in dev.
    }
}
