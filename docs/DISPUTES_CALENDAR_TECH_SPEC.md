# Disputes and Calendar - Technical Specification (backend and frontend integration)

This document describes the Disputes and Calendar modules in the server, their business rules, API inputs/DTOs, and frontend integration requirements for the client app. It also includes full English prompts for Figma Make with phased implementation guidance.

## 1) Scope and goals
- Standardize the dispute lifecycle: create dispute, evidence, chat, settlement, hearing, verdict, appeal.
- Provide calendar features for all roles: create/list events, respond to invites, reschedule, availability, auto-schedule.
- Ensure the frontend connects via HTTPS or ngrok and respects existing client layouts.

## 2) Roles
- CLIENT, CLIENT_SME
- FREELANCER
- BROKER
- STAFF
- ADMIN

Access is role-based and endpoint-specific.

---

# A. DISPUTES MODULE

## A1) Core entities and enums

### Dispute
- Table: disputes
- DisputeStatus: OPEN, IN_MEDIATION, RESOLVED, REJECTED, APPEALED
- DisputeResult: PENDING, WIN_CLIENT, WIN_FREELANCER, SPLIT
- DisputeCategory: QUALITY, DEADLINE, PAYMENT, COMMUNICATION, SCOPE_CHANGE, FRAUD, CONTRACT, OTHER
- DisputePriority: LOW, MEDIUM, HIGH, CRITICAL
- DisputeType: CLIENT_VS_FREELANCER, CLIENT_VS_BROKER, FREELANCER_VS_CLIENT, FREELANCER_VS_BROKER, BROKER_VS_CLIENT, BROKER_VS_FREELANCER

### Dispute Message (chat)
- Table: dispute_messages
- MessageType: TEXT, IMAGE, FILE, EVIDENCE_LINK, SYSTEM_LOG, SETTLEMENT_PROPOSAL, ADMIN_ANNOUNCEMENT
- WORM compliance: no edit/delete; staff/admin can soft-hide only.

### Evidence
- Table: dispute_evidences
- Stored in Supabase Storage (private bucket) with signed URLs.

### Hearing
- Tables: dispute_hearings, hearing_participants, hearing_statements, hearing_questions
- HearingStatus: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELED, RESCHEDULED
- HearingTier: TIER_1 (Staff), TIER_2 (Admin)
- SpeakerRole: ALL, MODERATOR_ONLY, RAISER_ONLY, DEFENDANT_ONLY, MUTED_ALL

### Verdict
- Table: dispute_verdicts
- FaultType: NON_DELIVERY, QUALITY_MISMATCH, DEADLINE_MISSED, GHOSTING, SCOPE_CHANGE_CONFLICT, PAYMENT_ISSUE, FRAUD, MUTUAL_FAULT, NO_FAULT, OTHER
- Penalties: trust score penalty, ban, warning.

### Settlement
- Table: dispute_settlements
- SettlementStatus: PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED

---

## A2) Business flows

### A2.1 Create dispute
Rules (from DisputesService.create):
- Project must be IN_PROGRESS, COMPLETED, or DISPUTED. Paid projects are rejected.
- Milestone must belong to project, not PAID, and be COMPLETED (or COMPLETED/LOCKED for child disputes).
- Escrow must be FUNDED (or DISPUTED for child disputes).
- Raiser and defendant must be project members (client/broker/freelancer).
- Only one active dispute per milestone (OPEN, IN_MEDIATION, APPEALED).
- Default deadlines:
  - responseDeadline: 7 days
  - resolutionDeadline: 14 days
- Priority calculation:
  - FRAUD -> CRITICAL
  - <100 -> LOW, <1000 -> MEDIUM, <5000 -> HIGH, >=5000 -> CRITICAL
- Status changes:
  - Escrow -> DISPUTED
  - Project -> DISPUTED
  - Milestone -> LOCKED
- Auto-assign staff and initial availability check.

