# Use Case Specification: UC-58 View Dispute Specific Information

## 2.2 <<Feature Name: Dispute Resolution>>

### a. <<Use Case Name 5.8>>

---

## UC ID and Name

**UC-58: View Dispute Specific Information**

---

## Created By

Development Team

---

## Date Created

04/01/2026

---

## Primary Actor

Admin, Staff, Client, Freelancer

---

## Secondary Actors

Broker (view-only for disputes in projects they manage)

---

## Description

This use case allows users to view complete details of a specific dispute, including dispute information, evidence files, activity timeline, related project/milestone data, and resolution history if resolved. Different roles see different levels of information based on their involvement and permissions.

---

## Trigger

1. User clicks on a dispute row from the dispute list (UC-57).
2. User receives a notification about a dispute and clicks "View Details".
3. User navigates directly to dispute URL with dispute ID.

---

## Preconditions

1. User is logged in to the system.
2. User has permission to view the dispute (involved party, Admin, or Staff).
3. Dispute exists in the database with valid ID.

---

## Post-conditions

1. Complete dispute details are displayed on screen.
2. User can see evidence files and activity history.
3. User can take actions based on their role (respond, resolve, appeal).

---

## Normal Flow

1. User clicks on a dispute from the list or notification.
2. System retrieves dispute ID from the URL or click event.
3. System sends request to backend: GET /disputes/:id
4. System validates user has permission to view this dispute:
   - Admin/Staff: Can view all disputes
   - Raiser/Defendant: Can view their own disputes
   - Broker: Can view disputes in projects they manage
5. System loads dispute data with relations:
   - Dispute information (status, category, priority, dates)
   - Raiser and Defendant user profiles
   - Related Project and Milestone information
   - Evidence files (URLs and metadata)
   - Activity timeline (who did what and when)
6. System displays dispute detail page with sections:
   - Header: Dispute ID, Status badge, Priority badge, Created date
   - Overview: Project name, Milestone, Disputed amount, Category
   - Parties: Raiser info, Defendant info, their roles
   - Description: Reason for dispute
   - Evidence: List of uploaded files with download links
   - Messages: Communication between parties (if any)
   - Timeline: Activity history (Created, Updated, Responded, Resolved)
   - Deadlines: Response deadline, Resolution deadline with countdown
7. System shows action buttons based on user role and dispute status:
   - Defendant (if status=OPEN): "Respond to Dispute" button
   - Admin (if status=OPEN or IN_MEDIATION): "Resolve Dispute" button
   - Raiser/Defendant (if status=RESOLVED): "Appeal Decision" button (if within appeal period)

---

## Alternative Flows

**A.1 View as Admin/Staff with internal information**

Branches from step 6 in Normal Flow.

1. Admin or Staff opens dispute detail page.
2. System detects user role is Admin or Staff.
3. System loads additional internal data not visible to regular users.
4. System displays extra sections:
   - Internal Admin Notes field
   - Resolution Decision panel showing verdict, split ratio if applicable, and penalty applied
   - Related Escrow transaction history with amounts and timestamps
5. System shows "Edit Internal Notes" button below admin comments section.
6. System shows "View Full Audit Log" link at bottom of timeline.
7. Rejoin Normal Flow at step 7.

**A.2 Download or preview evidence file**

Branches from step 6 in Normal Flow.

1. User sees list of evidence files in Evidence section with file names and sizes.
2. User clicks on a file name or thumbnail.
3. System checks file type: image (jpg, png), PDF, or other documents.
4. If image or PDF: System opens preview modal with embedded file viewer.
5. If other file type: System generates secure download URL with token and initiates download to user's device.
6. User can close preview modal or wait for download to complete.

**A.3 View activity timeline with detailed history**

Branches from step 6 in Normal Flow.

1. User scrolls down to Timeline section at bottom of page.
2. System displays chronological list of activities in descending order with newest first.
3. Each timeline entry shows:
   - Icon representing action type
   - Actor full name and role badge
   - Action description in plain language
   - Timestamp in relative format (2 hours ago) or absolute date if older than 7 days
4. Timeline includes public activities: Dispute Created, Evidence Added, Message Sent, Defendant Responded, Admin Reviewed, Status Changed to IN_MEDIATION, Resolved, Appealed.
5. If user is Admin or Staff: Internal actions are also shown with lock icon indicator.

**A.4 Dispute is overdue (system alert)**

