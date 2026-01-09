import { MigrationInterface, QueryRunner } from "typeorm";

export class WizardTables1766991586504 implements MigrationInterface {
    name = 'WizardTables1766991586504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wizard_questions" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "label" text NOT NULL, "help_text" text, "input_type" character varying, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer, "created_at" TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT "UQ_fec5bf63c0e39ebf237b3bbc486" UNIQUE ("code"), CONSTRAINT "PK_01980ba9ae3a226aa28c08b2007" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "wizard_options" ("id" SERIAL NOT NULL, "question_id" integer NOT NULL, "value" character varying NOT NULL, "label" text NOT NULL, "sort_order" integer, CONSTRAINT "PK_888ae1a4fab441bd429fcdc4452" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reports_reason_enum" AS ENUM('SPAM', 'HARASSMENT', 'DOXING', 'FAKE_REVIEW', 'INAPPROPRIATE_LANGUAGE', 'OFF_TOPIC', 'OTHER')`);
        await queryRunner.query(`CREATE TYPE "public"."reports_status_enum" AS ENUM('PENDING', 'RESOLVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporter_id" uuid NOT NULL, "review_id" uuid NOT NULL, "reason" "public"."reports_reason_enum" NOT NULL, "description" text, "status" "public"."reports_status_enum" NOT NULL DEFAULT 'PENDING', "resolved_by" uuid, "admin_note" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP, CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."kyc_verifications_documenttype_enum" AS ENUM('CCCD', 'PASSPORT', 'DRIVER_LICENSE')`);
        await queryRunner.query(`CREATE TYPE "public"."kyc_verifications_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "kyc_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "fullNameOnDocument" character varying(255) NOT NULL, "documentNumber" character varying(20) NOT NULL, "documentType" "public"."kyc_verifications_documenttype_enum" NOT NULL DEFAULT 'CCCD', "dateOfBirth" date, "documentExpiryDate" date, "documentFrontUrl" character varying(500) NOT NULL, "documentBackUrl" character varying(500) NOT NULL, "selfieUrl" character varying(500) NOT NULL, "status" "public"."kyc_verifications_status_enum" NOT NULL DEFAULT 'PENDING', "rejectionReason" text, "reviewedBy" uuid, "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57b7c6b141dd225ce5dc95d7fb0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordOtp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordOtpExpires"`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD "delete_reason" text`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD "avatarUrl" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" DROP COLUMN "questionId"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" ADD "questionId" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" DROP COLUMN "optionId"`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" ADD "optionId" integer`);
        await queryRunner.query(`ALTER TABLE "wizard_options" ADD CONSTRAINT "FK_bc14ab4d06540c3bd1e408729e3" FOREIGN KEY ("question_id") REFERENCES "wizard_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_9459b9bf907a3807ef7143d2ead" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_628fb90b2d3a87f2bb236befa66" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_f7790853594bca5892d390e1daf" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" ADD CONSTRAINT "FK_bd1b708124a60b84cddb67a9fef" FOREIGN KEY ("questionId") REFERENCES "wizard_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_request_answers" ADD CONSTRAINT "FK_9e7d84f4f6c8c98fa0b733c5d5e" FOREIGN KEY ("optionId") REFERENCES "wizard_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD CONSTRAINT "FK_f71e34495dae27087b5773b35b4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kyc_verifications" ADD CONSTRAINT "FK_a62a22506fed8625d73996501b3" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
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
