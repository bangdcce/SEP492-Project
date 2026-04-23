-- Demo hearing retime script for Supabase SQL Editor
--
-- Purpose:
-- - Move an already auto-scheduled hearing to any date/time you want for demo
-- - Keep dispute_hearings, calendar_events, hearing_participants, and event_participants in sync
--
-- How to use:
-- 1. Paste this whole file into Supabase SQL Editor
-- 2. Edit the INPUT section below
-- 3. Run it
--
-- What ID should you enter?
-- - Best option: paste the hearing UUID into v_hearing_id
-- - Easier option: paste the dispute UUID into v_dispute_id, and the script will pick
--   the latest actionable hearing for that dispute automatically
-- - Fill only one of them. Prefer hearing_id when you already know the exact hearing
--
-- Time input:
-- - v_new_start_local accepts local time with timezone offset
-- - Example for Vietnam: '2026-04-24 14:30:00+07'

DO $$
DECLARE
  ---------------------------------------------------------------------------
  -- INPUT
  ---------------------------------------------------------------------------
  v_hearing_id uuid := null;
  v_dispute_id uuid := null;

  -- Local time you want to see in UI
  v_new_start_local timestamptz := '2026-04-24 14:30:00+07';

  -- Hearing duration in minutes
  v_duration_minutes integer := 60;

  -- true  = reset non-moderator confirmations back to PENDING for fresh demo
  -- false = only move the time and keep current participant confirmation state
  v_reset_confirmations boolean := true;

  ---------------------------------------------------------------------------
  -- INTERNAL
  ---------------------------------------------------------------------------
  v_target_hearing_id uuid;
  v_calendar_event_id uuid;
  v_now timestamptz := now();
  v_hearing_response_deadline timestamp;
  v_event_response_deadline timestamptz;
