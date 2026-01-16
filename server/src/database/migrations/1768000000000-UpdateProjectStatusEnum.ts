import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProjectStatusEnum1768000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new values to the enum type
        // Postgres does not support adding multiple values in one command easily or "IF NOT EXISTS" for enum values in all versions perfectly,
        // so we wrap each in a separate block or attempt to run them.
        // However, a safe way is to just run ALTER TYPE ... ADD VALUE IF NOT EXISTS ... 
        // older Postgres might not support IF NOT EXISTS for ADD VALUE.
        // But usually standard ALTER TYPE ... ADD VALUE ... works if it doesn't exist? 
        // Reacting to "invalid input value" implies they don't exist.
        
        // We will try to add them.
        
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'PUBLIC_DRAFT'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'PRIVATE_DRAFT'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'BROKER_ASSIGNED'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'SPEC_APPROVED'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'CONTRACT_PENDING'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_SPECS'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'HIRING'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'CONVERTED_TO_PROJECT'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'IN_PROGRESS'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED'`);
        await queryRunner.query(`ALTER TYPE "project_requests_status_enum" ADD VALUE IF NOT EXISTS 'CANCELED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverting enum addition is hard in Postgres (requires creating new type, migrating data, dropping old type).
        // For development purpose we might skip or just leave them.
    }
}
