import { MigrationInterface, QueryRunner } from 'typeorm';

export class C05ProjectSpecFinal1767936883236 implements MigrationInterface {
  name = 'C05ProjectSpecFinal1767936883236';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kiểm tra xem type enum đã tồn tại chưa
    const typeExists = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'project_specs_status_enum'`,
    );
    if (!typeExists || typeExists.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "public"."project_specs_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')`,
      );
    }

    // Kiểm tra xem bảng đã tồn tại chưa
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_specs'`,
    );
    if (!tableExists || tableExists.length === 0) {
      await queryRunner.query(
        `CREATE TABLE "project_specs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requestId" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "totalBudget" numeric(14,2) NOT NULL, "status" "public"."project_specs_status_enum" NOT NULL DEFAULT 'PENDING_APPROVAL', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_97ee9024805b4f2abe68ed7862" UNIQUE ("requestId"), CONSTRAINT "PK_de10444e9eecc7903eff5f32392" PRIMARY KEY ("id"))`,
      );
    }

    // Kiểm tra column projectSpecId đã có chưa
    const columnExists = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'projectSpecId'`,
    );
    if (!columnExists || columnExists.length === 0) {
      await queryRunner.query(`ALTER TABLE "milestones" ADD "projectSpecId" uuid`);
    }
    // BƯỚC 1: Migrate data sang giá trị hợp lệ TRONG ENUM CŨ trước khi alter type
    // Enum cũ có: PENDING, PROCESSING, APPROVED, REJECTED, CANCELED (1 chữ L), etc.
    await queryRunner.query(`
      UPDATE "project_requests" 
      SET "status" = CASE 
        WHEN "status" IN ('DRAFT', 'PUBLIC_DRAFT', 'PRIVATE_DRAFT', 'PENDING_SPECS') THEN 'PENDING'
        WHEN "status" IN ('BROKER_ASSIGNED', 'SPEC_APPROVED', 'CONTRACT_PENDING', 'HIRING', 'IN_PROGRESS') THEN 'PROCESSING'
        WHEN "status" IN ('COMPLETED', 'CONVERTED_TO_PROJECT') THEN 'APPROVED'
        ELSE "status"
      END
      WHERE "status" NOT IN ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELED', 'SPEC_SUBMITTED')
    `);

    // BƯỚC 2: Alter enum type
    await queryRunner.query(
      `ALTER TYPE "public"."project_requests_status_enum" RENAME TO "project_requests_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."project_requests_status_enum" AS ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SPEC_SUBMITTED')`,
    );
    await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "project_requests" ALTER COLUMN "status" TYPE "public"."project_requests_status_enum" USING "status"::"text"::"public"."project_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."project_requests_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f"`,
    );
    await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "projectId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "amount" TYPE numeric(14,2)`);
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_927a9184a0da350a677aa7e6269" FOREIGN KEY ("projectSpecId") REFERENCES "project_specs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_specs" ADD CONSTRAINT "FK_97ee9024805b4f2abe68ed78623" FOREIGN KEY ("requestId") REFERENCES "project_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_specs" DROP CONSTRAINT "FK_97ee9024805b4f2abe68ed78623"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP CONSTRAINT "FK_927a9184a0da350a677aa7e6269"`,
    );
    await queryRunner.query(
      `ALTER TABLE "milestones" DROP CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f"`,
    );
    await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "amount" TYPE numeric(15,2)`);
    await queryRunner.query(`ALTER TABLE "milestones" ALTER COLUMN "projectId" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "milestones" ADD CONSTRAINT "FK_662a1f9d865fe49768fa369fd0f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."project_requests_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED')`,
    );
    await queryRunner.query(`ALTER TABLE "project_requests" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "project_requests" ALTER COLUMN "status" TYPE "public"."project_requests_status_enum_old" USING "status"::"text"::"public"."project_requests_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`DROP TYPE "public"."project_requests_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."project_requests_status_enum_old" RENAME TO "project_requests_status_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "projectSpecId"`);
    await queryRunner.query(`DROP TABLE "project_specs"`);
    await queryRunner.query(`DROP TYPE "public"."project_specs_status_enum"`);
  }
}
