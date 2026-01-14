import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncRemainingChanges1767963278437 implements MigrationInterface {
    name = 'SyncRemainingChanges1767963278437'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."dispute_hearings_status_enum" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'RESCHEDULED')`);
        await queryRunner.query(`CREATE TABLE "dispute_hearings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "disputeId" uuid NOT NULL, "status" "public"."dispute_hearings_status_enum" NOT NULL DEFAULT 'SCHEDULED', "scheduledAt" TIMESTAMP NOT NULL, "startedAt" TIMESTAMP, "endedAt" TIMESTAMP, "agenda" text, "meetingLink" character varying, "requiredDocuments" jsonb, "moderatorId" uuid NOT NULL, "summary" text, "findings" text, "pendingActions" jsonb, "hearingNumber" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e88b196b9cbf0b37e3d1632fc62" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."hearing_participants_role_enum" AS ENUM('RAISER', 'DEFENDANT', 'WITNESS', 'MODERATOR', 'OBSERVER')`);
        await queryRunner.query(`CREATE TABLE "hearing_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hearingId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."hearing_participants_role_enum" NOT NULL, "invitedAt" TIMESTAMP, "confirmedAt" TIMESTAMP, "joinedAt" TIMESTAMP, "leftAt" TIMESTAMP, "isOnline" boolean NOT NULL DEFAULT false, "hasSubmittedStatement" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_486427acde77ce82fbd7bd26228" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."hearing_statements_type_enum" AS ENUM('OPENING', 'EVIDENCE', 'REBUTTAL', 'CLOSING', 'QUESTION', 'ANSWER')`);
        await queryRunner.query(`CREATE TABLE "hearing_statements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hearingId" uuid NOT NULL, "participantId" uuid NOT NULL, "type" "public"."hearing_statements_type_enum" NOT NULL, "content" text NOT NULL, "attachments" jsonb, "replyToStatementId" uuid, "orderIndex" integer NOT NULL DEFAULT '0', "isRedacted" boolean NOT NULL DEFAULT false, "redactedReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0eec53fe84d1c3d6144f0351f88" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "hearing_questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hearingId" uuid NOT NULL, "askedById" uuid NOT NULL, "targetUserId" uuid NOT NULL, "question" text NOT NULL, "answer" text, "answeredAt" TIMESTAMP, "deadline" TIMESTAMP, "isRequired" boolean NOT NULL DEFAULT false, "orderIndex" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a847731b78e8f5e9ec4af2b91b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "linkedinUrl"`);
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "cvUrl"`);
        await queryRunner.query(`ALTER TABLE "dispute_hearings" ADD CONSTRAINT "FK_890bb8c2c38b9d08fa1073f7d11" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispute_hearings" ADD CONSTRAINT "FK_7affb78273ec41d28d86a728829" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" ADD CONSTRAINT "FK_b042a3349ecc4a9249d630813e2" FOREIGN KEY ("hearingId") REFERENCES "dispute_hearings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" ADD CONSTRAINT "FK_1f896e5790ddfc051f02ad2b385" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD CONSTRAINT "FK_d2a9328c62241eaf82a83939db9" FOREIGN KEY ("hearingId") REFERENCES "dispute_hearings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD CONSTRAINT "FK_edda350924cebff8659732193e1" FOREIGN KEY ("participantId") REFERENCES "hearing_participants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" ADD CONSTRAINT "FK_7784614ca12bdeca446e7e5166c" FOREIGN KEY ("replyToStatementId") REFERENCES "hearing_statements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD CONSTRAINT "FK_fa6f17995c98740ae434dc7432d" FOREIGN KEY ("hearingId") REFERENCES "dispute_hearings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD CONSTRAINT "FK_5e8108abe09d1b27fdfa4921450" FOREIGN KEY ("askedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" ADD CONSTRAINT "FK_7e40541c0cd7707c53d9c3d176b" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP CONSTRAINT "FK_7e40541c0cd7707c53d9c3d176b"`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP CONSTRAINT "FK_5e8108abe09d1b27fdfa4921450"`);
        await queryRunner.query(`ALTER TABLE "hearing_questions" DROP CONSTRAINT "FK_fa6f17995c98740ae434dc7432d"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP CONSTRAINT "FK_7784614ca12bdeca446e7e5166c"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP CONSTRAINT "FK_edda350924cebff8659732193e1"`);
        await queryRunner.query(`ALTER TABLE "hearing_statements" DROP CONSTRAINT "FK_d2a9328c62241eaf82a83939db9"`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" DROP CONSTRAINT "FK_1f896e5790ddfc051f02ad2b385"`);
        await queryRunner.query(`ALTER TABLE "hearing_participants" DROP CONSTRAINT "FK_b042a3349ecc4a9249d630813e2"`);
        await queryRunner.query(`ALTER TABLE "dispute_hearings" DROP CONSTRAINT "FK_7affb78273ec41d28d86a728829"`);
        await queryRunner.query(`ALTER TABLE "dispute_hearings" DROP CONSTRAINT "FK_890bb8c2c38b9d08fa1073f7d11"`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD "cvUrl" text`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD "linkedinUrl" text`);
        await queryRunner.query(`DROP TABLE "hearing_questions"`);
        await queryRunner.query(`DROP TABLE "hearing_statements"`);
        await queryRunner.query(`DROP TYPE "public"."hearing_statements_type_enum"`);
        await queryRunner.query(`DROP TABLE "hearing_participants"`);
        await queryRunner.query(`DROP TYPE "public"."hearing_participants_role_enum"`);
        await queryRunner.query(`DROP TABLE "dispute_hearings"`);
        await queryRunner.query(`DROP TYPE "public"."dispute_hearings_status_enum"`);
    }

}
