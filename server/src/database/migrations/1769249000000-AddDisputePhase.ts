import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDisputePhase1769249000000 implements MigrationInterface {
    name = 'AddDisputePhase1769249000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."disputes_phase_enum" AS ENUM('PRESENTATION', 'CROSS_EXAMINATION', 'INTERROGATION', 'DELIBERATION')`,
        );
        await queryRunner.query(
            `ALTER TABLE "disputes" ADD "phase" "public"."disputes_phase_enum" NOT NULL DEFAULT 'PRESENTATION'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "phase"`);
        await queryRunner.query(`DROP TYPE "public"."disputes_phase_enum"`);
    }
}