### A2.2 Chat and messages
Rules:
- RESOLVED/REJECTED disputes cannot send messages.
- SYSTEM_LOG and ADMIN_ANNOUNCEMENT are staff/admin only.
- If hearingId is present, the sender must be a hearing participant and hearing must belong to this dispute.
- If a settlement is pending, the responder is locked from chat (use chat-lock-status).
- Rate limit: min 1s between messages, max 10 per minute, block for 60s.
- EVIDENCE_LINK requires relatedEvidenceId.

### A2.3 Evidence
Rules:
- 20 files per user per dispute.
- Max file size 50MB. MIME allowlist enforced.
- Supabase Storage private bucket, signed URLs expire after 1 hour.

### A2.4 Settlement
Rules:
- Only raiser/defendant can create offers.
- Max 3 offers per user.
- Cannot create if a PENDING offer exists.
- amountToFreelancer + amountToClient must equal escrow funded amount.
- Platform fee: 5 percent on freelancer portion; client fee is 0.
- expiryHours default 48 (min 24, max 72).
- Reject reason must be at least 50 chars.
- Chat lock: responder cannot chat while a pending settlement exists.
- Non-compliance (ignored offers) is tracked for staff review.

### A2.5 Hearing
Rules:
- Minimum notice: 24 hours. Emergency hearing: at least 1 hour and admin approval.
- Response deadline: up to 7 days, at least 2 hours before start.
- Reschedule limit: 3.
- Required participants: raiser, defendant, moderator; broker as witness if present.
- Moderator controls speaker role. If moderator offline, auto-mute is enforced.

### A2.6 Verdict and appeal
Rules:
- Verdict requires faultType, faultyParty, and structured reasoning.
- Appeal reason min length 200 chars, appeal fee 10 USD, appeal window 3 days.
- Tier 1 verdict by Staff, Tier 2 appeal verdict by Admin.
- Money transfers queued pending appeal window.

---

## A3) REST API - Disputes

### A3.1 Core disputes
- POST /disputes (JWT)
- GET /disputes
- GET /disputes/my (JWT)
- GET /disputes/stats (JWT, ADMIN/STAFF)
- GET /disputes/:id
- POST /disputes/messages/:id (JWT, legacy update)

### A3.2 Messages
- POST /disputes/:disputeId/messages (JWT)
- PATCH /disputes/messages/:messageId/hide (JWT, ADMIN/STAFF)

### A3.3 Activities and notes
- GET /disputes/:id/activities (JWT)
- GET /disputes/:id/notes (JWT)
- POST /disputes/:id/notes (JWT, ADMIN/STAFF)
- DELETE /disputes/:id/notes/:noteId (JWT)

### A3.4 Defendant response and appeal
- POST /disputes/:id/respond (JWT)
- POST /disputes/:id/appeal (JWT)
- PATCH /disputes/:id/appeal/resolve (JWT, ADMIN/STAFF)

### A3.5 Admin actions
- PATCH /disputes/:id/admin-update (JWT, ADMIN/STAFF)
- POST /disputes/:id/resolve (JWT, ADMIN/STAFF)
- PATCH /disputes/:id/escalate (JWT, ADMIN/STAFF)
- PATCH /disputes/:id/reject (JWT, ADMIN/STAFF)

---

## A3.6 DTO and input details (Disputes)

### Dispute core DTOs
- CreateDisputeDto
  - projectId (uuid, required)
  - milestoneId (uuid, required)
  - parentDisputeId (uuid, optional)
  - defendantId (uuid, required)
  - reason (string, required)
  - evidence (string[], required, URLs)
  - category (DisputeCategory, optional)
  - disputedAmount (number >= 0, optional)
- UpdateDisputeDto (legacy)
  - message (string, required)
  - evidence (string[], required)
- DisputeFilterDto (query)
  - page (>=1), limit (1..100)
  - sortBy (createdAt|updatedAt|priority|resolutionDeadline|urgency|disputedAmount)
  - sortOrder (ASC|DESC)
  - status, category, priority, disputeType, projectId, raisedById, defendantId
  - createdFrom, createdTo, deadlineBefore (ISO)
  - overdueOnly, urgentOnly, appealed, search
  - for /disputes/my: asRaiser, asDefendant, asInvolved

