import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProfileAvatarUrlToText1736392800000 implements MigrationInterface {
    name = 'UpdateProfileAvatarUrlToText1736392800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change avatarUrl column from varchar(500) to text to support base64 images
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ALTER COLUMN "avatarUrl" TYPE text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert back to varchar(500)
        await queryRunner.query(`
            ALTER TABLE "profiles" 
            ALTER COLUMN "avatarUrl" TYPE varchar(500)
        `);
    }
}
