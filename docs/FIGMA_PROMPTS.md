# PROMPTS FOR FIGMA & MAKE.COM (INTERDEV PROJECT)

> **Use Instructions:** These prompts are strictly engineered based on the `server/src` backend logic of InterDev. Copy the **Master Prompt** first to set the context for the AI, then use the specific Phase prompts to generate UI components that exactly match the API capabilities.

---

## 🚀 MASTER PROMPT (Context Setting)

**Paste this first to set the context for the AI:**

```text
You are a Senior Frontend Architect building the "InterDev" Freelance Brokerage Platform (React + Vite + TypeScript + Tailwind).
Your goal is to implement the **Disputes & Calendar System** strictly following the existing Design System and Backend Logic defined in `server/src`.

**1. Design Components:**
*   **Theme:** Navy Blue (`bg-slate-900`) & Teal (`text-teal-600`) as primary accents.
*   **UI Library:** ShadCN UI / HeadlessUI.
*   **Typography:** Inter/Sans.
*   **Feedback:** Red for Errors/Disputes, Amber for Warnings (e.g., nearing deadline), Green for Success/Resolution.

**2. Backend Constraints (MUST FOLLOW):**
*   **Timezones:** All dates are stored in UTC but displayed in User Local Time.
*   **Roles:** `CLIENT`, `FREELANCER`, `BROKER` (Participants) vs `STAFF`, `ADMIN` (Moderators).
*   **Strict Mode:** Forms must validate *before* API submission to match NestJS DTO validation rules.

**3. Frontend Architecture (Match Existing):**
*   **Feature-Based:** Place code in `client/src/features/disputes` and `client/src/features/calendar`.
*   **Shared Components:** Use `client/src/shared/components` for atoms (Buttons, Inputs).
*   **Routing:** `react-router` configuration in `App.tsx` (Lazy loaded).
*   **State:** Use React Context or Zustand (if already present) for complex flows.

**4. API Pattern:**
*   Base URL: `/api/v1`
*   Authentication: Bearer Token (handled by `apiClient`).
*   Real-time: Socket.IO at `/ws` namespace.
```

---

## 📦 PHASE 1: DISPUTE CREATION & EVIDENCE

**Goal:** Allow users to raise a dispute from a Milestone/Project.

**Prompt for AI:**

