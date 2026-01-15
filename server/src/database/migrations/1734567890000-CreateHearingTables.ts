import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHearingTables1734567890000 implements MigrationInterface {
  name = 'CreateHearingTables1734567890000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create hearing status enum
    await queryRunner.query(`
      CREATE TYPE "hearing_status_enum" AS ENUM (
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELED',
        'RESCHEDULED'
      )
    `);

    // Create hearing statement type enum
    await queryRunner.query(`
      CREATE TYPE "hearing_statement_type_enum" AS ENUM (
        'OPENING',
        'EVIDENCE',
        'REBUTTAL',
        'CLOSING',
        'QUESTION',
        'ANSWER'
      )
    `);

    // Create hearing participant role enum
    await queryRunner.query(`
      CREATE TYPE "hearing_participant_role_enum" AS ENUM (
        'RAISER',
        'DEFENDANT',
        'WITNESS',
        'MODERATOR',
        'OBSERVER'
      )
    `);

    // Create dispute_hearings table
    await queryRunner.query(`
      CREATE TABLE "dispute_hearings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "disputeId" uuid NOT NULL,
        "status" "hearing_status_enum" NOT NULL DEFAULT 'SCHEDULED',
        "scheduledAt" TIMESTAMP NOT NULL,
        "startedAt" TIMESTAMP,
        "endedAt" TIMESTAMP,
        "agenda" text,
        "meetingLink" varchar,
        "requiredDocuments" jsonb,
        "moderatorId" uuid NOT NULL,
        "summary" text,
        "findings" text,
        "pendingActions" jsonb,
        "hearingNumber" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dispute_hearings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dispute_hearings_dispute" FOREIGN KEY ("disputeId") 
          REFERENCES "disputes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dispute_hearings_moderator" FOREIGN KEY ("moderatorId") 
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create hearing_participants table
    await queryRunner.query(`
      CREATE TABLE "hearing_participants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hearingId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "hearing_participant_role_enum" NOT NULL,
        "invitedAt" TIMESTAMP,
        "confirmedAt" TIMESTAMP,
        "joinedAt" TIMESTAMP,
        "leftAt" TIMESTAMP,
        "isOnline" boolean NOT NULL DEFAULT false,
        "hasSubmittedStatement" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hearing_participants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hearing_participants_hearing" FOREIGN KEY ("hearingId") 
          REFERENCES "dispute_hearings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hearing_participants_user" FOREIGN KEY ("userId") 
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create hearing_statements table
    await queryRunner.query(`
      CREATE TABLE "hearing_statements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hearingId" uuid NOT NULL,
        "participantId" uuid NOT NULL,
        "type" "hearing_statement_type_enum" NOT NULL,
        "content" text NOT NULL,
        "attachments" jsonb,
        "replyToStatementId" uuid,
        "orderIndex" integer NOT NULL DEFAULT 0,
        "isRedacted" boolean NOT NULL DEFAULT false,
        "redactedReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hearing_statements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hearing_statements_hearing" FOREIGN KEY ("hearingId") 
          REFERENCES "dispute_hearings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hearing_statements_participant" FOREIGN KEY ("participantId") 
          REFERENCES "hearing_participants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hearing_statements_reply" FOREIGN KEY ("replyToStatementId") 
          REFERENCES "hearing_statements"("id")
      )
    `);

    // Create hearing_questions table
    await queryRunner.query(`
      CREATE TABLE "hearing_questions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "hearingId" uuid NOT NULL,
        "askedById" uuid NOT NULL,
        "targetUserId" uuid NOT NULL,
        "question" text NOT NULL,
        "answer" text,
        "answeredAt" TIMESTAMP,
        "deadline" TIMESTAMP,
        "isRequired" boolean NOT NULL DEFAULT false,
        "orderIndex" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hearing_questions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_hearing_questions_hearing" FOREIGN KEY ("hearingId") 
          REFERENCES "dispute_hearings"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hearing_questions_askedBy" FOREIGN KEY ("askedById") 
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hearing_questions_targetUser" FOREIGN KEY ("targetUserId") 
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`
      CREATE INDEX "IDX_dispute_hearings_disputeId" ON "dispute_hearings" ("disputeId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dispute_hearings_status" ON "dispute_hearings" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dispute_hearings_scheduledAt" ON "dispute_hearings" ("scheduledAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hearing_participants_hearingId" ON "hearing_participants" ("hearingId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hearing_participants_userId" ON "hearing_participants" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hearing_statements_hearingId" ON "hearing_statements" ("hearingId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_hearing_questions_hearingId" ON "hearing_questions" ("hearingId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_questions_hearingId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_statements_hearingId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_participants_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_participants_hearingId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_hearings_scheduledAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_hearings_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_hearings_disputeId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "hearing_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hearing_statements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hearing_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_hearings"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "hearing_participant_role_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hearing_statement_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hearing_status_enum"`);
  }
}
