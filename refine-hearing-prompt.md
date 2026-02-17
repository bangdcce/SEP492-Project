# Dispute Hearing Workspace Prompt (English, Flow-Complete)

## What this prompt is for
Use this prompt to implement a production-grade dispute workflow and hearing workspace for InterDev. The workflow must support `CLIENT`, `BROKER`, `FREELANCER`, `STAFF`, and `ADMIN`, including multi-party disputes, transparent moderation, and tamper-evident case records.

---

## Copy-ready Prompt

You are a Senior Full-Stack Architect (NestJS + React + TypeORM + Postgres) working on InterDev. Build a dispute resolution system that is court-style, role-safe, scalable, and operationally efficient.

### 1) Product Goal
Design and implement a complete dispute lifecycle:
1. Dispute intake and anti-spam triage by staff.
2. Preview stage for deep review and evidence gap analysis.
3. Evidence supplementation from raiser/parties when needed.
4. Auto-scheduling of hearing with staff quality and workload constraints.
5. Courtroom-style hearing workspace where staff can moderate, parties can argue, and chat can tag evidence.
6. Escalation path for complex cases (extend time, invite senior staff/admin).
7. Immutable and transparent hearing minutes and case resolution records.

### 2) Hard Constraints (Reuse-first)
1. Reuse existing modules and APIs first.
2. Do not create parallel duplicate hearing systems.
3. Refactor and extend these existing files first:
- `client/src/features/hearings/components/HearingRoom.tsx`
- `client/src/features/disputes/components/hearings/DisputeHearingPanel.tsx`
- `client/src/features/hearings/hooks/useHearingRealtime.ts`
- `client/src/features/hearings/api.ts`
- `server/src/modules/disputes/services/hearing.service.ts`
- `server/src/modules/disputes/controllers/hearing.controller.ts`
- `server/src/modules/disputes/disputes.service.ts`
4. Keep existing behavior compatible. New logic must be additive and migration-safe.

### 3) Target Business Flow
Implement this exact flow:
1. New dispute enters `TRIAGE_PENDING`.
2. Staff reviews if dispute is valid or spam/noise.
- If spam/noise: reject with reason and audit trail.
- If valid: move to `PREVIEW`.
3. In `PREVIEW`, staff reviews full case dossier and can request more evidence from raiser or any party.
4. Once sufficient evidence exists, system runs auto-scheduling for hearing.
5. Before hearing:
- Parties and staff receive invitations and reminders.
- Staff gets a pre-hearing case brief (timeline, evidence summary, unresolved questions).
6. Hearing starts:
- Staff has full courtroom workspace (participants, speaking control, timeline, evidence vault, tagged chat, question queue).
- Parties can submit statements and debate.
- Chat supports evidence tags linked to real evidence records.
7. If case is complex:
- Extend hearing time or reschedule.
- Invite senior staff or admin for assisted adjudication.
8. At close:
- Generate complete minutes.
- Persist immutable timeline and decision log.
- Expose transparent case history for authorized roles.

### 4) Role and Permission Matrix
Enforce role-safe behavior:
1. `ADMIN`
- Can schedule hearings.
- Can override moderation and escalation.
- Can join any hearing and review immutable records.
2. `STAFF`
- Can triage, preview, request evidence, moderate hearings, and end hearings if assigned moderator.
- Can escalate complex cases to senior review.
3. `CLIENT`, `BROKER`, `FREELANCER`
- Can view only disputes they belong to.
- Can submit statements/evidence according to hearing rules.
- Can join invited hearing rooms.
4. Multi-party disputes
- Support more than one claimant/respondent side.
- Permission checks must be party-aware, not only single raiser/defendant assumptions.

### 5) Required Backend Enhancements
Implement backend logic with NestJS best practices:
1. Triage subsystem
- Add triage statuses and actions: `accept`, `reject_as_spam`, `request_evidence`.
- Add anti-spam scoring service using:
  - duplicate fingerprinting
  - rapid repeat filing checks
  - evidence minimum quality checks
  - account risk/trust signals
- Staff always has manual override.
2. Preview subsystem
- Build case dossier endpoint returning:
  - project and contract context
  - dispute timeline
  - evidence inventory with gaps
  - participant map
  - prior moderation actions
