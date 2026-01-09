import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDiputeAndWarning1767439611931 implements MigrationInterface {
    name = 'UpdateDiputeAndWarning1767439611931'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_flags" DROP CONSTRAINT "FK_user_flags_appealResolvedBy"`);
        await queryRunner.query(`ALTER TABLE "user_flags" DROP CONSTRAINT "FK_user_flags_createdBy"`);
        await queryRunner.query(`ALTER TABLE "user_flags" DROP CONSTRAINT "FK_user_flags_resolvedBy"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_095c0da1ca820448832b8644d48"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_63350ddb7e04b507e7c4fdf46b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_flags_user_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_flags_status_severity"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_disputes_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_disputes_priority"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_disputes_isAppealed"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_disputes_responseDeadline"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_notes_disputeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_notes_authorId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_notes_isInternal"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_activities_disputeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_activities_actorId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_activities_action"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dispute_activities_timestamp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetpasswordotp"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetpasswordotpexpires"`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "milestoneId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "messages" text`);
        await queryRunner.query(`ALTER TYPE "public"."projects_status_enum" RENAME TO "projects_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('PLANNING', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'PAID', 'DISPUTED', 'CANCELED')`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."projects_status_enum" USING "status"::"text"::"public"."projects_status_enum"`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PLANNING'`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "category" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "category" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "disputedAmount" TYPE numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "groupId"`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "groupId" character varying`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "appealResolvedById"`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "appealResolvedById" character varying`);
        await queryRunner.query(`ALTER TABLE "dispute_notes" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "dispute_notes" ALTER COLUMN "updatedAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "dispute_activities" ALTER COLUMN "timestamp" SET DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_756c5751bed65f11ac540eec0c" ON "user_flags" ("status", "severity") `);
        await queryRunner.query(`CREATE INDEX "IDX_0fee7d9cc550129521f99ca861" ON "user_flags" ("userId", "type") `);
        await queryRunner.query(`ALTER TABLE "user_flags" ADD CONSTRAINT "FK_8947514bed8a3f78d16d6ac3f7e" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_flags" ADD CONSTRAINT "FK_6a27efdb19b62bdd218c689108a" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_flags" ADD CONSTRAINT "FK_ba9ed3cec568084e68b8cb382a8" FOREIGN KEY ("appealResolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_7aebab8b5f52cd36df7211844b9" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_095c0da1ca820448832b8644d48" FOREIGN KEY ("parentDisputeId") REFERENCES "disputes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_095c0da1ca820448832b8644d48"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_7aebab8b5f52cd36df7211844b9"`);
        await queryRunner.query(`ALTER TABLE "user_flags" DROP CONSTRAINT "FK_ba9ed3cec568084e68b8cb382a8"`);
        await queryRunner.query(`ALTER TABLE "user_flags" DROP CONSTRAINT "FK_6a27efdb19b62bdd218c689108a"`);
        await queryRunner.query(`ALTER TABLE "user_flags" DROP CONSTRAINT "FK_8947514bed8a3f78d16d6ac3f7e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fee7d9cc550129521f99ca861"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_756c5751bed65f11ac540eec0c"`);
        await queryRunner.query(`ALTER TABLE "dispute_activities" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "dispute_notes" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "dispute_notes" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "appealResolvedById"`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "appealResolvedById" uuid`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "groupId"`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD "groupId" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "disputedAmount" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "category" SET DEFAULT 'OTHER'`);
        await queryRunner.query(`ALTER TABLE "disputes" ALTER COLUMN "category" SET NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum_old" AS ENUM('PLANNING', 'IN_PROGRESS', 'TESTING', 'COMPLETED', 'DISPUTED', 'CANCELED')`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" TYPE "public"."projects_status_enum_old" USING "status"::"text"::"public"."projects_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'PLANNING'`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."projects_status_enum_old" RENAME TO "projects_status_enum"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "messages"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP COLUMN "milestoneId"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetpasswordotpexpires" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetpasswordotp" character varying(6)`);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_activities_timestamp" ON "dispute_activities" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_activities_action" ON "dispute_activities" ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_activities_actorId" ON "dispute_activities" ("actorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_activities_disputeId" ON "dispute_activities" ("disputeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_notes_isInternal" ON "dispute_notes" ("isInternal") `);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_notes_authorId" ON "dispute_notes" ("authorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dispute_notes_disputeId" ON "dispute_notes" ("disputeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_disputes_responseDeadline" ON "disputes" ("responseDeadline") `);
        await queryRunner.query(`CREATE INDEX "IDX_disputes_isAppealed" ON "disputes" ("isAppealed") `);
        await queryRunner.query(`CREATE INDEX "IDX_disputes_priority" ON "disputes" ("priority") `);
        await queryRunner.query(`CREATE INDEX "IDX_disputes_category" ON "disputes" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_flags_status_severity" ON "user_flags" ("severity", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_flags_user_type" ON "user_flags" ("type", "userId") `);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_63350ddb7e04b507e7c4fdf46b1" FOREIGN KEY ("appealResolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_095c0da1ca820448832b8644d48" FOREIGN KEY ("parentDisputeId") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_flags" ADD CONSTRAINT "FK_user_flags_resolvedBy" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_flags" ADD CONSTRAINT "FK_user_flags_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_flags" ADD CONSTRAINT "FK_user_flags_appealResolvedBy" FOREIGN KEY ("appealResolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
