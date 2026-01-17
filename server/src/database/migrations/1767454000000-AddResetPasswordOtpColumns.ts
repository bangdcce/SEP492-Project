import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetPasswordOtpColumns1767454000000 implements MigrationInterface {
  name = 'AddResetPasswordOtpColumns1767454000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add resetPasswordOtp column
    await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "resetpasswordotp" character varying(6)
        `);

    // Add resetPasswordOtpExpires column
    await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "resetpasswordotpexpires" TIMESTAMP
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns if migration is reverted
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "resetpasswordotpexpires"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "resetpasswordotp"`);
  }
}
