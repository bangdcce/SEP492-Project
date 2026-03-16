import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeColumnTypesAndIndexes1772500000000 implements MigrationInterface {
  name = 'OptimizeColumnTypesAndIndexes1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════════
    // PART A: Add missing indexes for query performance
    // ═══════════════════════════════════════════════════════════════

    // disputes table
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_status" ON "disputes" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_raised_by" ON "disputes" ("raisedById")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_defendant" ON "disputes" ("defendantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_assigned_staff" ON "disputes" ("assignedStaffId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_project" ON "disputes" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_milestone" ON "disputes" ("milestoneId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_disputes_status_created" ON "disputes" ("status", "createdAt")`,
    );

    // dispute_activities
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_activities_dispute_timestamp" ON "dispute_activities" ("disputeId", "timestamp")`,
    );

    // dispute_notes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_notes_dispute_created" ON "dispute_notes" ("disputeId", "createdAt")`,
    );

    // dispute_verdicts
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_verdicts_dispute" ON "dispute_verdicts" ("disputeId")`,
    );

    // dispute_hearings
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_hearings_dispute_status" ON "dispute_hearings" ("disputeId", "status")`,
    );

    // notifications
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read_created" ON "notifications" ("userId", "isRead", "createdAt")`,
    );

    // trust_score_history
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'trust_score_history'
            AND column_name = 'calculatedAt'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_trust_score_history_user_created" ON "trust_score_history" ("userId", "calculatedAt")';
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'trust_score_history'
            AND column_name = 'createdAt'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_trust_score_history_user_created" ON "trust_score_history" ("userId", "createdAt")';
        END IF;
      END
      $$;
    `);

    // reports
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'reports'
            AND column_name = 'created_at'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_reports_status_created" ON "reports" ("status", "created_at")';
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'reports'
            AND column_name = 'createdAt'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_reports_status_created" ON "reports" ("status", "createdAt")';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_review" ON "reports" ("review_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reports_reporter" ON "reports" ("reporter_id")`,
    );

    // dispute_messages
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_messages_dispute_created" ON "dispute_messages" ("disputeId", "createdAt")`,
    );

    // dispute_evidences
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_evidences_dispute" ON "dispute_evidences" ("disputeId")`,
    );

    // dispute_settlements
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_settlements_dispute" ON "dispute_settlements" ("disputeId")`,
    );

    // hearing_participants
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hearing_participants_hearing" ON "hearing_participants" ("hearingId")`,
    );

    // hearing_statements
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_hearing_statements_hearing" ON "hearing_statements" ("hearingId")`,
    );

    // calendar_events
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_calendar_events_organizer" ON "calendar_events" ("organizerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_calendar_events_start_end" ON "calendar_events" ("startTime", "endTime")`,
    );

    // event_participants
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_participants_user" ON "event_participants" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_event_participants_event" ON "event_participants" ("eventId")`,
    );

    // user_flags
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_flags_user_status" ON "user_flags" ("userId", "status")`,
    );

    // staff_leave_requests
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_staff_leave_requests_staff_status" ON "staff_leave_requests" ("staffId", "status")`,
    );

    // audit_logs
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'actor_id'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor" ON "audit_logs" ("actor_id")';
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'actorId'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor" ON "audit_logs" ("actorId")';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'entity_type'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'entity_id'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")';
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'entityType'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'entityId'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity" ON "audit_logs" ("entityType", "entityId")';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'created_at'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created" ON "audit_logs" ("created_at")';
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'audit_logs'
            AND column_name = 'createdAt'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created" ON "audit_logs" ("createdAt")';
        END IF;
      END
      $$;
    `);

    // reviews
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reviews_project" ON "reviews" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reviews_target_user" ON "reviews" ("targetUserId")`,
    );

    // staff_performances
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'staff_performances'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_staff_performance_staff_period" ON "staff_performances" ("staffId", "period")';
        END IF;
      END
      $$;
    `);

    // staff_workloads
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'staff_workloads'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_staff_workload_staff_date" ON "staff_workloads" ("staffId", "date")';
        END IF;
      END
      $$;
    `);

    // ═══════════════════════════════════════════════════════════════
    // PART B: Convert text → varchar(N) for size constraints
    // Each uses DO $$ for idempotency (only alters if still text)
    // ═══════════════════════════════════════════════════════════════

    const textToVarchar: Array<{ table: string; column: string; length: number }> = [
      // disputes
      { table: 'disputes', column: 'reason', length: 5000 },
      { table: 'disputes', column: 'messages', length: 5000 },
      { table: 'disputes', column: 'defendantResponse', length: 5000 },
      { table: 'disputes', column: 'triageReason', length: 2000 },
      { table: 'disputes', column: 'infoRequestReason', length: 2000 },
      { table: 'disputes', column: 'adminComment', length: 2000 },
      { table: 'disputes', column: 'rejectionAppealReason', length: 2000 },
      { table: 'disputes', column: 'rejectionAppealResolution', length: 2000 },
      { table: 'disputes', column: 'appealReason', length: 2000 },
      { table: 'disputes', column: 'appealResolution', length: 2000 },
      { table: 'disputes', column: 'escalationReason', length: 2000 },
      // dispute_hearings
      { table: 'dispute_hearings', column: 'agenda', length: 2000 },
      { table: 'dispute_hearings', column: 'summary', length: 5000 },
      { table: 'dispute_hearings', column: 'findings', length: 5000 },
      { table: 'dispute_hearings', column: 'pauseReason', length: 1000 },
      { table: 'dispute_hearings', column: 'evidenceIntakeReason', length: 1000 },
      { table: 'dispute_hearings', column: 'noShowNote', length: 2000 },
      // hearing_participants
      { table: 'hearing_participants', column: 'declineReason', length: 1000 },
      // hearing_statements
      { table: 'hearing_statements', column: 'content', length: 10000 },
      { table: 'hearing_statements', column: 'redactedReason', length: 1000 },
      // hearing_questions
      { table: 'hearing_questions', column: 'question', length: 2000 },
      { table: 'hearing_questions', column: 'answer', length: 5000 },
      // dispute_messages
      { table: 'dispute_messages', column: 'content', length: 5000 },
      // dispute_evidences
      { table: 'dispute_evidences', column: 'description', length: 1000 },
      { table: 'dispute_evidences', column: 'flagReason', length: 1000 },
      // dispute_notes
      { table: 'dispute_notes', column: 'content', length: 5000 },
      // dispute_verdicts
      { table: 'dispute_verdicts', column: 'warningMessage', length: 2000 },
      // dispute_settlements
      { table: 'dispute_settlements', column: 'terms', length: 2000 },
      { table: 'dispute_settlements', column: 'rejectedReason', length: 1000 },
      // dispute_ledgers
      { table: 'dispute_ledgers', column: 'reason', length: 1000 },
      // notifications
      { table: 'notifications', column: 'body', length: 2000 },
      // audit_logs
      { table: 'audit_logs', column: 'userAgent', length: 500 },
      // reviews
      { table: 'reviews', column: 'comment', length: 2000 },
      { table: 'reviews', column: 'deleteReason', length: 1000 },
      // reports
      { table: 'reports', column: 'description', length: 2000 },
      { table: 'reports', column: 'adminNote', length: 2000 },
      // staff_leave_requests
      { table: 'staff_leave_requests', column: 'reason', length: 1000 },
      { table: 'staff_leave_requests', column: 'processedNote', length: 1000 },
      // user_flags
      { table: 'user_flags', column: 'description', length: 2000 },
      { table: 'user_flags', column: 'adminNote', length: 2000 },
      { table: 'user_flags', column: 'resolution', length: 2000 },
      { table: 'user_flags', column: 'appealReason', length: 2000 },
      { table: 'user_flags', column: 'appealResolution', length: 2000 },
      // calendar_events
      { table: 'calendar_events', column: 'description', length: 2000 },
      { table: 'calendar_events', column: 'notes', length: 1000 },
      // event_participants
      { table: 'event_participants', column: 'responseNote', length: 1000 },
      { table: 'event_participants', column: 'excuseReason', length: 1000 },
      // event_reschedule_requests
      { table: 'event_reschedule_requests', column: 'reason', length: 2000 },
      { table: 'event_reschedule_requests', column: 'processNote', length: 1000 },
      // user_availabilities
      { table: 'user_availabilities', column: 'note', length: 1000 },
      // dispute_schedule_proposals
      { table: 'dispute_schedule_proposals', column: 'note', length: 1000 },
      // dispute_skill_requirements
      { table: 'dispute_skill_requirements', column: 'notes', length: 1000 },
      // dispute_resolution_feedbacks
      { table: 'dispute_resolution_feedbacks', column: 'comment', length: 2000 },
    ];

    for (const { table, column, length } of textToVarchar) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = '${column}' AND data_type = 'text'
          ) THEN
            ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE varchar(${length});
          END IF;
        END
        $$;
      `);
    }

    // ═══════════════════════════════════════════════════════════════
    // PART C: Add length constraints to bare varchar columns
    // ═══════════════════════════════════════════════════════════════

    const constrainVarchar: Array<{ table: string; column: string; length: number }> = [
      { table: 'dispute_messages', column: 'senderRole', length: 50 },
      { table: 'dispute_evidences', column: 'storagePath', length: 500 },
      { table: 'dispute_evidences', column: 'fileName', length: 255 },
      { table: 'dispute_evidences', column: 'mimeType', length: 100 },
      { table: 'dispute_verdicts', column: 'adjudicatorRole', length: 50 },
      { table: 'dispute_verdicts', column: 'faultyParty', length: 50 },
      { table: 'dispute_settlements', column: 'proposerRole', length: 50 },
      { table: 'calendar_events', column: 'location', length: 500 },
      { table: 'calendar_events', column: 'externalMeetingLink', length: 500 },
      { table: 'dispute_hearings', column: 'externalMeetingLink', length: 500 },
      { table: 'notifications', column: 'relatedType', length: 50 },
      { table: 'notifications', column: 'relatedId', length: 36 },
      { table: 'dispute_resolution_feedbacks', column: 'userRole', length: 50 },
    ];

    for (const { table, column, length } of constrainVarchar) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = '${column}'
              AND (character_maximum_length IS NULL OR character_maximum_length > ${length})
          ) THEN
            ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE varchar(${length});
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes (reverse of PART A)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_raised_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_defendant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_assigned_staff"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_project"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_milestone"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disputes_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_activities_dispute_timestamp"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_notes_dispute_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_verdicts_dispute"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_hearings_dispute_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_user_read_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trust_score_history_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_status_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_review"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_reporter"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_messages_dispute_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_evidences_dispute"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dispute_settlements_dispute"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_participants_hearing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hearing_statements_hearing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_events_organizer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_calendar_events_start_end"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_participants_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_participants_event"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_flags_user_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_staff_leave_requests_staff_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_project"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reviews_target_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_staff_performance_staff_period"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_staff_workload_staff_date"`);

    // Column type reversions would require converting varchar back to text.
    // This is not typically needed and data is preserved either way.
    // Omitted for safety — varchar(N) → text is a non-breaking change if needed manually.
  }
}