### Message DTOs
- SendDisputeMessageDto
  - disputeId (uuid, required)
  - type (MessageType, required)
  - content (string, required if type=TEXT)
  - replyToMessageId (uuid, optional)
  - relatedEvidenceId (uuid, optional; required if type=EVIDENCE_LINK)
  - hearingId (uuid, optional)
  - metadata (object, optional)
- HideMessageDto
  - messageId (uuid, required)
  - hiddenReason (string, required)

### Notes and response
- AddNoteDto
  - content (string, required)
  - isInternal (boolean, optional, default false)
  - isPinned (boolean, optional, default false)
  - noteType (GENERAL|EVIDENCE_REVIEW|DECISION|FOLLOW_UP|WARNING, optional)
  - attachments (string[], optional)
- DefendantResponseDto
  - response (string, required)
  - evidence (string[], optional)

### Appeal and verdict
- AppealDto
  - reason (string, required, server enforces min 200 chars)
  - additionalEvidence (string[], optional)
- ResolveDisputeDto (legacy verdict flow)
  - result or verdict (WIN_CLIENT|WIN_FREELANCER|SPLIT)
  - adminComment (string, required)
  - faultType (FaultType, required)
  - faultyParty (raiser|defendant|both|none, required)
  - reasoning (object, required)
    - violatedPolicies (string[], required, min 1)
    - supportingEvidenceIds (uuid[], optional)
    - factualFindings (string, required)
    - legalAnalysis (string, required)
    - conclusion (string, required)
  - amountToFreelancer, amountToClient (number >= 0, optional)
  - trustScorePenalty (0..100, optional)
  - banUser (boolean, optional)
  - banDurationDays (number >= 0, optional)
  - warningMessage (string, optional)
  - splitRatioClient (0..100, optional)
- AdminUpdateDisputeDto
  - category (DisputeCategory, optional)
  - priority (DisputePriority, optional)
  - disputedAmount (number >= 0, optional)
  - extendResponseDeadlineDays (1..30, optional)
  - extendResolutionDeadlineDays (1..60, optional)

### Settlement DTOs
- CreateSettlementOfferDto
  - amountToFreelancer (number >= 0, required)
  - amountToClient (number >= 0, required)
  - terms (string, optional)
  - expiryHours (24..72, optional)
  - excludeWeekends (boolean, optional)
- RespondToSettlementDto
  - accept (boolean, required)
  - rejectedReason (string, required if accept=false, min 50 chars, max 1000)
- CreateStaffSuggestionDto
  - suggestedAmountToFreelancer (number >= 0, required)
  - suggestedAmountToClient (number >= 0, required)
  - reasoning (string, required, max 2000)
  - similarCaseReferences (string, optional, max 500)

### Evidence upload (multipart)
- POST /disputes/:disputeId/evidence
  - file (binary, required)
  - description (string, optional)
  - max 50MB, MIME allowlist enforced

### Hearing DTOs
- ScheduleHearingDto
  - disputeId (uuid, required)
  - scheduledAt (ISO, required)
  - estimatedDurationMinutes (15..240, optional)
  - agenda (string, optional)
  - requiredDocuments (string[], optional)
  - tier (TIER_1|TIER_2, optional)
  - externalMeetingLink (string, optional)
  - isEmergency (boolean, optional)
- ModerateHearingDto
  - hearingId (uuid, required)
  - speakerRole (SpeakerRole, required)
- SubmitHearingStatementDto
  - hearingId (uuid, required)
  - type (OPENING|EVIDENCE|REBUTTAL|CLOSING|QUESTION|ANSWER, required)
  - title (string, optional)
  - content (string, optional)
  - attachments (string[], optional)
  - replyToStatementId, retractionOfStatementId, draftId (uuid, optional)
  - isDraft (boolean, optional)