```text
Design the **CreateDisputeModal** and **EvidenceUpload** component.

**1. Dispute Form Logic (`CreateDisputeDto`):**
*   **Entry Point:** Provide "Raise Dispute" button on `MilestoneCard` (Only if status is `COMPLETED` or `LOCKED`).
*   **Input Fields:**
    *   `reason` (Textarea, min 20 chars).
    *   `category` (Select): [QUALITY, DEADLINE, PAYMENT, COMMUNICATION, SCOPE_CHANGE, FRAUD, CONTRACT, OTHER].
    *   `disputedAmount` (Number): Defaults to Escrow Funded Amount. Validation: `0 < amount <= escrowTotal`.
    *   `defendantId` (Select): Filter list to only Project Members (excluding yourself).
*   **API:** `POST /disputes`

**2. Evidence Upload Logic (`evidence.service.ts`):**
*   **Strict MIME Types:** `image/*`, `application/pdf`, `text/plain`, `application/json`, `application/zip` (for code), `video/mp4`.
*   **Sanitization:** Display warning: "File names will be sanitized (special chars removed)."
*   **Scanning UI:** When a file is selected, show "Virus Scanning..." badge. (Backend checks VirusTotal).
    *   *Note:* Backend fails open on network error, so UI should just show "Uploaded" if no error returns.
*   **Limit:** Max 20 files. Max 50MB/file.
*   **API:** `POST /disputes/:id/evidence` (Multipart).
```

---

## 💬 PHASE 2: DISPUTE DETAIL DASHBOARD

**Goal:** Central hub for case management.

**Prompt for AI:**

```text
Design the **DisputeDetailLayout** with a **StatusHeader** and **TabNavigation** (Timeline, Evidence, Chat, Settlement).

**1. Status Header & Urgency:**
*   **Badge Logic:**
    *   `OPEN` (Green), `IN_MEDIATION` (Amber), `RESOLVED` (Gray).
    *   **Urgency:** If `resolutionDeadline` < 48h from now, show pulsing RED "Urgent" badge. (Backend uses `URGENT_THRESHOLD_HOURS = 48`).
*   **Actions:**
    *   "Request Staff" (If currently automated/self-resolve).
    *   "Cancel Dispute" (Only for Raiser).

**2. Live Chat (`DisputeGateway`):**
*   **System Layout:** Chat bubbles for User Messages vs Centered Gray Italic text for System Logs (e.g., "User A rejected settlement").
*   **Chat Lock State:**
    *   **Trigger:** If `settlementService.checkChatLockStatus` returns locked (pending settlement response).
    *   **UI:** Disable Input Field. Show banner: "You must Accept or Reject the pending settlement offer to continue chatting."
*   **Rate Limiting:** If user types too fast (>10 msg/min), show "Slow down" error toast.

**3. Evidence Tab:**
*   Grid view of files.
*   **Flagging (Staff Only):** Context menu "Flag as Inappropriate" -> Calls `PATCH /disputes/evidence/:id/flag`.
```

---

## 🤝 PHASE 3: SETTLEMENT NEGOTIATION

**Goal:** Allow parties to agree on money split mathematically.

**Prompt for AI:**

```text
Design the **SettlementOfferModal** and **SettlementCard**.

**1. Offer Creation Logic (`settlement.service.ts`):**
*   **Mathematical Constraint:** `amountToFreelancer` + `amountToClient` **MUST EQUAL** `EscrowFundedAmount`.
    *   *UI Tip:* Use a Slider. Slide left for Client %, right for Freelancer %. Auto-calculate the numbers so they always sum correctly.
*   **Fees:** Show "Platform Fee (5%)" deducted from Freelancer's portion visually.
*   **Expiry:** DatePicker (Default 48h from now).
*   **Attempts:** Show "Attempts Remaining: X/3". (Backend limits to 3 per user).

**2. Responding to Offer:**
*   **Accept:** Confetti UI. Immediate API call `POST /settlements/:id/respond` (accept: true).
*   **Reject:**
    *   **Validation:** Require `rejectedReason` text.
    *   **Constraint:** Minimum **50 CHARACTERS**. (Backend strict check). Show character counter: "50 characters required to reject".
```

---

## 📅 PHASE 4: CALENDAR & HEARINGS

**Goal:** Schedule hearings avoiding conflicts.

**Prompt for AI:**

```text
Design the **HearingScheduler** (Staff View) and **CalendarPage**.

**1. Calendar View (`calendar.service.ts`):**
*   **Grid:** Monthly + Weekly view.
*   **Event Types:** Color code `DISPUTE_HEARING` (Red), `PROJECT_MEETING` (Blue).
*   **Working Hours:** Shade out non-working hours (before 8am, after 6pm) visually based on `DEFAULT_CONSTRAINTS`.

**2. Schedule Hearing Modal:**
*   **Logic:**
    *   Fetch `GET /calendar/availability/common?userIds=...` to find slots.
    *   **Emergency Mode:** Checkbox "Emergency Hearing (<24h notice)".
        *   If checked: Show warning "Requires Admin Approval".
        *   If unchecked: Disable dates < 24h from now.
*   **Participants:**
    *   Auto-load Raiser & Defendant.
    *   **Broker Logic:** If Project has a Broker, display them as "Required Witness" (Backend `determineRequiredParticipants`).

**3. Reschedule Flow:**
*   **Limit:** Allow max 3 reschedules. Show "Reschedules left: X" on the UI.
*   **Input:** Allow user to propose up to 3 alternative time slots.
```

---

## 🛡️ PHASE 5: STAFF DASHBOARD & VERDICTS

**Goal:** Admin tools to triage and judge cases.

**Prompt for AI:**

```text
Design the **StaffDisputeDashboard** and **VerdictModal**.

**1. Dashboard Sorting:**
*   **Default Sort:** "Urgency Score".
*   **Formula:** Priority (Critical/High) + Deadline Proximity.
*   **Visual:** Show "Overdue" rows in Red background.

**2. Verdict Form (`verdict.service.ts`):**
*   **Split Decision:**
    *   Radio: "Win Client", "Win Freelancer", "Split".
    *   If Split: Show number inputs for logic ratios.
*   **Justification:**
    *   `factualFindings` (Rich Text).
    *   `violatedPolicies` (Multi-select dropdown).
*   **Signature:** "Type your full name to sign" (Matches User.fullName).

**3. Staff Assignment:**
*   **Auto-Assign:** Button "Auto Assign".
*   **Logic:** Backend calculates workload (`StaffWorkloadEntity`). UI shows "Recommended Staff: [Name] (Utilization: 45%)".
```

---

## ✅ FINAL CHECKLIST FOR AI GENERATION

- [ ] Did you implement the **Chat Lock** when a settlement is pending? (Critical Anti-Silent-Treatment feature).
- [ ] Did you enforce **50 character limit** on Settlement Rejection?
- [ ] Did you ensure **Client + Freelancer = Escrow Total** in the money slider?
- [ ] Did you add the **Virus Scanning** UI state for uploads?
- [ ] Did you include the **Broker** as a participant in Hearings?
