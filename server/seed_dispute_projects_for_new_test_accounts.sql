-- Seed dispute-ready projects for:
-- client.test.new@example.com
-- freelancer.test.new@example.com
-- broker.test.new@example.com
--
-- This script is idempotent by title.
-- It creates 3 projects with full dispute prerequisites:
-- - project status IN_PROGRESS
-- - milestones in SUBMITTED/IN_PROGRESS with deadline variants
-- - escrows in FUNDED
-- - one contract per project
-- - tasks per milestone for realistic progress/proof testing

DO $$
DECLARE
  v_client_id uuid;
  v_freelancer_id uuid;
  v_broker_id uuid;

  v_now timestamptz := now();
  v_seed_tag text := to_char(v_now, 'YYYYMMDD');

  v_title_a text := 'DISPUTE MCP SEED :: Client vs Freelancer :: ' || v_seed_tag;
  v_title_b text := 'DISPUTE MCP SEED :: Broker vs Freelancer :: ' || v_seed_tag;
  v_title_c text := 'DISPUTE MCP SEED :: Client vs Broker :: ' || v_seed_tag;

  v_project_id uuid;
  v_m1 uuid;
  v_m2 uuid;
BEGIN
  SELECT id INTO v_client_id FROM "users" WHERE "email" = 'client.test.new@example.com' LIMIT 1;
  SELECT id INTO v_freelancer_id FROM "users" WHERE "email" = 'freelancer.test.new@example.com' LIMIT 1;
  SELECT id INTO v_broker_id FROM "users" WHERE "email" = 'broker.test.new@example.com' LIMIT 1;

  IF v_client_id IS NULL OR v_freelancer_id IS NULL OR v_broker_id IS NULL THEN
    RAISE EXCEPTION 'Missing one or more seed users (client/freelancer/broker).';
  END IF;

  -- Project A: Client vs Freelancer (all 3 accounts in project)
  IF NOT EXISTS (SELECT 1 FROM "projects" WHERE "title" = v_title_a) THEN
    v_project_id := gen_random_uuid();
    INSERT INTO "projects" (
      "id", "clientId", "brokerId", "freelancerId", "title", "description",
      "totalBudget", "currency", "pricingModel", "startDate", "endDate",
      "status", "createdAt", "updatedAt"
    )
    VALUES (
      v_project_id, v_client_id, v_broker_id, v_freelancer_id, v_title_a,
      'Seed project for dispute testing. Parties: client, freelancer, broker.',
      4200, 'USD', 'FIXED_PRICE', v_now - interval '10 day', v_now + interval '20 day',
      'IN_PROGRESS', v_now, v_now
    );

    INSERT INTO "contracts" ("id", "projectId", "title", "contractUrl", "termsContent", "status", "createdBy", "createdAt")
    VALUES (
      gen_random_uuid(), v_project_id, 'Dispute Seed Contract A',
      'https://example.com/contracts/dispute-seed-a.pdf',
      'Seed contract for dispute test flow.',
      'SIGNED', v_broker_id, v_now
    );

    v_m1 := gen_random_uuid();
    v_m2 := gen_random_uuid();

    INSERT INTO "milestones" (
      "id", "projectId", "title", "description", "amount", "deliverableType", "retentionAmount",
      "acceptanceCriteria", "startDate", "dueDate", "status", "submittedAt", "sortOrder", "createdAt"
    )
    VALUES
    (
      v_m1, v_project_id, 'A1 - UI prototype delivery',
      'Dispute-ready submitted milestone for client/freelancer path.',
      2400, 'DESIGN_PROTOTYPE', 0,
      '["Provide Figma file","Submit walkthrough notes"]'::jsonb,
      v_now - interval '8 day', v_now + interval '2 day',
      'SUBMITTED', v_now - interval '1 day', 1, v_now
    ),
    (
      v_m2, v_project_id, 'A2 - API integration',
      'Secondary in-progress milestone for broader test coverage.',
      1800, 'API_DOCS', 0,
      '["OpenAPI spec","Postman collection"]'::jsonb,
      v_now - interval '2 day', v_now + interval '14 day',
      'IN_PROGRESS', NULL, 2, v_now
    );

    -- Tasks: submitted-with-proof (A1) + active in-progress work (A2)
    INSERT INTO "tasks" (
      "id", "milestoneId", "projectId", "title", "description", "status",
      "assignedTo", "reporterId", "priority", "storyPoints",
      "startDate", "dueDate", "proof_link", "submission_note", "submitted_at",
      "sortOrder", "createdAt"
    )
    VALUES
    (
      gen_random_uuid(), v_m1, v_project_id, 'A1-T1 Landing page prototype',
      'Primary UI prototype delivered for review.',
      'DONE', v_freelancer_id, v_client_id, 'HIGH', 8,
      v_now - interval '7 day', v_now - interval '2 day',
      'https://example.com/proof/a1-t1-figma',
      'Submitted Figma prototype and walkthrough.',
      v_now - interval '36 hour',
      1, v_now
    ),
    (
      gen_random_uuid(), v_m1, v_project_id, 'A1-T2 Walkthrough recording',
      'Video walkthrough attached for acceptance.',
      'DONE', v_freelancer_id, v_client_id, 'MEDIUM', 3,
      v_now - interval '6 day', v_now - interval '1 day',
      'https://example.com/proof/a1-t2-video',
      'Recorded walkthrough uploaded.',
      v_now - interval '30 hour',
      2, v_now
    ),
    (
      gen_random_uuid(), v_m1, v_project_id, 'A1-T3 Revision clarifications',
      'Awaiting final feedback from client side.',
      'IN_REVIEW', v_freelancer_id, v_broker_id, 'MEDIUM', 2,
      v_now - interval '4 day', v_now + interval '1 day',
      NULL, NULL, NULL,
      3, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'A2-T1 Auth API endpoints',
      'OAuth callback and refresh session endpoints.',
      'IN_PROGRESS', v_freelancer_id, v_broker_id, 'HIGH', 5,
      v_now - interval '2 day', v_now + interval '5 day',
      NULL, NULL, NULL,
      1, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'A2-T2 Integration test suite',
      'Coverage for auth + disputes API contracts.',
      'TODO', v_freelancer_id, v_client_id, 'MEDIUM', 5,
      v_now - interval '1 day', v_now + interval '7 day',
      NULL, NULL, NULL,
      2, v_now
    );

    INSERT INTO "escrows" (
      "id", "projectId", "milestoneId",
      "totalAmount", "fundedAmount", "releasedAmount",
      "developerShare", "brokerShare", "platformFee",
      "developerPercentage", "brokerPercentage", "platformPercentage",
      "currency", "status", "fundedAt", "clientApproved", "createdAt", "updatedAt"
    )
    VALUES
    (
      gen_random_uuid(), v_project_id, v_m1,
      2400, 2400, 0,
      2040, 240, 120,
      85, 10, 5,
      'USD', 'FUNDED', v_now - interval '7 day', false, v_now, v_now
    ),
    (
      gen_random_uuid(), v_project_id, v_m2,
      1800, 1800, 0,
      1530, 180, 90,
      85, 10, 5,
      'USD', 'FUNDED', v_now - interval '2 day', false, v_now, v_now
    );
  END IF;

  -- Project B: Broker vs Freelancer
  IF NOT EXISTS (SELECT 1 FROM "projects" WHERE "title" = v_title_b) THEN
    v_project_id := gen_random_uuid();
    INSERT INTO "projects" (
      "id", "clientId", "brokerId", "freelancerId", "title", "description",
      "totalBudget", "currency", "pricingModel", "startDate", "endDate",
      "status", "createdAt", "updatedAt"
    )
    VALUES (
      v_project_id, v_client_id, v_broker_id, v_freelancer_id, v_title_b,
      'Seed project focused on broker/freelancer dispute path.',
      6200, 'USD', 'FIXED_PRICE', v_now - interval '12 day', v_now + interval '25 day',
      'IN_PROGRESS', v_now, v_now
    );

    INSERT INTO "contracts" ("id", "projectId", "title", "contractUrl", "termsContent", "status", "createdBy", "createdAt")
    VALUES (
      gen_random_uuid(), v_project_id, 'Dispute Seed Contract B',
      'https://example.com/contracts/dispute-seed-b.pdf',
      'Seed contract for broker/freelancer dispute path.',
      'SIGNED', v_broker_id, v_now
    );

    v_m1 := gen_random_uuid();
    v_m2 := gen_random_uuid();

    INSERT INTO "milestones" (
      "id", "projectId", "title", "description", "amount", "deliverableType", "retentionAmount",
      "acceptanceCriteria", "startDate", "dueDate", "status", "submittedAt", "sortOrder", "createdAt"
    )
    VALUES
    (
      v_m1, v_project_id, 'B1 - Core backend module',
      'Overdue in-progress milestone for deadline dispute testing.',
      3500, 'SOURCE_CODE', 0,
      '["Git repository","Setup guide"]'::jsonb,
      v_now - interval '10 day', v_now - interval '2 day',
      'IN_PROGRESS', NULL, 1, v_now
    ),
    (
      v_m2, v_project_id, 'B2 - Ops handover',
      'Submitted milestone with proof for quality/payment dispute tests.',
      2700, 'SYS_OPERATION_DOCS', 0,
      '["Deployment runbook","Rollback procedure"]'::jsonb,
      v_now - interval '1 day', v_now + interval '16 day',
      'SUBMITTED', v_now - interval '8 hour', 2, v_now
    );

    -- Tasks: overdue/no-proof (B1) + submitted-with-proof (B2)
    INSERT INTO "tasks" (
      "id", "milestoneId", "projectId", "title", "description", "status",
      "assignedTo", "reporterId", "priority", "storyPoints",
      "startDate", "dueDate", "proof_link", "submission_note", "submitted_at",
      "sortOrder", "createdAt"
    )
    VALUES
    (
      gen_random_uuid(), v_m1, v_project_id, 'B1-T1 Core API scaffolding',
      'Base module still incomplete past due date.',
      'IN_PROGRESS', v_freelancer_id, v_broker_id, 'HIGH', 8,
      v_now - interval '9 day', v_now - interval '3 day',
      NULL, NULL, NULL,
      1, v_now
    ),
    (
      gen_random_uuid(), v_m1, v_project_id, 'B1-T2 Env hardening checklist',
      'Pending checklist item remained blocked.',
      'TODO', v_freelancer_id, v_broker_id, 'MEDIUM', 3,
      v_now - interval '8 day', v_now - interval '2 day',
      NULL, NULL, NULL,
      2, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'B2-T1 Deployment runbook',
      'Runbook submitted with linked documentation.',
      'DONE', v_freelancer_id, v_broker_id, 'HIGH', 5,
      v_now - interval '1 day', v_now + interval '5 day',
      'https://example.com/proof/b2-t1-runbook',
      'Runbook draft submitted for handover.',
      v_now - interval '7 hour',
      1, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'B2-T2 Rollback drill notes',
      'Rollback simulation evidence attached.',
      'DONE', v_freelancer_id, v_broker_id, 'MEDIUM', 3,
      v_now - interval '20 hour', v_now + interval '6 day',
      'https://example.com/proof/b2-t2-rollback',
      'Rollback test notes uploaded.',
      v_now - interval '6 hour',
      2, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'B2-T3 Monitoring dashboard',
      'Final dashboard widget pending review.',
      'IN_REVIEW', v_freelancer_id, v_client_id, 'MEDIUM', 2,
      v_now - interval '18 hour', v_now + interval '7 day',
      NULL, NULL, NULL,
      3, v_now
    );

    INSERT INTO "escrows" (
      "id", "projectId", "milestoneId",
      "totalAmount", "fundedAmount", "releasedAmount",
      "developerShare", "brokerShare", "platformFee",
      "developerPercentage", "brokerPercentage", "platformPercentage",
      "currency", "status", "fundedAt", "clientApproved", "createdAt", "updatedAt"
    )
    VALUES
    (
      gen_random_uuid(), v_project_id, v_m1,
      3500, 3500, 0,
      2975, 350, 175,
      85, 10, 5,
      'USD', 'FUNDED', v_now - interval '9 day', false, v_now, v_now
    ),
    (
      gen_random_uuid(), v_project_id, v_m2,
      2700, 2700, 0,
      2295, 270, 135,
      85, 10, 5,
      'USD', 'FUNDED', v_now - interval '1 day', false, v_now, v_now
    );
  END IF;

  -- Project C: Client vs Broker
  IF NOT EXISTS (SELECT 1 FROM "projects" WHERE "title" = v_title_c) THEN
    v_project_id := gen_random_uuid();
    INSERT INTO "projects" (
      "id", "clientId", "brokerId", "freelancerId", "title", "description",
      "totalBudget", "currency", "pricingModel", "startDate", "endDate",
      "status", "createdAt", "updatedAt"
    )
    VALUES (
      v_project_id, v_client_id, v_broker_id, v_freelancer_id, v_title_c,
      'Seed project focused on client/broker dispute path.',
      5100, 'USD', 'FIXED_PRICE', v_now - interval '9 day', v_now + interval '22 day',
      'IN_PROGRESS', v_now, v_now
    );

    INSERT INTO "contracts" ("id", "projectId", "title", "contractUrl", "termsContent", "status", "createdBy", "createdAt")
    VALUES (
      gen_random_uuid(), v_project_id, 'Dispute Seed Contract C',
      'https://example.com/contracts/dispute-seed-c.pdf',
      'Seed contract for client/broker dispute path.',
      'SIGNED', v_broker_id, v_now
    );

    v_m1 := gen_random_uuid();
    v_m2 := gen_random_uuid();

    INSERT INTO "milestones" (
      "id", "projectId", "title", "description", "amount", "deliverableType", "retentionAmount",
      "acceptanceCriteria", "startDate", "dueDate", "status", "submittedAt", "sortOrder", "createdAt"
    )
    VALUES
    (
      v_m1, v_project_id, 'C1 - Product scope finalization',
      'Submitted milestone for client vs broker disputes with evidence.',
      2800, 'OTHER', 0,
      '["Scope matrix","Approval checklist"]'::jsonb,
      v_now - interval '7 day', v_now + interval '3 day',
      'SUBMITTED', v_now - interval '6 hour', 1, v_now
    ),
    (
      v_m2, v_project_id, 'C2 - QA and validation',
      'In-progress milestone intentionally near 0% for strict eligibility checks.',
      2300, 'DEPLOYMENT', 0,
      '["Staging link","Test report"]'::jsonb,
      v_now - interval '3 day', v_now + interval '15 day',
      'IN_PROGRESS', NULL, 2, v_now
    );

    -- Tasks: submitted evidence (C1) + near-zero progress in-progress milestone (C2)
    INSERT INTO "tasks" (
      "id", "milestoneId", "projectId", "title", "description", "status",
      "assignedTo", "reporterId", "priority", "storyPoints",
      "startDate", "dueDate", "proof_link", "submission_note", "submitted_at",
      "sortOrder", "createdAt"
    )
    VALUES
    (
      gen_random_uuid(), v_m1, v_project_id, 'C1-T1 Scope matrix baseline',
      'Scope matrix delivered and shared with broker.',
      'DONE', v_broker_id, v_client_id, 'HIGH', 5,
      v_now - interval '6 day', v_now + interval '1 day',
      'https://example.com/proof/c1-t1-scope-matrix',
      'Scope matrix v1 submitted.',
      v_now - interval '5 hour',
      1, v_now
    ),
    (
      gen_random_uuid(), v_m1, v_project_id, 'C1-T2 Approval checklist',
      'Checklist draft submitted for sign-off.',
      'IN_REVIEW', v_broker_id, v_client_id, 'MEDIUM', 2,
      v_now - interval '5 day', v_now + interval '2 day',
      'https://example.com/proof/c1-t2-checklist',
      'Checklist draft attached.',
      v_now - interval '4 hour',
      2, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'C2-T1 Regression plan',
      'Plan created but not executed yet.',
      'TODO', v_freelancer_id, v_broker_id, 'MEDIUM', 3,
      v_now - interval '2 day', v_now + interval '10 day',
      NULL, NULL, NULL,
      1, v_now
    ),
    (
      gen_random_uuid(), v_m2, v_project_id, 'C2-T2 Automation smoke run',
      'Pending setup for smoke run.',
      'TODO', v_freelancer_id, v_broker_id, 'LOW', 2,
      v_now - interval '1 day', v_now + interval '11 day',
      NULL, NULL, NULL,
      2, v_now
    );

    INSERT INTO "escrows" (
      "id", "projectId", "milestoneId",
      "totalAmount", "fundedAmount", "releasedAmount",
      "developerShare", "brokerShare", "platformFee",
      "developerPercentage", "brokerPercentage", "platformPercentage",
      "currency", "status", "fundedAt", "clientApproved", "createdAt", "updatedAt"
    )
    VALUES
    (
      gen_random_uuid(), v_project_id, v_m1,
      2800, 2800, 0,
      2380, 280, 140,
      85, 10, 5,
      'USD', 'FUNDED', v_now - interval '6 day', false, v_now, v_now
    ),
    (
      gen_random_uuid(), v_project_id, v_m2,
      2300, 2300, 0,
      1955, 230, 115,
      85, 10, 5,
      'USD', 'FUNDED', v_now - interval '3 day', false, v_now, v_now
    );
  END IF;