- AskHearingQuestionDto
  - hearingId (uuid, required)
  - targetUserId (uuid, required)
  - question (string, required)
  - deadlineMinutes (1..60, optional)
- EndHearingDto
  - hearingId (uuid, required)
  - summary, findings (string, optional)
  - pendingActions (string[], optional)
  - forceEnd (boolean, optional)
- RescheduleHearingDto
  - hearingId (uuid, required)
  - scheduledAt (ISO, required)
  - estimatedDurationMinutes (15..240, optional)
  - agenda, requiredDocuments, externalMeetingLink (optional)
  - isEmergency (boolean, optional)

### Staff assignment DTOs
- EarlyReleaseDto: actualEndTime (ISO, optional), reason (string, optional, min 10)
- EmergencyReassignDto: originalStaffId (uuid), reason (SICK_LEAVE|EMERGENCY|OVERLOAD|CONFLICT|MANUAL), urgency (LOW|MEDIUM|HIGH|CRITICAL), preferredReplacementId (uuid, optional), notes (string, optional)
- ReassignDisputeDto: newStaffId (uuid), reason (string, min 10), notes (optional)
- Fragmented time query: gapStart, gapEnd (ISO)
- Suggestions for reassign query: disputeId (uuid), scheduledTime (ISO optional)

---

## A4) REST API - Evidence
- POST /disputes/:disputeId/evidence (JWT, multipart)
- GET /disputes/:disputeId/evidence (JWT)
- GET /disputes/:disputeId/evidence/quota (JWT)
- GET /disputes/:disputeId/evidence/:evidenceId (JWT)
- POST /disputes/:disputeId/evidence/:evidenceId/flag (JWT, ADMIN/STAFF)

---

## A5) REST API - Settlement
- POST /disputes/:disputeId/settlements (JWT, CLIENT/FREELANCER/BROKER)
- GET /disputes/:disputeId/settlements (JWT)
- GET /disputes/settlements/:settlementId (JWT)
- POST /disputes/settlements/:settlementId/respond (JWT)
- DELETE /disputes/settlements/:settlementId (JWT)
- GET /disputes/:disputeId/settlements/summary (JWT)
- GET /disputes/:disputeId/chat-lock-status (JWT)
- POST /disputes/:disputeId/settlements/suggestion (JWT, STAFF/ADMIN)
- GET /disputes/:disputeId/settlements/non-compliance (JWT, STAFF/ADMIN)

---

## A6) REST API - Hearing
- POST /disputes/hearings/schedule (JWT, STAFF/ADMIN)
- POST /disputes/hearings/:hearingId/start (JWT, STAFF/ADMIN)
- PATCH /disputes/hearings/:hearingId/speaker-control (JWT, STAFF/ADMIN)
- POST /disputes/hearings/:hearingId/statements (JWT, all roles)
- POST /disputes/hearings/:hearingId/questions (JWT, STAFF/ADMIN)
- POST /disputes/hearings/:hearingId/end (JWT, STAFF/ADMIN)
- POST /disputes/hearings/:hearingId/reschedule (JWT, STAFF/ADMIN)

---

## A7) REST API - Staff assignment
- GET /staff/disputes/:disputeId/complexity (JWT, STAFF/ADMIN)
- GET /staff/available (JWT, STAFF/ADMIN)
- POST /staff/disputes/:disputeId/assign (JWT, ADMIN)
- POST /staff/disputes/:disputeId/reassign (JWT, ADMIN)
- GET /staff/sessions/:eventId/timing (JWT, STAFF/ADMIN)
- POST /staff/sessions/:eventId/early-release (JWT, STAFF/ADMIN)
- GET /staff/staff/:staffId/fragmented-time (JWT, STAFF/ADMIN)
- POST /staff/sessions/:eventId/reassign (JWT, ADMIN)
- POST /staff/sessions/:eventId/activity-ping (JWT, STAFF/ADMIN)
- GET /staff/suggestions-for-reassign (JWT, STAFF/ADMIN)

