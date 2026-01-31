import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerificationFields1737530400000 implements MigrationInterface {
    name = 'AddEmailVerificationFields1737530400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tách từng cột ra thành các câu lệnh riêng biệt (PostgreSQL không hỗ trợ IF NOT EXISTS cho nhiều cột)
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(64)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registrationIp" VARCHAR(45)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registrationUserAgent" TEXT`);
        
        // Add comments safely
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emailVerificationToken') THEN
                    COMMENT ON COLUMN "users"."emailVerificationToken" IS 'Token for email verification';
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emailVerificationExpires') THEN
                    COMMENT ON COLUMN "users"."emailVerificationExpires" IS 'Expiration time for verification token';
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emailVerifiedAt') THEN
                    COMMENT ON COLUMN "users"."emailVerifiedAt" IS 'Timestamp when email was verified';
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'termsAcceptedAt') THEN
                    COMMENT ON COLUMN "users"."termsAcceptedAt" IS 'Timestamp when user accepted Terms of Service';
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'privacyAcceptedAt') THEN
                    COMMENT ON COLUMN "users"."privacyAcceptedAt" IS 'Timestamp when user accepted Privacy Policy';
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'registrationIp') THEN
                    COMMENT ON COLUMN "users"."registrationIp" IS 'IP address during registration';
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'registrationUserAgent') THEN
                    COMMENT ON COLUMN "users"."registrationUserAgent" IS 'User agent string during registration';
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN IF EXISTS "emailVerificationToken",
            DROP COLUMN IF EXISTS "emailVerificationExpires",
            DROP COLUMN IF EXISTS "emailVerifiedAt",
            DROP COLUMN IF EXISTS "termsAcceptedAt",
            DROP COLUMN IF EXISTS "privacyAcceptedAt",
            DROP COLUMN IF EXISTS "registrationIp",
            DROP COLUMN IF EXISTS "registrationUserAgent"
        `);
    }
}
