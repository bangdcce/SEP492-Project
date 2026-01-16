import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientSmeRole1768494192045 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add CLIENT_SME to users_role_enum
    await queryRunner.query(`
            ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'CLIENT_SME';
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // You would need to recreate the enum type to remove a value
    // For now, this is a no-op as removing enum values is risky
  }
}
