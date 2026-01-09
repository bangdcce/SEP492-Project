import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectSpec1767936446221 implements MigrationInterface {
    name = 'CreateProjectSpec1767936446221'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."project_specs_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "project_specs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requestId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "totalBudget" numeric(14,2) NOT NULL, "status" "public"."project_specs_status_enum" NOT NULL DEFAULT 'PENDING_APPROVAL', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_97ee9024805b4f2abe68ed7862" UNIQUE ("requestId"), CONSTRAINT "PK_de10444e9eecc7903eff5f32392" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "projectSpecId" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."project_requests_status_enum" RENAME TO "project_requests_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."project_requests_status_enum" AS ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SPEC_SUBMITTED')`);
        await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" TYPE "public"."project_requests_status_enum" USING "status"::"text"::"public"."project_requests_status_enum"`);
        await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."project_requests_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "amount" TYPE numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "FK_927a9184a0da350a677aa7e6269" FOREIGN KEY ("projectSpecId") REFERENCES "project_specs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_specs" ADD CONSTRAINT "FK_97ee9024805b4f2abe68ed78623" FOREIGN KEY ("requestId") REFERENCES "project_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_specs" DROP CONSTRAINT "FK_97ee9024805b4f2abe68ed78623"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "FK_927a9184a0da350a677aa7e6269"`);
        await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "amount" TYPE numeric(15,2)`);
        await queryRunner.query(`CREATE TYPE "public"."project_requests_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" TYPE "public"."project_requests_status_enum_old" USING "status"::"text"::"public"."project_requests_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."project_requests_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."project_requests_status_enum_old" RENAME TO "project_requests_status_enum"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "projectSpecId"`);
        await queryRunner.query(`DROP TABLE "project_specs"`);
        await queryRunner.query(`DROP TYPE "public"."project_specs_status_enum"`);
    }

}