3. Multi-party data model
- Add dispute party model (party groups and members).
- Ensure hearing participants can map to party groups.
4. Auto-scheduling engine
- Inputs: participant availability, timezone, hearing complexity estimate, staff load, SLA deadlines.
- Output: best slot + fallback slots.
- Include fairness scoring to avoid overloading a subset of staff.
5. Hearing operations
- Keep existing hearing lifecycle rules.
- Add escalation operations:
  - extend hearing duration
  - invite senior staff/admin
  - transfer or co-moderate hearing
6. Immutable records
- Append-only decision and activity log.
- Store hash chain for key hearing actions.
- Persist signed resolution snapshot (summary, findings, evidence references, attendance, participants).
7. Notifications
- Trigger reminders at T-24h, T-1h, T-10m.
- Send role-specific notification content.

### 6) Required Frontend Enhancements
Implement a court-style, productivity-first workspace:
1. Staff Triage Board
- Fast queue filtering for suspected spam, missing evidence, urgency.
- Bulk triage actions with safe confirmations.
2. Preview Workspace
- Full case dossier view before scheduling.
- Evidence sufficiency checklist.
- Structured request-evidence form with deadlines.
3. Hearing Workspace (court-style)
- Left rail: case context, participant roster, attendance status.
- Center: statements timeline + live debate/chat.
- Right rail: evidence vault, speaker controls, question queue, moderation actions.
- Evidence-tag chat:
  - allow syntax like `#EVD-123` and clickable inline evidence cards.
4. Multi-role UX
- Staff/admin see moderation controls.
- Client/broker/freelancer see role-limited hearing panel.
5. Pre-hearing preparation
- Staff gets pre-hearing brief cards:
  - unresolved contradictions
  - missing evidence
  - critical questions to ask

### 7) Realtime and Event Contract
Use socket events consistently and avoid event name drift:
1. Existing events to honor:
- `MESSAGE_SENT`
- `MESSAGE_HIDDEN`
- `SPEAKER_CONTROL_CHANGED`
- `HEARING_ENDED`
- `VERDICT_ISSUED`
- `EVIDENCE_UPLOADED`
2. Add new events only if required, and document both producer and consumer.
3. Ensure idempotent client handlers (duplicate event safe).

### 8) Performance Requirements
Backend and frontend must be optimized for high load:
1. Backend
- Use indexed queries for dispute status, assigned staff, hearing status, and time windows.
- Use pagination and projection queries for large timeline/message sets.
- Move expensive scheduling and notification jobs to background queue.
- Add short-lived caching for read-heavy staff dashboards.
2. Frontend
- Use React Query with selective invalidation.
- Avoid full-page refetch after every mutation.
- Virtualize long lists (messages, timeline, evidence) when size grows.
- Batch initial data loading with `Promise.all` where safe.

### 9) Transparency and Auditability
This is mandatory:
1. Every moderation action must have actor, timestamp, reason, and previous state.
2. Case timeline must be reconstructable end-to-end.
3. Hearing minutes must include:
- participants
- attendance
- statements and questions
- evidence references
- moderation actions
- final decision and rationale
4. Records must be tamper-evident.

### 10) API and Data Contract Expectations
If an endpoint does not exist, define and implement it with DTO validation and role guards.
For each new endpoint provide:
1. Request DTO
2. Response DTO
3. Guard and permission logic
4. Audit event emitted
5. Realtime event emitted if needed

### 11) Engineering Quality Bar
1. Follow NestJS modular architecture and TypeORM transaction safety.
2. No god services. Extract triage, scheduling, and immutable-log services.
3. Add unit tests for core business rules and e2e tests for critical flow.
4. Add migration scripts for schema changes.
5. Document assumptions and fallback behavior.

### 12) Output Format Required from the Implementing AI
When you generate code, output in this order:
1. Implementation plan (short, concrete).
2. Files to modify with reasons.
3. Code changes (diff-style or full file sections).
4. Test cases added.
5. Risk list and rollback strategy.
6. Follow-up improvements.

### 13) Mandatory System Stability Track (401 and session reliability)
This track is mandatory and must be delivered together with dispute/hearing features.

#### 13.1 Root issue to solve
Intermittent `401 Unauthorized` occurs on protected APIs (example: dispute list) even after successful sign-in.  
Your implementation must eliminate this class of failures, not just hide error messages.

