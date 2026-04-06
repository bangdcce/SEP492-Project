#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PENDING_CONFIRMATION_TIMEOUT_SUMMARY =
  'System auto-close: Required confirmations did not arrive before the hearing window, so the session was canceled and flagged for manual review.';
const PENDING_CONFIRMATION_TIMEOUT_FINDINGS =
  'The hearing remained blocked in confirmation handling and now requires manual staff/admin review before another slot is scheduled.';
const PENDING_CONFIRMATION_TIMEOUT_NOTE =
  'System-generated note: Primary-side confirmation was not received before the response deadline.';

const DEFAULT_FOLLOW_UP_PENDING_ACTIONS = [
  {
    code: 'REQUEST_MORE_EVIDENCE',
    label: 'Request additional evidence',
    ownerRole: 'STAFF',
    urgent: false,
    note: 'Review the hearing record and pending evidence before the next session.',
  },
  {
    code: 'SCHEDULE_FOLLOW_UP_HEARING',
    label: 'Schedule follow-up hearing',
    ownerRole: 'STAFF',
    urgent: false,
    note: 'Continue the dispute in the next scheduled hearing unless a verdict is issued earlier.',
  },
];

function buildClient() {
  const host = process.env.DB_HOST;

  return new Client({
    host,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: host && host.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
  });
}

async function main() {
  const client = buildClient();
  await client.connect();

  try {
    await client.query('BEGIN');

    const candidates = await client.query(
      `
      SELECT
        h.id AS hearing_id,
        e.id AS event_id,
        MAX(ep."responseDeadline") AS latest_response_deadline
      FROM "dispute_hearings" h
      INNER JOIN "calendar_events" e
        ON e."referenceType" = 'DisputeHearing'
       AND e."referenceId" = h.id::text
      LEFT JOIN "event_participants" ep
        ON ep."eventId" = e.id
      WHERE h.status = 'SCHEDULED'
        AND e.status = 'PENDING_CONFIRMATION'
        AND COALESCE((e.metadata ->> 'manualNoShowReviewRequired')::boolean, false) = false
      GROUP BY h.id, e.id
      HAVING MAX(ep."responseDeadline") IS NOT NULL
         AND MAX(ep."responseDeadline") < NOW()
      ORDER BY MAX(ep."responseDeadline") ASC
    `,
    );

    const hearingIds = candidates.rows.map((row) => row.hearing_id);
    const eventIds = candidates.rows.map((row) => row.event_id);

    if (hearingIds.length === 0) {
      await client.query('COMMIT');
      console.log(
        JSON.stringify(
          {
            processed: false,
            reason: 'No expired pending-confirmation hearings found.',
            candidateCount: 0,
          },
          null,
          2,
        ),
      );
      return;
    }

    const updatedHearings = await client.query(
      `
      UPDATE "dispute_hearings" h
      SET
        status = 'CANCELED',
        "endedAt" = NOW(),
        "isChatRoomActive" = false,
        "currentSpeakerRole" = 'MUTED_ALL',
        "isEvidenceIntakeOpen" = false,
        "evidenceIntakeClosedAt" = CASE WHEN h."isEvidenceIntakeOpen" THEN NOW() ELSE NULL END,
        "accumulatedPauseSeconds" = COALESCE(h."accumulatedPauseSeconds", 0),
        "pausedAt" = NULL,
        "pausedById" = NULL,
        "pauseReason" = NULL,
        "speakerRoleBeforePause" = NULL,
        "summary" = $1,
        "findings" = $2,
        "pendingActions" = $3::jsonb,
        "noShowNote" = $4
      WHERE h.id = ANY($5::uuid[])
      RETURNING h.id
    `,
      [
        PENDING_CONFIRMATION_TIMEOUT_SUMMARY,
        PENDING_CONFIRMATION_TIMEOUT_FINDINGS,
        JSON.stringify(DEFAULT_FOLLOW_UP_PENDING_ACTIONS),
        PENDING_CONFIRMATION_TIMEOUT_NOTE,
        hearingIds,
      ],
    );

    const updatedEvents = await client.query(
      `
      UPDATE "calendar_events" e
      SET
        status = 'CANCELLED',
        metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
          'manualNoShowReviewRequired', true,
          'noShowReady', true,
          'noShowReason', $1::text,
          'confirmationExpiredAt', NOW()::text
        )
      WHERE e.id = ANY($2::uuid[])
      RETURNING e.id
    `,
      [PENDING_CONFIRMATION_TIMEOUT_NOTE, eventIds],
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          processed: true,
          candidateCount: candidates.rowCount,
          hearingsCanceled: updatedHearings.rowCount,
          eventsCanceled: updatedEvents.rowCount,
          hearingIds,
          eventIds,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('HEARING_BACKLOG_PROCESS_FAILED', error);
  process.exit(1);
});