---

## A8) WebSocket (Dispute Gateway)
- Namespace: /ws
- Auth: JWT in handshake.auth.token or Authorization header
- Rooms:
  - joinDispute, leaveDispute -> /ws/disputes/:id
  - joinHearing, leaveHearing -> /ws/hearings/:id
  - joinStaffDashboard, leaveStaffDashboard -> /ws/staff/dashboard

---

# B. CALENDAR MODULE

## B1) Core entities and enums

### CalendarEvent
- EventType: DISPUTE_HEARING, PROJECT_MEETING, INTERNAL_MEETING, PERSONAL_BLOCK, REVIEW_SESSION, TASK_DEADLINE, OTHER
- EventStatus: DRAFT, PENDING_CONFIRMATION, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, RESCHEDULING
- EventPriority: LOW, MEDIUM, HIGH, URGENT

### EventParticipant
- ParticipantRole: ORGANIZER, MODERATOR, REQUIRED, OPTIONAL, OBSERVER
- ParticipantStatus: PENDING, ACCEPTED, DECLINED, TENTATIVE, NO_RESPONSE
- AttendanceStatus: NOT_STARTED, ON_TIME, LATE, VERY_LATE, NO_SHOW, EXCUSED

### Availability
- AvailabilityType: AVAILABLE, BUSY, OUT_OF_OFFICE, PREFERRED, DO_NOT_DISTURB

### RescheduleRequest
- RescheduleRequestStatus: PENDING, APPROVED, REJECTED, AUTO_RESOLVED, WITHDRAWN

---

## B2) REST API - Calendar

### Events
- POST /calendar/events (JWT)
  - If useAutoSchedule=true, startTime/endTime define a date range.
- GET /calendar/events (JWT)
- PATCH /calendar/events/:id (JWT)
- POST /calendar/events/:id/reschedule (JWT)
- POST /calendar/events/:id/respond (JWT)

### Availability
- POST /calendar/availability (JWT)
- GET /calendar/availability/common (JWT)
- GET /calendar/availability/staff (JWT, STAFF/ADMIN)

---

## B2.1 DTO and input details (Calendar)

### CalendarEvent DTOs
- CreateCalendarEventDto
  - type (EventType, required)
  - title (string, required)
  - description (string, optional)
  - priority (EventPriority, optional)
  - startTime, endTime (ISO, required)
  - referenceType (string, optional), referenceId (uuid, optional)
  - location (string, optional), externalMeetingLink (string, optional)
  - participantUserIds (string[], optional)
  - reminderMinutes (number[], optional)
  - notes (string, optional)
  - metadata (object, optional)
  - useAutoSchedule (boolean, optional)
- UpdateCalendarEventDto
  - title, description, priority, startTime, endTime, location, externalMeetingLink, reminderMinutes, notes (optional)
- CalendarEventFilterDto
  - startDate, endDate (ISO)
  - type (EventType)
  - organizerId, participantId (uuid)
  - status (string)
  - page, limit

### Reschedule DTOs
- CreateRescheduleRequestDto
  - eventId (uuid, required)
  - reason (string, required)
  - proposedTimeSlots (array of {start,end} ISO, optional, max 3)
  - useAutoSchedule (boolean, optional)
- RespondEventInviteDto
  - participantId (uuid, required)
  - response (accept|decline|tentative, required)
  - responseNote (string, optional)

### Availability DTOs
- SetAvailabilityDto
  - slots (CreateAvailabilityDto[], optional)
  - recurring (CreateRecurringAvailabilityDto, optional)
  - allowConflicts (boolean, optional)
- CreateAvailabilityDto
  - startTime, endTime (ISO, required)
  - type (AvailabilityType, required)
  - note (string, optional)
- CreateRecurringAvailabilityDto
  - slots (array of {dayOfWeek, startTime, endTime}, required)
  - type (AvailabilityType, required)
  - startDate, endDate (ISO, optional)
  - note (string, optional)

