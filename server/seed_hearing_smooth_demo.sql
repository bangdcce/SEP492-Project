-- ==================================================================================
-- SCRIPT: seed_hearing_smooth_demo.sql
-- PURPOSE:
-- 1) Ensure demo accounts exist for STAFF / CLIENT / FREELANCER / BROKER
-- 2) Create or refresh one mediation dispute ready for hearing scheduling
-- 3) Pre-seed overlapping proposals + preferred availability slots for smooth demo
--
-- Accounts (password: password123):
--   STAFF      staff.test.new@example.com
--   CLIENT     client.test.new@example.com
--   FREELANCER freelancer.test.new@example.com
--   BROKER     broker.test.new@example.com
-- ==================================================================================

DO $$
DECLARE
  v_password_hash text := '$2b$10$wrpNPn/rQNaxJw6cLXiD9.KFcSCkTRwcXXsKmLBfibNUrj.w.XvAW';

  v_staff_id uuid;
  v_client_id uuid;
  v_freelancer_id uuid;
  v_broker_id uuid;

  v_project_id uuid;
  v_milestone_id uuid;
  v_dispute_id uuid;
  v_hearing_id uuid;
  v_event_id uuid;
  v_hp_moderator_id uuid;
  v_hp_raiser_id uuid;
  v_hp_defendant_id uuid;
  v_hp_witness_id uuid;
  v_evidence_client_id uuid;
  v_evidence_freelancer_id uuid;

  v_now timestamptz := now();
  v_seed_tag text := to_char(v_now, 'YYYYMMDD');
  v_project_title text := 'HEARING DEMO SMOOTH :: ' || v_seed_tag;
  v_milestone_title text := 'Hearing demo milestone';
  v_seed_note text := 'DEMO_HEARING_SMOOTH_' || v_seed_tag;
  v_hearing_agenda text := 'DEMO HEARING ROOM :: READY FOR CALENDAR + ACCESS';

  v_slot_1_start timestamptz;
  v_slot_1_end timestamptz;
  v_slot_2_start timestamptz;
  v_slot_2_end timestamptz;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1) UPSERT 4 DEMO USERS
  -- ---------------------------------------------------------------------------
  INSERT INTO "users"
    ("email", "passwordHash", "fullName", "role", "isVerified", "timeZone", "createdAt", "updatedAt")
  VALUES
    ('staff.test.new@example.com', v_password_hash, 'Demo Staff', 'STAFF', true, 'UTC', v_now, v_now)
  ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = EXCLUDED."passwordHash",
    "fullName" = EXCLUDED."fullName",
    "role" = 'STAFF',
    "isVerified" = true,
    "timeZone" = COALESCE("users"."timeZone", 'UTC'),
    "updatedAt" = now()
  RETURNING "id" INTO v_staff_id;

  INSERT INTO "users"
    ("email", "passwordHash", "fullName", "role", "isVerified", "timeZone", "createdAt", "updatedAt")
  VALUES
    ('client.test.new@example.com', v_password_hash, 'Demo Client', 'CLIENT', true, 'UTC', v_now, v_now)
  ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = EXCLUDED."passwordHash",
    "fullName" = EXCLUDED."fullName",
    "role" = 'CLIENT',
    "isVerified" = true,
    "timeZone" = COALESCE("users"."timeZone", 'UTC'),
    "updatedAt" = now()
  RETURNING "id" INTO v_client_id;

  INSERT INTO "users"
    ("email", "passwordHash", "fullName", "role", "isVerified", "timeZone", "createdAt", "updatedAt")
  VALUES
    ('freelancer.test.new@example.com', v_password_hash, 'Demo Freelancer', 'FREELANCER', true, 'UTC', v_now, v_now)
  ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = EXCLUDED."passwordHash",
    "fullName" = EXCLUDED."fullName",
    "role" = 'FREELANCER',
    "isVerified" = true,
    "timeZone" = COALESCE("users"."timeZone", 'UTC'),
    "updatedAt" = now()
  RETURNING "id" INTO v_freelancer_id;

  INSERT INTO "users"
    ("email", "passwordHash", "fullName", "role", "isVerified", "timeZone", "createdAt", "updatedAt")
  VALUES
    ('broker.test.new@example.com', v_password_hash, 'Demo Broker', 'BROKER', true, 'UTC', v_now, v_now)
  ON CONFLICT ("email") DO UPDATE SET
    "passwordHash" = EXCLUDED."passwordHash",
    "fullName" = EXCLUDED."fullName",
    "role" = 'BROKER',
    "isVerified" = true,
    "timeZone" = COALESCE("users"."timeZone", 'UTC'),
    "updatedAt" = now()
  RETURNING "id" INTO v_broker_id;

  -- ---------------------------------------------------------------------------
  -- 2) CREATE/REFRESH PROJECT + MILESTONE FOR DEMO
  -- ---------------------------------------------------------------------------
  SELECT "id"
  INTO v_project_id
  FROM "projects"
  WHERE "title" = v_project_title
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF v_project_id IS NULL THEN
    v_project_id := gen_random_uuid();
    INSERT INTO "projects" (
      "id", "clientId", "brokerId", "freelancerId", "title", "description",
      "totalBudget", "currency", "pricingModel", "startDate", "endDate",
      "status", "createdAt", "updatedAt"
    ) VALUES (
      v_project_id, v_client_id, v_broker_id, v_freelancer_id, v_project_title,
      'Demo project to keep hearing auto-schedule smooth and predictable.',
      2500, 'USD', 'FIXED_PRICE', v_now - interval '1 day', v_now + interval '14 day',
      'IN_PROGRESS', v_now, v_now
    );
  ELSE
    UPDATE "projects"
    SET
      "clientId" = v_client_id,
      "brokerId" = v_broker_id,
      "freelancerId" = v_freelancer_id,
      "status" = 'IN_PROGRESS',
      "updatedAt" = v_now
    WHERE "id" = v_project_id;
  END IF;

  SELECT "id"
  INTO v_milestone_id
  FROM "milestones"
  WHERE "projectId" = v_project_id
    AND "title" = v_milestone_title
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF v_milestone_id IS NULL THEN
    v_milestone_id := gen_random_uuid();
    INSERT INTO "milestones" (
      "id", "projectId", "title", "description", "amount", "deliverableType",
      "startDate", "dueDate", "status", "submittedAt", "sortOrder", "createdAt"
    ) VALUES (
      v_milestone_id, v_project_id, v_milestone_title,
      'Milestone prepared for hearing scheduling demo flow.',
      2500, 'SOURCE_CODE',
      v_now - interval '1 day', v_now + interval '7 day',
      'SUBMITTED', v_now - interval '30 minutes', 1, v_now
    );
  ELSE
    UPDATE "milestones"
    SET
      "status" = 'SUBMITTED',
      "submittedAt" = v_now - interval '30 minutes',
      "dueDate" = v_now + interval '7 day'
    WHERE "id" = v_milestone_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3) CREATE/REFRESH ONE MEDIATION DISPUTE
  -- ---------------------------------------------------------------------------
  SELECT "id"
  INTO v_dispute_id
  FROM "disputes"
  WHERE "projectId" = v_project_id
    AND "milestoneId" = v_milestone_id
    AND "raisedById" = v_client_id
    AND "defendantId" = v_freelancer_id
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF v_dispute_id IS NULL THEN
    v_dispute_id := gen_random_uuid();
    INSERT INTO "disputes" (
      "id", "projectId", "milestoneId",
      "raisedById", "raiserRole",
      "defendantId", "defendantRole",
      "disputeType", "category", "priority",
      "reason", "status", "result", "phase",
      "groupId",
      "assignedStaffId", "assignedAt",
      "previewCompletedById", "previewCompletedAt",
      "createdAt", "updatedAt"
    ) VALUES (
      v_dispute_id, v_project_id, v_milestone_id,
      v_client_id, 'CLIENT',
      v_freelancer_id, 'FREELANCER',
      'CLIENT_VS_FREELANCER', 'PAYMENT', 'HIGH',
      'Demo dispute for hearing scheduling rehearsal.',
      'IN_MEDIATION', 'PENDING', 'PRESENTATION',
      v_dispute_id,
      v_staff_id, v_now - interval '2 hours',
      v_staff_id::text, v_now - interval '2 hours',
      v_now, v_now
    );
  ELSE
    UPDATE "disputes"
    SET
      "status" = 'IN_MEDIATION',
      "result" = 'PENDING',
      "phase" = 'PRESENTATION',
      "assignedStaffId" = v_staff_id,
      "assignedAt" = COALESCE("assignedAt", v_now - interval '2 hours'),
      "previewCompletedById" = COALESCE("previewCompletedById", v_staff_id::text),
      "previewCompletedAt" = COALESCE("previewCompletedAt", v_now - interval '2 hours'),
      "updatedAt" = v_now
    WHERE "id" = v_dispute_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 4) PICK 2 FREE TODAY SLOTS (fallback: tomorrow office hours)
  -- ---------------------------------------------------------------------------
  WITH candidates AS (
    SELECT gs AS slot_start, gs + interval '90 minutes' AS slot_end
    FROM generate_series(
      date_trunc('minute', v_now + interval '45 minutes'),
      date_trunc('day', v_now) + interval '23 hours',
      interval '15 minutes'
    ) gs
  ),
  free_slots AS (
    SELECT c.slot_start, c.slot_end
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1
      FROM "calendar_events" ce
      INNER JOIN "event_participants" ep ON ep."eventId" = ce."id"
      WHERE ep."userId" = ANY(ARRAY[v_staff_id, v_client_id, v_freelancer_id, v_broker_id]::uuid[])
        AND ce."status" IN ('SCHEDULED', 'PENDING_CONFIRMATION', 'IN_PROGRESS', 'RESCHEDULING')
        AND ce."startTime" < c.slot_end
        AND ce."endTime" > c.slot_start
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "user_availabilities" ua
      WHERE ua."userId" = ANY(ARRAY[v_staff_id, v_client_id, v_freelancer_id, v_broker_id]::uuid[])
        AND ua."type" IN ('BUSY', 'OUT_OF_OFFICE', 'DO_NOT_DISTURB')
        AND COALESCE(ua."isRecurring", false) = false
        AND ua."startTime" < c.slot_end
        AND ua."endTime" > c.slot_start
    )
  )
  SELECT slot_start, slot_end
  INTO v_slot_1_start, v_slot_1_end
  FROM free_slots
  ORDER BY slot_start
  LIMIT 1;

  IF v_slot_1_start IS NULL THEN
    WITH candidates AS (
      SELECT gs AS slot_start, gs + interval '90 minutes' AS slot_end
      FROM generate_series(
        date_trunc('day', v_now + interval '1 day') + interval '9 hours',
        date_trunc('day', v_now + interval '1 day') + interval '20 hours',
        interval '15 minutes'
      ) gs
    ),
    free_slots AS (
      SELECT c.slot_start, c.slot_end
      FROM candidates c
      WHERE NOT EXISTS (
        SELECT 1
        FROM "calendar_events" ce
        INNER JOIN "event_participants" ep ON ep."eventId" = ce."id"
        WHERE ep."userId" = ANY(ARRAY[v_staff_id, v_client_id, v_freelancer_id, v_broker_id]::uuid[])
          AND ce."status" IN ('SCHEDULED', 'PENDING_CONFIRMATION', 'IN_PROGRESS', 'RESCHEDULING')
          AND ce."startTime" < c.slot_end
          AND ce."endTime" > c.slot_start
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "user_availabilities" ua
        WHERE ua."userId" = ANY(ARRAY[v_staff_id, v_client_id, v_freelancer_id, v_broker_id]::uuid[])
          AND ua."type" IN ('BUSY', 'OUT_OF_OFFICE', 'DO_NOT_DISTURB')
          AND COALESCE(ua."isRecurring", false) = false
          AND ua."startTime" < c.slot_end
          AND ua."endTime" > c.slot_start
      )
    )
    SELECT slot_start, slot_end
    INTO v_slot_1_start, v_slot_1_end
    FROM free_slots
    ORDER BY slot_start
    LIMIT 1;
  END IF;

  IF v_slot_1_start IS NULL THEN
    RAISE EXCEPTION 'No conflict-free slot found for demo participants.';
  END IF;

  WITH candidates AS (
    SELECT gs AS slot_start, gs + interval '90 minutes' AS slot_end
    FROM generate_series(
      v_slot_1_end + interval '30 minutes',
      v_slot_1_end + interval '8 hours',
      interval '15 minutes'
    ) gs
  ),
  free_slots AS (
    SELECT c.slot_start, c.slot_end
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1
      FROM "calendar_events" ce
      INNER JOIN "event_participants" ep ON ep."eventId" = ce."id"
      WHERE ep."userId" = ANY(ARRAY[v_staff_id, v_client_id, v_freelancer_id, v_broker_id]::uuid[])
        AND ce."status" IN ('SCHEDULED', 'PENDING_CONFIRMATION', 'IN_PROGRESS', 'RESCHEDULING')
        AND ce."startTime" < c.slot_end
        AND ce."endTime" > c.slot_start
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "user_availabilities" ua
      WHERE ua."userId" = ANY(ARRAY[v_staff_id, v_client_id, v_freelancer_id, v_broker_id]::uuid[])
        AND ua."type" IN ('BUSY', 'OUT_OF_OFFICE', 'DO_NOT_DISTURB')
        AND COALESCE(ua."isRecurring", false) = false
        AND ua."startTime" < c.slot_end
        AND ua."endTime" > c.slot_start
    )
  )
  SELECT slot_start, slot_end
  INTO v_slot_2_start, v_slot_2_end
  FROM free_slots
  ORDER BY slot_start
  LIMIT 1;

  IF v_slot_2_start IS NULL THEN
    v_slot_2_start := v_slot_1_start + interval '2 hours';
    v_slot_2_end := v_slot_2_start + interval '90 minutes';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 5) RESET + INSERT CLEAN PROPOSALS
  -- ---------------------------------------------------------------------------
  DELETE FROM "dispute_schedule_proposals"
  WHERE "disputeId" = v_dispute_id
    AND "userId" = ANY(ARRAY[v_client_id, v_freelancer_id, v_broker_id, v_staff_id]::uuid[]);

  INSERT INTO "dispute_schedule_proposals" (
    "id", "disputeId", "userId",
    "startTime", "endTime", "status",
    "submittedAt", "note", "createdAt", "updatedAt"
  ) VALUES
    (gen_random_uuid(), v_dispute_id, v_client_id, v_slot_1_start, v_slot_1_end, 'SUBMITTED', v_now, v_seed_note || ' CLIENT slot 1', v_now, v_now),
    (gen_random_uuid(), v_dispute_id, v_client_id, v_slot_2_start, v_slot_2_end, 'SUBMITTED', v_now, v_seed_note || ' CLIENT slot 2', v_now, v_now),
    (gen_random_uuid(), v_dispute_id, v_freelancer_id, v_slot_1_start, v_slot_1_end, 'SUBMITTED', v_now, v_seed_note || ' FREELANCER slot 1', v_now, v_now),
    (gen_random_uuid(), v_dispute_id, v_freelancer_id, v_slot_2_start, v_slot_2_end, 'SUBMITTED', v_now, v_seed_note || ' FREELANCER slot 2', v_now, v_now);

  -- Optional helpful proposals for moderator + broker (does not affect gate condition)
  INSERT INTO "dispute_schedule_proposals" (
    "id", "disputeId", "userId",
    "startTime", "endTime", "status",
    "submittedAt", "note", "createdAt", "updatedAt"
  ) VALUES
    (gen_random_uuid(), v_dispute_id, v_staff_id, v_slot_1_start, v_slot_1_end, 'SUBMITTED', v_now, v_seed_note || ' STAFF slot 1', v_now, v_now),
    (gen_random_uuid(), v_dispute_id, v_broker_id, v_slot_1_start, v_slot_1_end, 'SUBMITTED', v_now, v_seed_note || ' BROKER slot 1', v_now, v_now);

  -- ---------------------------------------------------------------------------
  -- 6) MARK PREFERRED AVAILABILITY WINDOWS FOR ALL 4 USERS
  -- ---------------------------------------------------------------------------
  DELETE FROM "user_availabilities"
  WHERE "note" LIKE (v_seed_note || '%');

  INSERT INTO "user_availabilities" (
    "id", "userId", "startTime", "endTime",
    "type", "isRecurring", "isAutoGenerated", "note",
    "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    u.user_id,
    s.slot_start,
    s.slot_end,
    'PREFERRED',
    false,
    false,
    v_seed_note || ' preferred window',
    v_now,
    v_now
  FROM (
    VALUES (v_staff_id), (v_client_id), (v_freelancer_id), (v_broker_id)
  ) AS u(user_id)
  CROSS JOIN (
    VALUES (v_slot_1_start, v_slot_1_end), (v_slot_2_start, v_slot_2_end)
  ) AS s(slot_start, slot_end);

  -- ---------------------------------------------------------------------------
  -- 7) CREATE/REFRESH HEARING ROOM + CALENDAR EVENT (FOR IMMEDIATE DEMO)
  -- ---------------------------------------------------------------------------
  SELECT "id"
  INTO v_hearing_id
  FROM "dispute_hearings"
  WHERE "disputeId" = v_dispute_id
    AND COALESCE("agenda", '') = v_hearing_agenda
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF v_hearing_id IS NULL THEN
    v_hearing_id := gen_random_uuid();
    INSERT INTO "dispute_hearings" (
      "id", "disputeId", "status", "scheduledAt",
      "agenda", "requiredDocuments", "moderatorId",
      "externalMeetingLink", "currentSpeakerRole", "tier",
      "isChatRoomActive", "estimatedDurationMinutes",
      "rescheduleCount", "hearingNumber", "createdAt", "updatedAt"
    ) VALUES (
      v_hearing_id, v_dispute_id, 'SCHEDULED', (v_slot_1_start AT TIME ZONE 'UTC'),
      v_hearing_agenda, '["Identity check","Main evidence summary","Cross check timeline"]'::jsonb, v_staff_id,
      'https://meet.google.com/demo-hearing-room',
      'MUTED_ALL', 'TIER_1',
      false, 90,
      0, 1, v_now, v_now
    );
  ELSE
    UPDATE "dispute_hearings"
    SET
      "status" = 'SCHEDULED',
      "scheduledAt" = (v_slot_1_start AT TIME ZONE 'UTC'),
      "agenda" = v_hearing_agenda,
      "requiredDocuments" = '["Identity check","Main evidence summary","Cross check timeline"]'::jsonb,
      "moderatorId" = v_staff_id,
      "externalMeetingLink" = 'https://meet.google.com/demo-hearing-room',
      "currentSpeakerRole" = 'MUTED_ALL',
      "tier" = 'TIER_1',
      "isChatRoomActive" = false,
      "estimatedDurationMinutes" = 90,
      "updatedAt" = v_now
    WHERE "id" = v_hearing_id;
  END IF;

  DELETE FROM "hearing_participants" WHERE "hearingId" = v_hearing_id;

  INSERT INTO "hearing_participants" (
    "id", "hearingId", "userId", "role",
    "invitedAt", "confirmedAt", "isRequired", "responseDeadline", "createdAt"
  ) VALUES (
    gen_random_uuid(), v_hearing_id, v_staff_id, 'MODERATOR',
    v_now, v_now, true, (v_slot_1_start - interval '10 minutes')::timestamp, v_now
  )
  RETURNING "id" INTO v_hp_moderator_id;

  INSERT INTO "hearing_participants" (
    "id", "hearingId", "userId", "role",
    "invitedAt", "confirmedAt", "isRequired", "responseDeadline", "createdAt"
  ) VALUES (
    gen_random_uuid(), v_hearing_id, v_client_id, 'RAISER',
    v_now, v_now, true, (v_slot_1_start - interval '10 minutes')::timestamp, v_now
  )
  RETURNING "id" INTO v_hp_raiser_id;

  INSERT INTO "hearing_participants" (
    "id", "hearingId", "userId", "role",
    "invitedAt", "confirmedAt", "isRequired", "responseDeadline", "createdAt"
  ) VALUES (
    gen_random_uuid(), v_hearing_id, v_freelancer_id, 'DEFENDANT',
    v_now, v_now, true, (v_slot_1_start - interval '10 minutes')::timestamp, v_now
  )
  RETURNING "id" INTO v_hp_defendant_id;

  INSERT INTO "hearing_participants" (
    "id", "hearingId", "userId", "role",
    "invitedAt", "confirmedAt", "isRequired", "responseDeadline", "createdAt"
  ) VALUES (
    gen_random_uuid(), v_hearing_id, v_broker_id, 'WITNESS',
    v_now, v_now, false, (v_slot_1_start - interval '10 minutes')::timestamp, v_now
  )
  RETURNING "id" INTO v_hp_witness_id;

  SELECT "id"
  INTO v_event_id
  FROM "calendar_events"
  WHERE "referenceType" = 'DisputeHearing'
    AND "referenceId" = v_hearing_id::text
  ORDER BY "createdAt" DESC
  LIMIT 1;

  IF v_event_id IS NULL THEN
    v_event_id := gen_random_uuid();
    INSERT INTO "calendar_events" (
      "id", "type", "title", "description", "priority", "status",
      "startTime", "endTime", "durationMinutes", "organizerId",
      "referenceType", "referenceId", "isAutoScheduled",
      "location", "externalMeetingLink", "reminderMinutes", "notes", "metadata",
      "createdAt", "updatedAt"
    ) VALUES (
      v_event_id, 'DISPUTE_HEARING', 'Demo Hearing (Seeded)',
      'Seeded hearing event for calendar + room access demo.',
      'HIGH', 'SCHEDULED',
      v_slot_1_start, v_slot_1_end, 90, v_staff_id,
      'DisputeHearing', v_hearing_id::text, true,
      'Online', 'https://meet.google.com/demo-hearing-room',
      '[60, 10]'::jsonb, v_seed_note || ' calendar event', jsonb_build_object('seedKey', v_seed_note, 'hearingId', v_hearing_id::text),
      v_now, v_now
    );
  ELSE
    UPDATE "calendar_events"
    SET
      "type" = 'DISPUTE_HEARING',
      "title" = 'Demo Hearing (Seeded)',
      "description" = 'Seeded hearing event for calendar + room access demo.',
      "priority" = 'HIGH',
      "status" = 'SCHEDULED',
      "startTime" = v_slot_1_start,
      "endTime" = v_slot_1_end,
      "durationMinutes" = 90,
      "organizerId" = v_staff_id,
      "referenceType" = 'DisputeHearing',
      "referenceId" = v_hearing_id::text,
      "isAutoScheduled" = true,
      "location" = 'Online',
      "externalMeetingLink" = 'https://meet.google.com/demo-hearing-room',
      "reminderMinutes" = '[60, 10]'::jsonb,
      "notes" = v_seed_note || ' calendar event',
      "metadata" = jsonb_build_object('seedKey', v_seed_note, 'hearingId', v_hearing_id::text),
      "updatedAt" = v_now
    WHERE "id" = v_event_id;
  END IF;

  DELETE FROM "event_participants" WHERE "eventId" = v_event_id;

  INSERT INTO "event_participants" (
    "id", "eventId", "userId", "role", "status",
    "responseDeadline", "respondedAt", "responseNote",
    "attendanceStatus", "createdAt"
  ) VALUES
    (gen_random_uuid(), v_event_id, v_staff_id, 'MODERATOR', 'ACCEPTED', (v_slot_1_start - interval '10 minutes')::timestamp, v_now, 'Seeded as moderator', 'NOT_STARTED', v_now),
    (gen_random_uuid(), v_event_id, v_client_id, 'REQUIRED', 'ACCEPTED', (v_slot_1_start - interval '10 minutes')::timestamp, v_now, 'Seeded accepted', 'NOT_STARTED', v_now),
    (gen_random_uuid(), v_event_id, v_freelancer_id, 'REQUIRED', 'ACCEPTED', (v_slot_1_start - interval '10 minutes')::timestamp, v_now, 'Seeded accepted', 'NOT_STARTED', v_now),
    (gen_random_uuid(), v_event_id, v_broker_id, 'OPTIONAL', 'ACCEPTED', (v_slot_1_start - interval '10 minutes')::timestamp, v_now, 'Seeded optional witness', 'NOT_STARTED', v_now);

  DELETE FROM "dispute_evidences"
  WHERE "disputeId" = v_dispute_id
    AND COALESCE("description", '') LIKE (v_seed_note || '%');

  INSERT INTO "dispute_evidences" (
    "id", "disputeId", "uploaderId", "uploaderRole",
    "storagePath", "fileName", "fileSize", "mimeType",
    "description", "fileHash", "uploadedAt"
  ) VALUES (
    gen_random_uuid(), v_dispute_id, v_client_id, 'CLIENT',
    'disputes/' || v_dispute_id::text || '/demo-client-invoice.pdf',
    'demo-client-invoice.pdf', 248000, 'application/pdf',
    v_seed_note || ' client invoice and payment receipt',
    md5(v_seed_note || '_client_invoice'),
    v_now - interval '20 minutes'
  )
  RETURNING "id" INTO v_evidence_client_id;

  INSERT INTO "dispute_evidences" (
    "id", "disputeId", "uploaderId", "uploaderRole",
    "storagePath", "fileName", "fileSize", "mimeType",
    "description", "fileHash", "uploadedAt"
  ) VALUES (
    gen_random_uuid(), v_dispute_id, v_freelancer_id, 'FREELANCER',
    'disputes/' || v_dispute_id::text || '/demo-freelancer-delivery.zip',
    'demo-freelancer-delivery.zip', 1024000, 'application/zip',
    v_seed_note || ' freelancer delivery archive',
    md5(v_seed_note || '_freelancer_delivery'),
    v_now - interval '18 minutes'
  )
  RETURNING "id" INTO v_evidence_freelancer_id;

  -- Seed small but useful hearing-room dataset (messages, statements, question)
  DELETE FROM "dispute_messages"
  WHERE "disputeId" = v_dispute_id
    AND "hearingId" = v_hearing_id
    AND COALESCE(("metadata"->>'seedKey'), '') = v_seed_note;

  INSERT INTO "dispute_messages" (
    "id", "disputeId", "senderId", "senderRole", "type", "content",
    "relatedEvidenceId", "hearingId", "metadata", "createdAt"
  ) VALUES
    (gen_random_uuid(), v_dispute_id, NULL, 'SYSTEM', 'SYSTEM_LOG', 'Demo hearing seed initialized.', NULL, v_hearing_id, jsonb_build_object('seedKey', v_seed_note, 'action', 'HEARING_SEED_READY'), v_now - interval '12 minutes'),
    (gen_random_uuid(), v_dispute_id, v_client_id, 'CLIENT', 'EVIDENCE_LINK', 'Client attached payment invoice evidence.', v_evidence_client_id, v_hearing_id, jsonb_build_object('seedKey', v_seed_note), v_now - interval '8 minutes'),
    (gen_random_uuid(), v_dispute_id, v_freelancer_id, 'FREELANCER', 'EVIDENCE_LINK', 'Freelancer attached delivery package evidence.', v_evidence_freelancer_id, v_hearing_id, jsonb_build_object('seedKey', v_seed_note), v_now - interval '7 minutes'),
    (gen_random_uuid(), v_dispute_id, v_freelancer_id, 'FREELANCER', 'TEXT', 'I will clarify delivery scope and revision history in hearing.', NULL, v_hearing_id, jsonb_build_object('seedKey', v_seed_note), v_now - interval '6 minutes');

  DELETE FROM "hearing_statements"
  WHERE "hearingId" = v_hearing_id
    AND COALESCE("title", '') LIKE 'DEMO %';

  INSERT INTO "hearing_statements" (
    "id", "hearingId", "participantId", "type", "title", "content", "status", "attachments", "orderIndex", "createdAt"
  ) VALUES
    (gen_random_uuid(), v_hearing_id, v_hp_raiser_id, 'OPENING', 'DEMO Raiser Opening', 'Client opening statement for seeded hearing room.', 'SUBMITTED', '[]'::jsonb, 1, v_now - interval '11 minutes'),
    (gen_random_uuid(), v_hearing_id, v_hp_defendant_id, 'REBUTTAL', 'DEMO Defendant Rebuttal', 'Freelancer rebuttal statement for seeded hearing room.', 'SUBMITTED', '[]'::jsonb, 2, v_now - interval '9 minutes');

  DELETE FROM "hearing_questions"
  WHERE "hearingId" = v_hearing_id
    AND "question" LIKE 'DEMO %';

  INSERT INTO "hearing_questions" (
    "id", "hearingId", "askedById", "targetUserId", "question", "status", "deadline", "isRequired", "orderIndex", "createdAt"
  ) VALUES (
    gen_random_uuid(), v_hearing_id, v_staff_id, v_freelancer_id,
    'DEMO question: confirm final delivery timestamp and commit hash.',
    'PENDING_ANSWER', (v_slot_1_start + interval '30 minutes')::timestamp, true, 1, v_now - interval '7 minutes'
  );

  -- ---------------------------------------------------------------------------
  -- 8) RESULT
  -- ---------------------------------------------------------------------------
  RAISE NOTICE '================================================';
  RAISE NOTICE 'HEARING DEMO SMOOTH SEED COMPLETED';
  RAISE NOTICE 'Staff:      %', 'staff.test.new@example.com';
  RAISE NOTICE 'Client:     %', 'client.test.new@example.com';
  RAISE NOTICE 'Freelancer: %', 'freelancer.test.new@example.com';
  RAISE NOTICE 'Broker:     %', 'broker.test.new@example.com';
  RAISE NOTICE 'Dispute ID: %', v_dispute_id;
  RAISE NOTICE 'Hearing ID: %', v_hearing_id;
  RAISE NOTICE 'Event ID:   %', v_event_id;
  RAISE NOTICE 'Slot #1:    % -> %', v_slot_1_start, v_slot_1_end;
  RAISE NOTICE 'Slot #2:    % -> %', v_slot_2_start, v_slot_2_end;
  RAISE NOTICE '================================================';
END $$;
