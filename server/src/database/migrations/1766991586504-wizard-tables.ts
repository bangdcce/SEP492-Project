import { MigrationInterface, QueryRunner } from "typeorm";

export class WizardTables1766991586504 implements MigrationInterface {
    name = 'WizardTables1766991586504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Skipped because tables already exist manually in this environment
        // await queryRunner.query(`CREATE TABLE "wizard_questions" ...`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP CONSTRAINT "FK_a62a22506fed8625d73996501b3"`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP CONSTRAINT "FK_f71e34495dae27087b5773b35b4"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" DROP CONSTRAINT "FK_9e7d84f4f6c8c98fa0b733c5d5e"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" DROP CONSTRAINT "FK_bd1b708124a60b84cddb67a9fef"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_f7790853594bca5892d390e1daf"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_628fb90b2d3a87f2bb236befa66"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead"`);
        await queryRunner.query(`ALTER TABLE "wizard_options" DROP CONSTRAINT "FK_bc14ab4d06540c3bd1e408729e3"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" DROP COLUMN "optionId"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" ADD "optionId" uuid`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" DROP COLUMN "questionId"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" ADD "questionId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "avatarUrl"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "delete_reason"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordOtpExpires" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordOtp" character varying(6)`);
        await queryRunner.query(`DROP TABLE "kyc_verifications"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_verifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_verifications_documenttype_enum"`);
        await queryRunner.query(`DROP TABLE "reports"`);
        await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."reports_reason_enum"`);
        await queryRunner.query(`DROP TABLE "wizard_options"`);
        await queryRunner.query(`DROP TABLE "wizard_questions"`);
    }

}