---

## B3) Auto-scheduling and availability rules
- Working hours: 08:00 to 18:00
- Working days: Mon to Fri
- Buffer: 15 minutes, avoid lunch 11:30 to 13:00
- Max 5 events per staff per day
- Step: 15 minutes, max 30 slots

---

# C. HTTPS, ngrok, and frontend configuration

## C1) HTTPS (backend)
The server uses HTTPS if these files exist:
- server/secrets/private-key.pem
- server/secrets/public-certificate.pem

## C2) CORS
CORS is configured in server/src/main.ts.
If you use ngrok, add the ngrok domain to CORS and to the WebSocket gateway origins in server/src/modules/disputes/gateways/dispute.gateway.ts.

## C3) Client config
- Base URL: VITE_API_URL in client/.env
- Fallback: http://localhost:3000

## C4) Evidence storage (Supabase)
Required env:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
Optional:
- VIRUSTOTAL_API_KEY, VIRUSTOTAL_API_URL
- GITHUB_API_TOKEN

---

# D. Frontend mapping (client)
Layouts:
- ClientDashboardLayout
- FreelancerDashboardLayout
- BrokerDashboardLayout
- AdminDashboardLayout

API client:
- client/src/shared/api/client.ts (preferred)
- client/src/lib/axiosClient.ts (legacy)

Requirement: keep the existing layout and theme.

---

# D2. Frontend business requirements and mandatory components

## D2.1 Role-based visibility
- Client/Freelancer/Broker: only their disputes (/disputes/my), can create settlement only if raiser/defendant.
- Staff/Admin: can see all disputes, assign/reassign staff, update priority/category, schedule hearings, issue verdicts.
- Admin: can override appeal verdict, ban users.

## D2.2 Status-based UI gating
- OPEN: chat, evidence upload, settlement, defendant response.
- IN_MEDIATION: settlement continues, staff may schedule hearing.
- RESOLVED: chat locked, show verdict, appeal open within window.
- REJECTED: read-only.
- APPEALED: show appeal status and admin handling.

## D2.3 Mandatory modals/components
- CreateDisputeModal
  - Used in Project Workspace or Milestone card (Raise Dispute).
  - Fields: reason, category, disputedAmount, defendantId, projectId, milestoneId, evidence.
  - Disable if milestone not eligible (status not COMPLETED or active dispute exists).
- DisputeDetailModal or DisputeDetailDrawer
  - Tabs: Timeline, Evidence, Chat, Settlement.
- EvidenceUploadModal
  - Show quota, validate MIME and size.
- SettlementOfferModal
  - Validate total amount equals funded amount, show warning.
- RespondSettlementModal
  - Reject requires min 50 chars.
- HearingScheduleModal (Staff/Admin)
  - scheduledAt, duration, agenda, requiredDocuments, isEmergency.
- VerdictFormModal (Staff/Admin)
  - faultType, faultyParty, reasoning (violatedPolicies >= 1), amounts, penalties.

## D2.4 Quick templates (frontend only)
Server has no template endpoint. Provide client-side presets for:
- Settlement rejection reasons (>=50 chars)
- Appeal reasons (>=200 chars)
- Verdict reasoning snippets (violatedPolicies, factualFindings)

## D2.5 Disputes UI/UX requirements
- Chat composer disabled when chat-lock-status returns isLocked.
- If API returns retryAfterSeconds, show cooldown countdown.
- Regular users cannot see flagged evidence; staff/admin can.
- Show responseDeadline and resolutionDeadline with urgent/overdue badges.
- Show assigned staff info for staff/admin, generic status for regular users.

## D2.6 Calendar UI/UX requirements
- PENDING_CONFIRMATION events must show Respond CTA.
- Reschedule supports max 3 slots or auto-schedule.
- Availability conflicts must show list and a Confirm and reschedule CTA.

---