BEGIN
  IF v_hearing_id IS NULL AND v_dispute_id IS NULL THEN
    RAISE EXCEPTION 'Fill v_hearing_id or v_dispute_id before running the script.';
  END IF;

  IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'v_duration_minutes must be > 0.';
  END IF;

  ---------------------------------------------------------------------------
  -- Resolve hearing
  ---------------------------------------------------------------------------
  IF v_hearing_id IS NOT NULL THEN
    v_target_hearing_id := v_hearing_id;
  ELSE
    SELECT h.id
    INTO v_target_hearing_id
    FROM dispute_hearings h
    WHERE h."disputeId" = v_dispute_id
      AND h.status IN ('SCHEDULED', 'IN_PROGRESS', 'PAUSED')
    ORDER BY h."hearingNumber" DESC, h."createdAt" DESC
    LIMIT 1;

    IF v_target_hearing_id IS NULL THEN
      SELECT h.id
      INTO v_target_hearing_id
      FROM dispute_hearings h
      WHERE h."disputeId" = v_dispute_id
      ORDER BY h."hearingNumber" DESC, h."createdAt" DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_target_hearing_id IS NULL THEN
    RAISE EXCEPTION 'No hearing found. Check the dispute/hearing id.';
  END IF;

  SELECT e.id
  INTO v_calendar_event_id
  FROM calendar_events e
  WHERE e."referenceType" = 'DisputeHearing'
    AND e."referenceId" = v_target_hearing_id::text
  ORDER BY e."createdAt" DESC
  LIMIT 1;

  IF v_calendar_event_id IS NULL THEN
    RAISE EXCEPTION 'No linked calendar event found for hearing %.', v_target_hearing_id;
  END IF;

  ---------------------------------------------------------------------------
  -- Compute response deadlines
  -- Mirrors backend logic:
  -- - max now + 12h
  -- - but not later than 2h before hearing start
  -- - if already too close, clamp to now
  ---------------------------------------------------------------------------
  v_event_response_deadline :=
    LEAST(v_now + interval '12 hours', v_new_start_local - interval '2 hours');

  IF v_event_response_deadline <= v_now THEN
    v_event_response_deadline := v_now;
  END IF;

  v_hearing_response_deadline := timezone('UTC', v_event_response_deadline);

  ---------------------------------------------------------------------------
  -- Update hearing
  -- scheduledAt is timestamp without time zone in this schema, so store UTC wall-clock
  ---------------------------------------------------------------------------
  UPDATE dispute_hearings h
  SET
    status = 'SCHEDULED',
    "scheduledAt" = timezone('UTC', v_new_start_local),
    "startedAt" = null,
    "endedAt" = null,
    "pausedAt" = null,
    "pausedById" = null,
    "pauseReason" = null,
    "accumulatedPauseSeconds" = 0,
    "speakerRoleBeforePause" = null,
    "isChatRoomActive" = false,
    "currentSpeakerRole" = 'MUTED_ALL',
    "isEvidenceIntakeOpen" = false,
    "evidenceIntakeOpenedAt" = null,
    "evidenceIntakeClosedAt" = null,
    "evidenceIntakeOpenedBy" = null,
    "evidenceIntakeReason" = null,
    "estimatedDurationMinutes" = v_duration_minutes,
    "summary" = null,
    "findings" = null,
    "pendingActions" = null,
    "noShowNote" = null,
    "lastRescheduledAt" = timezone('UTC', v_now),
    "rescheduleCount" = COALESCE(h."rescheduleCount", 0) + 1,
    "updatedAt" = v_now
  WHERE h.id = v_target_hearing_id;

  ---------------------------------------------------------------------------
  -- Update hearing participants
  ---------------------------------------------------------------------------
  UPDATE hearing_participants hp
  SET
    "invitedAt" = timezone('UTC', v_now),
    "confirmedAt" = CASE
      WHEN hp.role = 'MODERATOR' THEN timezone('UTC', v_now)
      WHEN v_reset_confirmations THEN null
      ELSE hp."confirmedAt"
    END,
    "joinedAt" = null,
    "leftAt" = null,
    "isOnline" = false,
    "lastOnlineAt" = null,
    "totalOnlineMinutes" = 0,
    "responseDeadline" = v_hearing_response_deadline,
    "declineReason" = CASE WHEN v_reset_confirmations THEN null ELSE hp."declineReason" END
  WHERE hp."hearingId" = v_target_hearing_id;

  ---------------------------------------------------------------------------
  -- Update linked calendar event
  ---------------------------------------------------------------------------
  UPDATE calendar_events e
  SET
    status = CASE WHEN v_reset_confirmations THEN 'PENDING_CONFIRMATION' ELSE 'SCHEDULED' END,
    "startTime" = v_new_start_local,
    "endTime" = v_new_start_local + make_interval(mins => v_duration_minutes),
    "durationMinutes" = v_duration_minutes,
    "lastRescheduledAt" = v_now,
    "rescheduleCount" = COALESCE(e."rescheduleCount", 0) + 1,
    metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
      'demoRetimedAt', v_now,
      'demoRetimedLocal', v_new_start_local::text,
      'demoRetimedBy', 'supabase-sql'
    ),
    "updatedAt" = v_now
  WHERE e.id = v_calendar_event_id;

  ---------------------------------------------------------------------------
  -- Update event participants
  ---------------------------------------------------------------------------
  UPDATE event_participants ep
  SET
    status = CASE
      WHEN NOT v_reset_confirmations THEN ep.status
      WHEN ep.role IN ('MODERATOR', 'ORGANIZER') THEN 'ACCEPTED'
      ELSE 'PENDING'
    END,
    "responseDeadline" = v_event_response_deadline,
    "respondedAt" = CASE
      WHEN NOT v_reset_confirmations THEN ep."respondedAt"
      WHEN ep.role IN ('MODERATOR', 'ORGANIZER') THEN v_now
      ELSE null
    END,
    "responseNote" = CASE WHEN v_reset_confirmations THEN null ELSE ep."responseNote" END,
    "attendanceStatus" = 'NOT_STARTED',
    "joinedAt" = null,
    "leftAt" = null,
    "isOnline" = false,
    "lateMinutes" = null,
    "excuseReason" = null,
    "excuseApproved" = false
  WHERE ep."eventId" = v_calendar_event_id;

  RAISE NOTICE 'Demo hearing updated successfully.';
  RAISE NOTICE 'hearing_id = %', v_target_hearing_id;
  RAISE NOTICE 'calendar_event_id = %', v_calendar_event_id;
  RAISE NOTICE 'new_start_local = %', v_new_start_local;
  RAISE NOTICE 'duration_minutes = %', v_duration_minutes;
  RAISE NOTICE 'reset_confirmations = %', v_reset_confirmations;
END $$;