Branches from step 5 in Normal Flow.

1. System calculates time difference between current timestamp and resolution deadline.
2. System detects deadline has passed and dispute status is OPEN or IN_MEDIATION.
3. System displays prominent red alert banner at top of page: "This dispute is OVERDUE by X hours/days. Immediate resolution required."
4. System highlights resolution deadline field with red border and red text.
5. If user is Admin: System shows additional warning about potential SLA breach and impact on metrics.

**A.5 Dispute is urgent (approaching deadline)**

Branches from step 5 in Normal Flow.

1. System calculates time remaining until resolution deadline.
2. System detects deadline is within 48 hours and dispute status is OPEN or IN_MEDIATION.
3. System displays orange warning banner: "URGENT: This dispute must be resolved within X hours."
4. System shows countdown timer updating every minute in real-time.
5. System highlights resolution deadline field with orange border and amber text color.

**A.6 Navigate to related project or milestone**

Branches from step 6 in Normal Flow.

1. User sees Project Name or Milestone Name displayed as blue underlined hyperlinks.
2. User clicks on Project Name link.
3. System opens project detail page in new browser tab.
4. User can view full project spec, all milestones with status, team members, and current escrow status.
5. User closes tab or uses browser back button to return to dispute detail page.

**A.7 Dispute is already resolved**

Branches from step 6 in Normal Flow.

1. System detects dispute status is RESOLVED.
2. System displays resolution summary panel at top showing:
   - Final verdict (WIN_CLIENT, WIN_FREELANCER, or SPLIT)
   - Resolved by admin name
   - Resolution date and time
   - Admin comment explaining decision
   - Money distribution details
3. System hides action buttons except "Appeal Decision" if user is losing party and within appeal window.
4. System displays read-only view of all evidence and timeline.

---

## Exceptions

- **EX-01:** DisputeNotFoundException - Dispute does not exist or invalid ID
- **EX-02:** ForbiddenException - User lacks permission to view this dispute
- **EX-03:** FileNotFoundException - Evidence file unavailable or URL expired
- **EX-04:** InternalServerError - Database error while loading dispute details

---

## Priority

**High**

---

## Frequency of Use

- **Admin/Staff:** Multiple times per day (when resolving disputes)
- **Regular users:** A few times per week (when involved in disputes)

---

## Business Rules

**BR-66:** Only Admin, Staff, Raiser, Defendant, or Broker of the related project can view dispute details. Other users receive 403 Forbidden.

**BR-67:** Evidence files are stored as URLs in the evidence array. Frontend must validate file type and size before upload.

**BR-68:** Activity timeline shows public activities to all parties. Internal admin actions are only visible to Admin and Staff roles.

**BR-69:** Dispute status must be displayed with color coding: OPEN (Blue), IN_MEDIATION (Orange), RESOLVED (Green), REJECTED (Gray), APPEALED (Purple).

**BR-70:** Countdown timers for deadlines update in real-time. If overdue, display negative time as "Overdue by X hours/days".

**BR-71:** If dispute status is RESOLVED, the page must show resolution details: verdict (WIN_CLIENT, WIN_FREELANCER, SPLIT), adminComment, and resolvedAt timestamp.

**BR-72:** The "Appeal" button is only shown if: (1) Dispute status is RESOLVED, (2) Current time is within 7 days of resolution, (3) User is the losing party, (4) Dispute has not been appealed already.

**BR-73:** Related Project and Milestone information must be displayed as clickable links to their detail pages.

**BR-74:** If disputed amount is displayed, format as currency with proper thousands separator and VND symbol.

---

## Other Information

- **Performance:** Detail query uses findOne with relations. Single record retrieval should complete within 500ms. Evidence files are lazy-loaded.
- **Concurrency:** Multiple users can view the same dispute simultaneously. Read operations do not require locking.
- **Audit:** Viewing dispute details is not logged (too verbose). Only write operations (respond, resolve, appeal) are logged to DisputeActivityEntity.
- **Notification:** No notifications triggered by viewing. Notifications sent only on status changes.
- **Recovery:** Read-only operation. Failed queries return error response. User can retry without side effects.

---

## Assumptions

1. Dispute data is complete with all required relationships (raiser, defendant, project, milestone).
2. Evidence file URLs are valid and accessible.
3. Users understand dispute status meanings and action implications.
4. Admin users have been trained on resolution procedures before accessing this page.

---

**End of Use Case Specification**