# E. Figma Make prompt (short)
```
You are coding the frontend inside client/ (Vite + React).
Keep the existing layouts and theme. Use apiClient and VITE_API_URL.
Add Disputes and Calendar UI without changing current shell.
Respect role gating and dispute status gating.
Prefer reusable modals/components to embed in existing pages.
```

---

# F. Detailed Figma Make prompt (full technical context + phased roadmap)

## Master prompt (paste once at the beginning)
```
You are coding the frontend inside client/ (Vite + React).
Keep the existing layouts: ClientDashboardLayout / FreelancerDashboardLayout / BrokerDashboardLayout / AdminDashboardLayout.
Do not change the global theme or the existing sidebar/header.
All API calls must go through apiClient in client/src/shared/api/client.ts.
Base URL comes from import.meta.env.VITE_API_URL.
Backend modules to integrate: Disputes and Calendar.
Disputes flow: create dispute, evidence upload, chat, settlement, hearing, verdict, appeal.
Calendar flow: create event, list events, respond invite, reschedule, availability, auto-schedule.
Roles: CLIENT/CLIENT_SME, FREELANCER, BROKER, STAFF, ADMIN.
UI must be gated by role and by dispute status (OPEN/IN_MEDIATION/RESOLVED/REJECTED/APPEALED).
Evidence: max 20 files per user per dispute, file size max 50MB, MIME allowlist.
Chat: locked when settlement pending (GET /disputes/:id/chat-lock-status), rate limit 10 msg/min.
Settlement: only raiser/defendant can create offer, reject reason >= 50 chars, amountToFreelancer + amountToClient must equal escrow funded amount.
Hearing: 24h notice, emergency >= 1h (admin approval), max 3 reschedules.
Verdict: require faultType, faultyParty, reasoning (violatedPolicies >= 1).
Appeal: min 200 chars, window 3 days.
Do not create new endpoints. Use only existing APIs.
Prefer modal/components embedded in existing pages instead of adding many new pages.
```

## Quick backend context
```
- POST /disputes (CreateDisputeDto)
- GET /disputes, GET /disputes/my, GET /disputes/:id
- POST /disputes/:id/respond (DefendantResponseDto)
- POST /disputes/:id/appeal (AppealDto)
- POST /disputes/:id/messages (SendDisputeMessageDto)
- PATCH /disputes/messages/:messageId/hide (HideMessageDto)
- Evidence: POST/GET /disputes/:id/evidence (+ quota endpoint)
- Settlement: POST /disputes/:id/settlements, POST /disputes/settlements/:id/respond, DELETE /disputes/settlements/:id
- Hearing: POST /disputes/hearings/schedule, /start, /reschedule, /end
- Admin: PATCH /disputes/:id/admin-update, POST /disputes/:id/resolve
- Calendar: POST/GET/PATCH /calendar/events, POST /calendar/events/:id/respond, POST /calendar/events/:id/reschedule
- Availability: POST /calendar/availability, GET /calendar/availability/common, GET /calendar/availability/staff
```

## Phase roadmap (from easy to hard)
Phase 1 - Foundation
```
1) CreateDisputeModal (open from Project Workspace/Milestone card)
   - Fields: reason, category, disputedAmount, defendantId, projectId, milestoneId, evidence[]
   - Validate required fields, disputedAmount >= 0
   - Call POST /disputes
2) EvidenceUploadModal
   - Call GET /disputes/:id/evidence/quota before upload
   - Upload multipart POST /disputes/:id/evidence
   - Refresh evidence list (GET /disputes/:id/evidence)
3) DisputeListPage (by role)
   - GET /disputes/my (client/freelancer/broker)
   - GET /disputes (staff/admin)
   - Filter status/category/priority, sort urgency
```

Phase 2 - Dispute Detail
```
4) DisputeDetailModal/Drawer (tabs: Timeline, Evidence, Chat, Settlement)
   - Timeline: GET /disputes/:id/activities
   - Evidence tab uses EvidenceUploadModal
   - Chat: POST /disputes/:id/messages (disable when chat-lock)
   - Settlement tab: list + create + respond + cancel
5) SettlementOfferModal + RespondSettlementModal
   - Validate sum amount = escrow funded amount (show warning)
   - Reject reason >= 50 chars
```

