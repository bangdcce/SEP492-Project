-- Install once in Supabase SQL Editor.
-- After that, during demo you only need to run:
--
-- select * from public.demo_reschedule_hearing(
--   p_hearing_id := 'YOUR_HEARING_UUID',
--   p_dispute_id := null,
--   p_new_start_local := '2026-04-24 14:30:00+07',
--   p_duration_minutes := 60,
--   p_reset_confirmations := true
-- );
--
-- You can also pass p_dispute_id and leave p_hearing_id as null.
-- In that case, the function picks the latest actionable hearing of that dispute.

create or replace function public.demo_reschedule_hearing(
  p_hearing_id uuid default null,
  p_dispute_id uuid default null,
  p_new_start_local timestamptz default now() + interval '30 minutes',
  p_duration_minutes integer default 60,
  p_reset_confirmations boolean default true
)
returns table (
  hearing_id uuid,
  calendar_event_id uuid,
  dispute_id uuid,
  new_start_local timestamptz,
  duration_minutes integer,
  reset_confirmations boolean
)
language plpgsql
as $$
declare
  v_target_hearing_id uuid;
  v_calendar_event_id uuid;
  v_dispute_id uuid;
  v_now timestamptz := now();
  v_hearing_response_deadline timestamp;
  v_event_response_deadline timestamptz;
begin
  if p_hearing_id is null and p_dispute_id is null then
    raise exception 'Provide p_hearing_id or p_dispute_id.';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'p_duration_minutes must be > 0.';
  end if;

  if p_hearing_id is not null then
    v_target_hearing_id := p_hearing_id;
  else
    select h.id
    into v_target_hearing_id
    from dispute_hearings h
    where h."disputeId" = p_dispute_id
      and h.status in ('SCHEDULED', 'IN_PROGRESS', 'PAUSED')
    order by h."hearingNumber" desc, h."createdAt" desc
    limit 1;

    if v_target_hearing_id is null then
      select h.id
      into v_target_hearing_id
      from dispute_hearings h
      where h."disputeId" = p_dispute_id
      order by h."hearingNumber" desc, h."createdAt" desc
      limit 1;
    end if;
  end if;

  if v_target_hearing_id is null then
    raise exception 'No hearing found for the supplied input.';
  end if;

  select h."disputeId"
  into v_dispute_id
  from dispute_hearings h
  where h.id = v_target_hearing_id;

  select e.id
  into v_calendar_event_id
  from calendar_events e
  where e."referenceType" = 'DisputeHearing'
    and e."referenceId" = v_target_hearing_id::text
  order by e."createdAt" desc
  limit 1;

  if v_calendar_event_id is null then
    raise exception 'No linked calendar event found for hearing %.', v_target_hearing_id;
  end if;

  v_event_response_deadline :=
    least(v_now + interval '12 hours', p_new_start_local - interval '2 hours');

  if v_event_response_deadline <= v_now then
    v_event_response_deadline := v_now;
  end if;

  v_hearing_response_deadline := timezone('UTC', v_event_response_deadline);

  update dispute_hearings h
  set
    status = 'SCHEDULED',
    "scheduledAt" = timezone('UTC', p_new_start_local),
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
    "estimatedDurationMinutes" = p_duration_minutes,
    "summary" = null,
    "findings" = null,
    "pendingActions" = null,
    "noShowNote" = null,
    "lastRescheduledAt" = timezone('UTC', v_now),
    "rescheduleCount" = coalesce(h."rescheduleCount", 0) + 1,
    "updatedAt" = v_now
  where h.id = v_target_hearing_id;

  update hearing_participants hp
  set
    "invitedAt" = timezone('UTC', v_now),
    "confirmedAt" = case
      when hp.role = 'MODERATOR' then timezone('UTC', v_now)
      when p_reset_confirmations then null
      else hp."confirmedAt"
    end,
    "joinedAt" = null,
    "leftAt" = null,
    "isOnline" = false,
    "lastOnlineAt" = null,
    "totalOnlineMinutes" = 0,
    "responseDeadline" = v_hearing_response_deadline,
    "declineReason" = case when p_reset_confirmations then null else hp."declineReason" end
  where hp."hearingId" = v_target_hearing_id;

  update calendar_events e
  set
    status = case when p_reset_confirmations then 'PENDING_CONFIRMATION' else 'SCHEDULED' end,
    "startTime" = p_new_start_local,
    "endTime" = p_new_start_local + make_interval(mins => p_duration_minutes),
    "durationMinutes" = p_duration_minutes,
    "lastRescheduledAt" = v_now,
    "rescheduleCount" = coalesce(e."rescheduleCount", 0) + 1,
    metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
      'demoRetimedAt', v_now,
      'demoRetimedLocal', p_new_start_local::text,
      'demoRetimedBy', 'supabase-function'
    ),
    "updatedAt" = v_now
  where e.id = v_calendar_event_id;

  update event_participants ep
  set
    status = case
      when not p_reset_confirmations then ep.status
      when ep.role in ('MODERATOR', 'ORGANIZER') then 'ACCEPTED'
      else 'PENDING'
    end,
    "responseDeadline" = v_event_response_deadline,
    "respondedAt" = case
      when not p_reset_confirmations then ep."respondedAt"
      when ep.role in ('MODERATOR', 'ORGANIZER') then v_now
      else null
    end,
    "responseNote" = case when p_reset_confirmations then null else ep."responseNote" end,
    "attendanceStatus" = 'NOT_STARTED',
    "joinedAt" = null,
    "leftAt" = null,
    "isOnline" = false,
    "lateMinutes" = null,
    "excuseReason" = null,
    "excuseApproved" = false
  where ep."eventId" = v_calendar_event_id;

  return query
  select
    v_target_hearing_id,
    v_calendar_event_id,
    v_dispute_id,
    p_new_start_local,
    p_duration_minutes,
    p_reset_confirmations;
end;
$$;