END $$;

-- Repair/backfill pass:
-- Ensure all previous "DISPUTE MCP SEED" projects are still test-ready even if older seeds
-- were interrupted or created without full milestone/task/escrow coverage.
DO $$
DECLARE
  v_now timestamptz := now();
  v_seed record;
  v_milestone record;
  v_existing_milestones int;
  v_task_count int;
  v_fallback_milestone_id uuid;
  v_fallback_amount numeric(15,2);
BEGIN
  FOR v_seed IN
    SELECT
      p."id" AS project_id,
      p."title" AS project_title,
      p."clientId" AS client_id,
      p."brokerId" AS broker_id,
      p."freelancerId" AS freelancer_id
    FROM "projects" p
    WHERE p."title" LIKE 'DISPUTE MCP SEED :: %'
  LOOP
    -- Keep seed projects in dispute-test-friendly state
    IF NOT EXISTS (
      SELECT 1
      FROM "projects" p2
      WHERE p2."id" = v_seed.project_id
        AND p2."status" IN ('IN_PROGRESS', 'DISPUTED', 'COMPLETED')
    ) THEN
      UPDATE "projects"
      SET "status" = 'IN_PROGRESS',
          "updatedAt" = v_now
      WHERE "id" = v_seed.project_id;
    END IF;

    -- Ensure at least one contract exists
    IF NOT EXISTS (SELECT 1 FROM "contracts" c WHERE c."projectId" = v_seed.project_id) THEN
      INSERT INTO "contracts" (
        "id", "projectId", "title", "contractUrl", "termsContent", "status", "createdBy", "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        v_seed.project_id,
        'Dispute Seed Recovery Contract',
        'https://example.com/contracts/dispute-seed-recovery.pdf',
        'Auto-recovered contract for dispute test readiness.',
        'SIGNED',
        COALESCE(v_seed.broker_id, v_seed.client_id, v_seed.freelancer_id),
        v_now
      );
    END IF;

    -- Ensure at least 2 milestones exist
    SELECT COUNT(*) INTO v_existing_milestones
    FROM "milestones" m
    WHERE m."projectId" = v_seed.project_id;

    WHILE v_existing_milestones < 2 LOOP
      v_fallback_milestone_id := gen_random_uuid();
      v_fallback_amount := CASE WHEN v_existing_milestones = 0 THEN 1600 ELSE 1200 END;

      INSERT INTO "milestones" (
        "id", "projectId", "title", "description", "amount", "deliverableType", "retentionAmount",
        "acceptanceCriteria", "startDate", "dueDate", "status", "submittedAt", "sortOrder", "createdAt"
      )
      VALUES (
        v_fallback_milestone_id,
        v_seed.project_id,
        'Recovery milestone ' || (v_existing_milestones + 1)::text,
        'Auto-generated milestone to repair incomplete dispute seed data.',
        v_fallback_amount,
        'OTHER',
        0,
        '["Recovery acceptance checklist","Attach proof or notes"]'::jsonb,
        v_now - interval '2 day',
        v_now + interval '7 day',
        'IN_PROGRESS',
        NULL,
        v_existing_milestones + 1,
        v_now
      );

      INSERT INTO "escrows" (
        "id", "projectId", "milestoneId",
        "totalAmount", "fundedAmount", "releasedAmount",
        "developerShare", "brokerShare", "platformFee",
        "developerPercentage", "brokerPercentage", "platformPercentage",
        "currency", "status", "fundedAt", "clientApproved", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        v_seed.project_id,
        v_fallback_milestone_id,
        v_fallback_amount,
        v_fallback_amount,
        0,
        round(v_fallback_amount * 0.85, 2),
        round(v_fallback_amount * 0.10, 2),
        round(v_fallback_amount * 0.05, 2),
        85, 10, 5,
        'USD',
        'FUNDED',
        v_now - interval '1 day',
        false,
        v_now,
        v_now
      );

      v_existing_milestones := v_existing_milestones + 1;
    END LOOP;

    -- Ensure each milestone has escrow and at least 2 tasks
    FOR v_milestone IN
      SELECT
        m."id" AS milestone_id,
        m."status" AS milestone_status,
        COALESCE(m."amount", 1000)::numeric(15,2) AS milestone_amount,
        COALESCE(m."dueDate", v_now + interval '5 day') AS due_date
      FROM "milestones" m
      WHERE m."projectId" = v_seed.project_id
    LOOP
      IF NOT EXISTS (SELECT 1 FROM "escrows" e WHERE e."milestoneId" = v_milestone.milestone_id) THEN
        INSERT INTO "escrows" (
          "id", "projectId", "milestoneId",
          "totalAmount", "fundedAmount", "releasedAmount",
          "developerShare", "brokerShare", "platformFee",
          "developerPercentage", "brokerPercentage", "platformPercentage",
          "currency", "status", "fundedAt", "clientApproved", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(),
          v_seed.project_id,
          v_milestone.milestone_id,
          v_milestone.milestone_amount,
          v_milestone.milestone_amount,
          0,
          round(v_milestone.milestone_amount * 0.85, 2),
          round(v_milestone.milestone_amount * 0.10, 2),
          round(v_milestone.milestone_amount * 0.05, 2),
          85, 10, 5,
          'USD',
          'FUNDED',
          v_now - interval '1 day',
          false,
          v_now,
          v_now
        );
      END IF;

      SELECT COUNT(*) INTO v_task_count
      FROM "tasks" t
      WHERE t."milestoneId" = v_milestone.milestone_id;

      IF v_task_count = 0 THEN
        IF v_milestone.milestone_status IN ('SUBMITTED', 'COMPLETED', 'PAID') THEN
          INSERT INTO "tasks" (
            "id", "milestoneId", "projectId", "title", "description", "status",
            "assignedTo", "reporterId", "priority", "storyPoints",
            "startDate", "dueDate", "proof_link", "submission_note", "submitted_at",
            "sortOrder", "createdAt"
          )
          VALUES
          (
            gen_random_uuid(),
            v_milestone.milestone_id,
            v_seed.project_id,
            'Recovery proof task #' || left(v_milestone.milestone_id::text, 8),
            'Recovered task with proof for dispute eligibility checks.',
            'DONE',
            v_seed.freelancer_id,
            v_seed.client_id,
            'HIGH',
            5,
            v_now - interval '3 day',
            v_milestone.due_date - interval '1 day',
            'https://example.com/proof/recovery-' || left(v_milestone.milestone_id::text, 8),
            'Auto-generated proof note for seed recovery.',
            v_now - interval '12 hour',
            1,
            v_now
          ),
          (
            gen_random_uuid(),
            v_milestone.milestone_id,
            v_seed.project_id,
            'Recovery review task #' || left(v_milestone.milestone_id::text, 8),
            'Recovered review task.',
            'IN_REVIEW',
            v_seed.freelancer_id,
            COALESCE(v_seed.broker_id, v_seed.client_id),
            'MEDIUM',
            3,
            v_now - interval '2 day',
            v_milestone.due_date,
            NULL,
            NULL,
            NULL,
            2,
            v_now
          );
        ELSE
          INSERT INTO "tasks" (
            "id", "milestoneId", "projectId", "title", "description", "status",
            "assignedTo", "reporterId", "priority", "storyPoints",
            "startDate", "dueDate", "proof_link", "submission_note", "submitted_at",
            "sortOrder", "createdAt"
          )
          VALUES
          (
            gen_random_uuid(),
            v_milestone.milestone_id,
            v_seed.project_id,
            'Recovery progress task #' || left(v_milestone.milestone_id::text, 8),
            'Recovered in-progress task.',
            'IN_PROGRESS',
            v_seed.freelancer_id,
            COALESCE(v_seed.broker_id, v_seed.client_id),
            'HIGH',
            5,
            v_now - interval '2 day',
            v_milestone.due_date,
            NULL,
            NULL,
            NULL,
            1,
            v_now
          ),
          (
            gen_random_uuid(),
            v_milestone.milestone_id,
            v_seed.project_id,
            'Recovery backlog task #' || left(v_milestone.milestone_id::text, 8),
            'Recovered backlog task to ensure milestone task coverage.',
            'TODO',
            v_seed.freelancer_id,
            v_seed.client_id,
            'MEDIUM',
            2,
            v_now - interval '1 day',
            v_milestone.due_date + interval '1 day',
            NULL,
            NULL,
            NULL,
            2,
            v_now
          );
        END IF;
      ELSIF v_task_count = 1 THEN
        INSERT INTO "tasks" (
          "id", "milestoneId", "projectId", "title", "description", "status",
          "assignedTo", "reporterId", "priority", "storyPoints",
          "startDate", "dueDate", "proof_link", "submission_note", "submitted_at",
          "sortOrder", "createdAt"
        )
        VALUES (
          gen_random_uuid(),
          v_milestone.milestone_id,
          v_seed.project_id,
          'Recovery supplemental task #' || left(v_milestone.milestone_id::text, 8),
          'Added second task so milestone is not single-task only.',
          CASE
            WHEN v_milestone.milestone_status IN ('SUBMITTED', 'COMPLETED', 'PAID') THEN 'IN_REVIEW'
            ELSE 'TODO'
          END,
          v_seed.freelancer_id,
          COALESCE(v_seed.broker_id, v_seed.client_id),
          'MEDIUM',
          2,
          v_now - interval '1 day',
          v_milestone.due_date,
          NULL,
          NULL,
          NULL,
          2,
          v_now
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Quick check
SELECT
  p."id" AS "projectId",
  p."title",
  p."status",
  COUNT(DISTINCT m."id")::int AS "milestones",
  COUNT(DISTINCT t."id")::int AS "tasks",
  COUNT(DISTINCT CASE WHEN m."dueDate" < now() THEN m."id" END)::int AS "overdueMilestones",
  COUNT(DISTINCT CASE WHEN t."proof_link" IS NOT NULL THEN t."id" END)::int AS "tasksWithProof",
  COUNT(DISTINCT e."id")::int AS "escrows",
  COUNT(DISTINCT c."id")::int AS "contracts",
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT m."id"), NULL) AS "milestoneIds"
FROM "projects" p
LEFT JOIN "milestones" m ON m."projectId" = p."id"
LEFT JOIN "tasks" t ON t."projectId" = p."id"
LEFT JOIN "escrows" e ON e."projectId" = p."id"
LEFT JOIN "contracts" c ON c."projectId" = p."id"
WHERE p."title" LIKE 'DISPUTE MCP SEED :: %'
GROUP BY p."id", p."title", p."status"
ORDER BY p."createdAt" DESC;