Phase 3 - Staff/Admin features
```
6) Dispute Triage Dashboard (Admin/Staff)
   - GET /disputes + filters + urgency badge
   - Auto-assign staff (POST /staff/disputes/:id/assign)
   - Manual reassign (POST /staff/disputes/:id/reassign)
7) Staff/Assignment modals
   - StaffReassignModal, show score breakdown (GET /staff/available)
```

Phase 4 - Hearing and Verdict
```
8) HearingScheduleModal
   - POST /disputes/hearings/schedule
   - If isEmergency=true, show warning UI
9) Hearing actions
   - start/end/reschedule
10) VerdictFormModal
   - POST /disputes/:id/resolve
   - reasoning.violatedPolicies must have >= 1 item
```

Phase 5 - Appeal
```
11) Appeal form (only RESOLVED and within appeal window)
   - POST /disputes/:id/appeal, min 200 chars
```

## Component prompts (paste per phase)
CreateDisputeModal (phase 1)
```
Build CreateDisputeModal (React).
- Form fields: reason, category (select), disputedAmount, defendantId, projectId, milestoneId, evidence[] (URLs).
- Validate required fields.
- On submit call POST /disputes.
- Show API error messages.
- Keep existing layout, modal only.
```

EvidenceUploadModal (phase 1)
```
Build EvidenceUploadModal.
- Before upload call GET /disputes/:id/evidence/quota to show remaining/used.
- Upload multipart POST /disputes/:id/evidence (file + description).
- After upload refresh evidence list (GET /disputes/:id/evidence).
- Show warnings if limit 20 files or file > 50MB.
```

DisputeDetailModal (phase 2)
```
Build DisputeDetailModal or Drawer with tabs: Timeline, Evidence, Chat, Settlement.
- Timeline: GET /disputes/:id/activities
- Evidence: use EvidenceUploadModal
- Chat: POST /disputes/:id/messages
- Before chat, call GET /disputes/:id/chat-lock-status; if locked disable composer
- Settlement: list/create/respond/cancel
```

SettlementOfferModal (phase 2)
```
Build SettlementOfferModal.
- amountToFreelancer + amountToClient must equal escrow funded amount (validate in UI).
- Reject reason min 50 chars when responding.
- Use POST /disputes/:id/settlements and POST /disputes/settlements/:id/respond.
```

Dispute Triage Dashboard (phase 3)
```
Build Dispute Triage Dashboard (Admin/Staff).
- GET /disputes, filter + sort urgency
- Show assigned staff + auto-assign (POST /staff/disputes/:id/assign)
- Manual reassign modal (POST /staff/disputes/:id/reassign)
```

HearingScheduleModal (phase 4)
```
Build HearingScheduleModal (Staff/Admin).
- scheduledAt, duration, agenda, requiredDocuments, isEmergency
- POST /disputes/hearings/schedule
- If isEmergency=true, show warning that admin approval is required
```

VerdictFormModal (phase 4)
```
Build VerdictFormModal.
- Fields: faultType, faultyParty, reasoning (violatedPolicies >= 1, factualFindings, legalAnalysis, conclusion), amounts, penalties
- Submit POST /disputes/:id/resolve
```

Appeal Form (phase 5)
```
Build Appeal form (only when dispute is RESOLVED and within appeal window).
- reason min 200 chars
- POST /disputes/:id/appeal
```

## Mandatory UI/UX notes
```
- Evidence list: regular users cannot see flagged items; staff/admin can.
- Chat rate limit: if API returns retryAfterSeconds, show a countdown.
- Urgent/overdue badges based on deadlines.
- Keep existing layout and do not change sidebar/header.
```

---

## Final note
This specification mirrors the current server implementation and the client structure. If you need route/page skeletons generated directly, request it.