#### 13.2 Frontend auth hardening requirements
1. Standardize API transport:
- Use a single primary API client pattern for all feature modules.
- Remove drift between multiple axios clients (shared interceptors, credentials, retry behavior must be consistent).
2. Add robust 401 handling:
- On first 401 from protected endpoints, call `/auth/refresh` once.
- Retry the original request once after successful refresh.
- Prevent refresh storms by using a single-flight refresh lock + queue pending requests.
- If refresh fails, perform clean logout and redirect to login with a clear reason.
3. Add retry safety:
- Never infinite-loop on 401.
- Never retry non-idempotent mutation blindly more than once.
4. Session bootstrap:
- On app startup, call a lightweight authenticated endpoint (for example `/auth/profile` or `/auth/session`) to re-hydrate user session state.
- If no valid session, clear stale local user cache.
5. Storage consistency:
- Do not mix direct `localStorage` access and helper-based storage access unpredictably.
- Normalize to one storage utility strategy for user/session metadata.
- Replace direct reads like `localStorage.getItem(STORAGE_KEYS.USER)` in feature code with shared storage helpers to respect remember-me/session behavior.

#### 13.3 Backend auth/cookie hardening requirements
1. Cookie policy must be environment-aware:
- Configure cookie `secure` and `sameSite` via environment strategy, not hardcoded assumptions.
- Ensure development and production both work with the actual protocol/domain topology.
2. CORS + credentials alignment:
- Validate exact frontend origins and credentialed requests.
- Ensure preflight and credentialed requests are stable across local/dev/prod.
3. Refresh endpoint reliability:
- Return consistent response contract.
- Emit explicit error codes for expired/invalid/revoked sessions.
- Keep refresh-token rotation safe and auditable.
4. Observability:
- Add structured logs for auth failures with correlation ID and endpoint context (without leaking sensitive tokens).

#### 13.4 Reliability test matrix (must pass)
1. Sign in -> open dispute queue -> no 401.
2. Let access token expire -> next protected API auto-refreshes and succeeds without manual re-login.
3. Multiple parallel protected requests during expiry -> only one refresh request is sent, others replay successfully.
4. During active development (hot reload/edit cycles), session remains stable or degrades gracefully with clear re-auth flow.
5. Open two tabs with same account -> session behavior is consistent and predictable.

### 14) Integration Consistency Rules (with existing codebase)
1. Do not break existing dispute dashboard, hearing panel, staff pages, or role-based routing.
2. Preserve existing realtime event names unless a migration plan is provided.
3. Keep DTO shapes backward-compatible or provide explicit migration updates in both frontend and backend.
4. Any new status or phase must be reflected consistently in:
- database entities
- backend DTOs/services/controllers
- frontend types
- UI labels and filters
- tests

---

## Additional Ideas You Should Also Implement

### Backend ideas
1. Dispute quality score at intake to assist staff triage prioritization.
2. Contradiction detector between party statements and submitted evidence metadata.
3. Auto-generated hearing agenda template based on dispute category.
4. Escalation policy engine:
- amount threshold
- complexity threshold
- unresolved question count
- repeated reschedules
5. Settlement proposal checkpoint before final verdict for eligible cases.

### Frontend ideas
1. Timeline scrubber to jump by hearing phase.
2. Evidence graph panel showing which statement references which evidence.
3. Smart composer in chat with quick evidence tagging shortcuts.
4. Heat indicators for high-risk disputes (deadline pressure, missing evidence, no-show risk).
5. Staff workload hint during scheduling override UI.

### Operations ideas
1. SLA dashboard for triage latency, hearing lead time, and resolution time.
2. Alerting when hearing no-show probability is high.
3. Daily summary for managers: backlog, escalations, and staff load distribution.

---

## Acceptance Criteria
The implementation is done only if:
1. The full flow (triage -> preview -> request evidence -> auto-schedule -> hearing -> escalation -> immutable closure) works end-to-end.
2. All project roles (`CLIENT`, `BROKER`, `FREELANCER`, `STAFF`, `ADMIN`) work with correct permission boundaries.
3. Multi-party disputes are supported in both data model and UI.
4. Hearing workspace is usable, fast, and role-aware.
5. Immutable and transparent case records are generated for each resolved dispute.
6. Intermittent authenticated 401 issues are resolved with deterministic refresh/retry behavior and verified by the reliability matrix.
