# Use Case Specifications: Admin Operations & Management

---

## UC-56: View List Report

### Feature Name

**Report Management**

---

### UC ID and Name

**UC-56: View List Report**

---

### Created By

Development Team

---

### Date Created

04/01/2026

---

### Primary Actor

Admin

---

### Secondary Actors

N/A

---

### Description

Admin views a paginated list of all user reports about reviews that violate community guidelines. Users can report reviews for reasons such as spam, harassment, fake reviews, or inappropriate language. This feature allows Admin to moderate reported content, investigate violations, and take appropriate actions such as deleting reviews or dismissing reports.

---

### Trigger

1. Admin clicks on "Reports" or "Review Moderation" menu from admin dashboard.
2. Admin needs to investigate user-reported content.

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. Reports exist in database (users have reported reviews).

---

### Post-conditions

1. A paginated list of pending reports is displayed.
2. Admin can review report details and take moderation actions.
3. Resolved reports are removed from pending list.

---

### Normal Flow

1. Admin navigates to Reports page from admin menu.
2. System validates user has ADMIN role.
3. System loads default report list with parameters:
   - status = PENDING
   - page = 1
   - limit = 20
   - sortBy = createdAt
   - sortOrder = DESC (newest first)
4. System retrieves reports from database with pagination.
5. System displays reports table with columns:
   - Report ID (truncated)
   - Created Date
   - Reporter (name and avatar)
   - Review Content (truncated excerpt)
   - Reviewer (person who wrote the review)
   - Report Reason (SPAM, HARASSMENT, FAKE_REVIEW, etc.)
   - Description (reporter's explanation)
   - Actions (View Detail, Resolve, Reject)
6. System shows summary at top:
   - Total pending reports
   - Reports today
   - Resolved this week
7. System displays pagination controls at bottom.
8. Admin can click on any report row to view full details.

---

### Alternative Flows

**A.1 Filter by report status**

1. Admin selects status filter dropdown.
2. Admin chooses status: PENDING, RESOLVED, REJECTED, or "All Statuses".
3. System filters reports by selected status.
4. Table updates to show matching reports.
5. Pending reports are highlighted in yellow/orange.

**A.2 Filter by report reason**

1. Admin selects reason filter dropdown.
2. Admin chooses reason: SPAM, HARASSMENT, DOXING, FAKE_REVIEW, INAPPROPRIATE_LANGUAGE, OFF_TOPIC, OTHER.
3. System filters reports by selected reason.
4. Table displays only reports with matching reason.

**A.3 Search by reporter or reviewer**

1. Admin enters keywords in search box.
2. System performs search on reporter name/email and reviewer name/email.
3. System displays matching reports as admin types.
4. If no match: System shows "No reports found".

**A.4 View report detail**

1. Admin clicks on report row.
2. System opens detail modal showing:
   - Full report information (ID, created date)
   - Reporter details (name, email, avatar)
   - Review being reported (full content, rating)
   - Reviewer details (person who wrote review)
   - Report reason and description
   - Review context (project name, participants)
3. Admin can see review history if it was edited.
4. Admin can decide to delete review or dismiss report.

**A.5 Resolve report and delete review**

1. Admin clicks "Resolve & Delete Review" button.
2. System opens confirmation modal.
3. Admin enters admin note explaining action.
4. Admin confirms deletion.
5. System updates report status to RESOLVED.
6. System soft-deletes the reported review.
7. System records admin ID and resolution timestamp.
8. System sends notification to reporter about resolution.
9. Success message: "Report resolved and review deleted".
10. Report removed from pending list.

**A.6 Dismiss report (keep review)**

1. Admin clicks "Dismiss Report" button.
2. System opens confirmation modal.
3. Admin enters admin note explaining why report is dismissed.
4. Admin confirms dismissal.
5. System updates report status to REJECTED.
6. System keeps review active (no deletion).
7. System records admin ID and resolution timestamp.
8. System sends notification to reporter about dismissal.
9. Success message: "Report dismissed successfully".
10. Report removed from pending list.

**A.7 View reporter history**

1. Admin clicks on reporter name.
2. System displays reporter's history:
   - Total reports submitted
   - Resolved vs rejected count
   - Accuracy rate (percentage of valid reports)
   - Recent reports list
3. Admin can identify users who abuse report system.
4. Admin can flag malicious reporters if pattern detected.

**A.8 View review detail in context**

1. Admin clicks "View Review" button.
2. System opens review detail page showing:
   - Full review content and rating
   - Project context (name, status, budget)
   - Project participants (client, freelancer, broker)
   - Other reviews for same project
   - Reviewer's review history
3. Admin can see if review is consistent with other reviews.
4. Admin can identify fake or suspicious review patterns.

---

### Exceptions

- **EX-01:** UnauthorizedException - User is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN
- **EX-03:** InternalServerError - Database error while loading reports
- **EX-04:** NotFoundException - Report not found when trying to resolve
- **EX-05:** ConflictException - Report already resolved by another admin

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Daily

---

### Business Rules

**BR-167:** Only ADMIN role can view and manage reports. Regular users cannot access this feature.

**BR-168:** Reports are sorted by createdAt descending by default (newest reports first).

**BR-169:** Valid report reasons: SPAM, HARASSMENT, DOXING, FAKE_REVIEW, INAPPROPRIATE_LANGUAGE, OFF_TOPIC, OTHER.

**BR-170:** Users cannot report their own reviews. System blocks self-reporting.

**BR-171:** Users can only report each review once. Duplicate reports from same user are rejected.

**BR-172:** When report is resolved with review deletion, review is soft-deleted (deletedAt set, not removed from database).

**BR-173:** Dismissed reports (status REJECTED) keep the review active and visible.

**BR-174:** Admin note is mandatory when resolving or dismissing reports for audit trail.

**BR-175:** Both reporter and reviewer receive email notifications about report resolution.

**BR-176:** Resolved reports include: resolvedBy (admin ID), resolvedAt (timestamp), adminNote (explanation).

**BR-177:** Maximum page size is 50 reports to prevent performance issues.

**BR-178:** If reporter has > 80% rejected reports, system flags as potentially malicious reporter.

---

### Other Information

- **Performance:** Report queries should complete within 2 seconds. Uses database indexing on status, createdAt, and reporterId.
- **Concurrency:** Multiple admins can view reports simultaneously. If two admins try to resolve same report, second admin sees conflict error.
- **Audit:** All report resolutions and dismissals are logged to audit_logs with action RESOLVE_REPORT or DISMISS_REPORT.
- **Notification:** Email sent to reporter after resolution/dismissal. Reviewer notified if review is deleted.
- **Recovery:** Failed operations can be retried. Soft-delete allows review recovery if deletion was mistake.

---

### Assumptions

1. Users submit reports in good faith to maintain community quality.
2. Admin reviews reports fairly and follows community guidelines.
3. Email service is operational for sending notifications.
4. Deleted reviews can be restored by admin if needed (soft-delete).

---

## UC-60: Manage Freelancer/Broker Registration Request

### Feature Name

**User Registration Management**

---

### UC ID and Name

**UC-60: Manage Freelancer/Broker Registration Request**

---

### Created By

Development Team

---

### Date Created

04/01/2026

---

### Primary Actor

Admin

---

### Secondary Actors

N/A

---

### Description

Admin reviews and approves or rejects registration requests from users who want to become Freelancers or Brokers on the platform. New users sign up with CLIENT role by default. To become Freelancer or Broker, they must submit a registration request with verification documents, portfolio, and qualifications. Admin verifies the information and decides whether to approve or reject the request.

---

### Trigger

1. Admin clicks on "Registration Requests" or "User Verification" menu.
2. Admin receives notification about new registration request.

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. Users have submitted registration requests with status PENDING.

---

### Post-conditions

1. Registration requests are reviewed and processed.
2. Approved users have their role upgraded to FREELANCER or BROKER.
3. Rejected users receive notification with rejection reason.

---

### Normal Flow

1. Admin navigates to Registration Requests page from admin menu.
2. System validates user has ADMIN role.
3. System loads pending registration requests with parameters:
   - status = PENDING
   - page = 1
   - limit = 20
   - sortBy = submittedAt
   - sortOrder = ASC (oldest first, FIFO)
4. System retrieves registration requests from database.
5. System displays requests table with columns:
   - Request ID (truncated)
   - Submitted Date
   - User Name and Email
   - Current Role (CLIENT)
   - Requested Role (FREELANCER or BROKER)
   - Verification Status
   - Actions (View Detail, Approve, Reject)
6. System shows summary at top:
   - Total pending requests
   - Requests today
   - Approved this month
   - Rejected this month
7. System displays pagination controls at bottom.
8. Admin can click on any request row to view full details.

---

### Alternative Flows

**A.1 Filter by requested role**

1. Admin selects role filter dropdown.
2. Admin chooses role: FREELANCER, BROKER, or "All Roles".
3. System filters requests by requested role.
4. Table updates to show matching requests.

**A.2 Filter by request status**

1. Admin selects status filter dropdown.
2. Admin chooses status: PENDING, APPROVED, REJECTED, or "All Statuses".
3. System filters requests by selected status.
4. Pending requests are highlighted in yellow.

**A.3 Search by user name or email**

1. Admin enters keywords in search box.
2. System performs search on user name and email fields.
3. System displays matching requests.
4. If no match: System shows "No requests found".

**A.4 View request detail**

1. Admin clicks on request row.
2. System opens detail page showing:
   - User profile information (name, email, phone, location)
   - Requested role (FREELANCER or BROKER)
   - Verification documents uploaded (ID card, certificates, portfolio)
   - Skills and expertise listed
   - Experience description
   - Portfolio links
   - References (if provided)
   - Submitted date and time
3. Admin can download and verify uploaded documents.
4. Admin can view user's activity history if any.

**A.5 Approve registration request**

1. Admin clicks "Approve" button from detail page.
2. System opens confirmation modal.
3. Admin reviews all information one last time.
4. Admin enters approval note (optional).
5. Admin confirms approval.
6. System updates request status to APPROVED.
7. System updates user's role from CLIENT to requested role (FREELANCER or BROKER).
8. System sets isVerified flag to true for user.
9. System records admin ID and approval timestamp.
10. System sends congratulations email to user with next steps.
11. Success message: "Registration request approved successfully".
12. Request removed from pending list.

**A.6 Reject registration request**

1. Admin clicks "Reject" button from detail page.
2. System opens rejection modal.
3. Admin selects rejection reason dropdown:
   - Incomplete documentation
   - Invalid credentials
   - Insufficient experience
   - Failed verification
   - Other (specify)
4. Admin enters detailed rejection note (mandatory, min 50 characters).
5. Admin confirms rejection.
6. System updates request status to REJECTED.
7. System keeps user role as CLIENT (no upgrade).
8. System records admin ID, rejection reason, and timestamp.
9. System sends email to user explaining rejection with improvement suggestions.
10. Success message: "Registration request rejected".
11. Request removed from pending list.

**A.7 Request additional information**

1. Admin clicks "Request More Info" button.
2. System opens message modal.
3. Admin specifies what additional information is needed.
4. Admin sends message to user.
5. System updates request status to PENDING_MORE_INFO.
6. System sends email to user with admin's request.
7. User receives notification to provide additional info.
8. User can update request with new information.
9. Request returns to PENDING status after user submits info.

**A.8 View user activity history**

1. Admin clicks "View User History" link.
2. System displays user's platform activity:
   - Account creation date
   - Projects participated in (if any)
   - Reviews received (if any)
   - Disputes involved in (if any)
   - Trust score
   - Badge status
3. Admin can assess user's trustworthiness.
4. Admin can identify potential red flags.

**A.9 Batch approve multiple requests**

1. Admin selects checkboxes for multiple pending requests.
2. Admin clicks "Batch Approve" button.
3. System opens bulk confirmation modal showing selected requests.
4. Admin confirms batch approval.
5. System processes all selected requests sequentially.
6. System updates all users' roles and sends notifications.
7. Success message shows count: "5 requests approved successfully".

---

### Exceptions

- **EX-01:** UnauthorizedException - Admin is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN
- **EX-03:** InternalServerError - Database error while processing request
- **EX-04:** NotFoundException - Registration request not found
- **EX-05:** ConflictException - Request already processed by another admin
- **EX-06:** ValidationException - Rejection note too short or missing required info

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Daily

---

### Business Rules

**BR-179:** Only ADMIN role can review and approve/reject registration requests.

**BR-180:** New users sign up with CLIENT role by default. Must request upgrade to FREELANCER or BROKER.

**BR-181:** Registration request requires: verification documents, skills list, experience description, portfolio links.

**BR-182:** Pending requests are processed FIFO (First In First Out) - oldest requests prioritized.

**BR-183:** Rejection reason is mandatory and must be at least 50 characters for clear feedback.

**BR-184:** Upon approval, user role is upgraded and isVerified flag is set to true.

**BR-185:** Upon rejection, user remains as CLIENT and can submit new request after improvements.

**BR-186:** Verification documents must include valid ID card or passport for identity verification.

**BR-187:** Freelancer requests require: skills, portfolio, at least 1 year experience description.

**BR-188:** Broker requests require: company info, brokerage license, proven track record, client references.

**BR-189:** Admin can request additional information without rejecting request (status PENDING_MORE_INFO).

**BR-190:** Approved users receive welcome email with platform guidelines and best practices.

**BR-191:** Users can only have one active registration request at a time. New request cancels previous pending request.

---

### Other Information

- **Performance:** Request queries should complete within 2 seconds. Document downloads may take longer depending on file size.
- **Concurrency:** Multiple admins can review requests simultaneously. If two admins try to process same request, second admin sees conflict error.
- **Audit:** All approvals and rejections are logged to audit_logs with action APPROVE_REGISTRATION or REJECT_REGISTRATION.
- **Notification:** Email sent to user immediately after approval or rejection with detailed information.
- **Recovery:** Rejected users can submit new request after addressing issues. Admin can reverse decision if mistake was made.
- **Security:** Verification documents are stored securely and only accessible to ADMIN role.

---

### Assumptions

1. Users provide genuine documents and accurate information in registration requests.
2. Admin verifies documents thoroughly before approval.
3. Email service is operational for sending notifications.
4. Document storage system is secure and compliant with data protection regulations.
5. If registration system is not yet implemented, this UC serves as specification for future development.

---

## UC-61: View List On-Going Project

### Feature Name

**Project Monitoring**

---

### UC ID and Name

**UC-61: View List On-Going Project**

---

### Created By

Development Team

---

### Date Created

04/01/2026

---

### Primary Actor

Admin

---

### Secondary Actors

Staff

---

### Description

Admin views a paginated list of all on-going projects in the platform. On-going projects include those with status IN_PROGRESS, TESTING, and DISPUTED. This feature allows Admin to monitor active projects, track progress, identify problems, and intervene when necessary. Admin can view project details, milestones, participants, and take actions if disputes or delays occur.

---

### Trigger

1. Admin clicks on "On-Going Projects" or "Active Projects" menu from admin dashboard.
2. Admin needs to monitor project activities and health.

---

### Preconditions

1. Admin or Staff is logged in with appropriate role.
2. Projects exist with status IN_PROGRESS, TESTING, or DISPUTED.

---

### Post-conditions

1. A paginated list of on-going projects is displayed.
2. Admin can monitor project progress and status.
3. Admin can identify projects needing attention or intervention.

---

### Normal Flow

1. Admin navigates to On-Going Projects page from admin menu.
2. System validates user has ADMIN or STAFF role.
3. System loads on-going projects with parameters:
   - status IN (IN_PROGRESS, TESTING, DISPUTED)
   - page = 1
   - limit = 20
   - sortBy = updatedAt
   - sortOrder = DESC (most recently updated first)
4. System retrieves projects from database with pagination.
5. System displays projects table with columns:
   - Project ID (truncated)
   - Title
   - Client Name
   - Freelancer Name
   - Broker Name
   - Status Badge (IN_PROGRESS/TESTING/DISPUTED)
   - Budget
   - Start Date
   - Expected End Date
   - Progress Percentage
   - Days Active
   - Actions (View Detail, View Milestones, View Participants)
6. System shows summary statistics at top:
   - Total on-going projects
   - Projects in progress
   - Projects in testing
   - Projects disputed
   - Average project duration
7. System displays pagination controls at bottom.
8. Admin can click on any project row to view full details.

---

### Alternative Flows

**A.1 Filter by project status**

1. Admin selects status filter dropdown.
2. Admin chooses status: IN_PROGRESS, TESTING, DISPUTED, or "All On-Going".
3. System filters projects by selected status.
4. Table updates to show matching projects.
5. DISPUTED projects are highlighted in red.

**A.2 Filter by budget range**

1. Admin clicks budget filter.
2. Admin enters minimum budget.
3. Admin enters maximum budget.
4. System filters projects within budget range.
5. Table displays projects matching budget criteria.

**A.3 Filter by duration**

1. Admin selects duration filter.
2. Admin chooses: Less than 1 month, 1-3 months, 3-6 months, More than 6 months.
3. System calculates duration from start date to current date.
4. System displays projects matching duration range.

**A.4 Search by project name or participant**

1. Admin enters keywords in search box.
2. System performs search on project title, client name, freelancer name, broker name.
3. System displays matching projects.
4. If no match: System shows "No projects found".

**A.5 Sort by different columns**

1. Admin clicks on column header (Budget, Start Date, Progress, Days Active).
2. System sorts table by that column ascending.
3. Arrow indicator shows current sort direction.
4. Admin clicks again to reverse sort order.

**A.6 View project detail**

1. Admin clicks on project row.
2. System opens project detail page showing:
   - Project information (title, description, budget, pricing model)
   - Status and progress (current status, completion percentage)
   - Participants (client, freelancer, broker with contact info)
   - Timeline (start date, end date, days active, days remaining)
   - Milestones (list of milestones with status and deadlines)
   - Budget breakdown (total, spent, remaining, escrow held)
   - Recent activities (last 10 activities in project)
   - Documents uploaded
   - Disputes filed (if any)
3. Admin can see complete project history.
4. Admin can identify bottlenecks or issues.

**A.7 View project milestones**

1. Admin clicks "View Milestones" button.
2. System displays list of project milestones:
   - Milestone name and description
   - Status (PENDING, IN_PROGRESS, UNDER_REVIEW, COMPLETED)
   - Deadline
   - Budget allocated
   - Completion percentage
3. Admin can see which milestones are delayed.
4. Admin can identify milestones blocking project progress.

**A.8 View projects at risk**

1. Admin clicks "At Risk" quick filter.
2. System applies criteria for at-risk projects:
   - End date approaching (less than 7 days remaining)
   - Progress percentage low compared to time elapsed
   - No activity in last 7 days
   - Client or freelancer has disputes in other projects
3. System displays projects matching risk criteria.
4. At-risk projects are highlighted in orange/yellow.
5. Admin can proactively reach out to participants.

**A.9 View disputed projects**

1. Admin clicks "Disputed" status filter.
2. System shows only projects with status DISPUTED.
3. Table shows additional column: Dispute Count.
4. Admin can click "View Disputes" to see active disputes.
5. Admin can navigate to dispute resolution page (UC-59).

**A.10 Export project list**

1. Admin clicks "Export" button.
2. System asks for export format: Excel or CSV.
3. Admin confirms export.
4. System generates file with current filtered projects.
5. File includes all visible columns plus additional details.
6. System downloads file to admin's computer.

---

### Exceptions

- **EX-01:** UnauthorizedException - User is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN or STAFF
- **EX-03:** InternalServerError - Database error while loading projects
- **EX-04:** ValidationException - Invalid filter parameters or date range

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Multiple times per day
- **Staff:** Daily

---

### Business Rules

**BR-192:** Only ADMIN and STAFF roles can view on-going projects list. Regular users cannot access this feature.

**BR-193:** On-going projects include status: IN_PROGRESS, TESTING, DISPUTED. Excludes PLANNING, COMPLETED, PAID, CANCELED.

**BR-194:** Projects sorted by updatedAt descending by default (most recently active first).

**BR-195:** Progress percentage calculated from completed milestones vs total milestones.

**BR-196:** Days active calculated from startDate to current date. Excludes weekends if applicable.

**BR-197:** At-risk projects identified by: deadline approaching (< 7 days), low progress (< 50% when > 50% time elapsed), no activity (> 7 days).

**BR-198:** DISPUTED status projects are highlighted in red color for immediate attention.

**BR-199:** Projects without assigned freelancer shown with "Unassigned" badge in yellow.

**BR-200:** Budget displayed in VND currency format with thousand separators.

**BR-201:** Expected end date calculated from project duration or last milestone deadline.

**BR-202:** Maximum page size is 50 projects to prevent performance issues.

**BR-203:** Export functionality respects current active filters and includes only visible data.

---

### Other Information

- **Performance:** Project queries should complete within 2 seconds. Uses database indexing on status, updatedAt, and participantId fields.
- **Concurrency:** Multiple admins can view project list simultaneously. Read-only operation.
- **Audit:** Viewing project list is not logged. Only export actions are logged to audit_logs.
- **Notification:** No notifications triggered by viewing project list.
- **Recovery:** Read-only operation. Failed queries can be retried without side effects.

---

### Assumptions

1. Project data is complete with all required fields (participants, budget, dates).
2. Project status is updated regularly by participants and system.
3. Admin understands project workflow and milestone structure.
4. Database has proper indexes for fast querying on large project tables.

---

## UC-62: Send Notification Email

### Feature Name

**Email Notification System**

---

### UC ID and Name

**UC-62: Send Notification Email**

---

### Created By

Development Team

---

### Date Created

04/01/2026

---

### Primary Actor

System

---

### Secondary Actors

Admin, User

---

### Description

System automatically sends notification emails to users when important events occur on the platform. Events include: dispute resolution, ban/unban account, registration approval/rejection, report resolution, milestone completion, payment received, and other critical actions. Admin can also manually trigger email notifications for announcements or important updates. This ensures users stay informed about activities affecting their account or projects.

---

### Trigger

1. System event occurs that requires user notification (dispute resolved, account banned, etc.).
2. Admin manually sends announcement email to specific users or all users.
3. Scheduled email notifications (daily digest, weekly report, etc.).

---

### Preconditions

1. Email service is configured and operational (SMTP server, API credentials).
2. User has valid email address in profile.
3. User has not disabled email notifications in settings.

---

### Post-conditions

1. Email is sent to recipient's email address.
2. Email delivery status is recorded in database.
3. Failed emails are logged for retry or investigation.

---

### Normal Flow

1. System detects event requiring email notification.
2. System identifies recipient user(s) based on event context.
3. System retrieves user email address from database.
4. System checks user's notification preferences (email enabled).
5. System selects appropriate email template based on event type.
6. System populates template with event-specific data:
   - User name
   - Event details
   - Action links (if applicable)
   - Timestamp
   - Platform branding
7. System composes email with subject and body.
8. System sends email via email service provider (SMTP or API).
9. System records email delivery attempt in database:
   - Recipient email
   - Event type
   - Sent timestamp
   - Delivery status (SENT, FAILED, PENDING)
10. If delivery successful: System logs success.
11. If delivery failed: System logs error and queues for retry.

---

### Alternative Flows

**A.1 Send dispute resolution notification**

1. Admin resolves dispute (UC-59).
2. System identifies dispute participants (raiser and defendant).
3. System determines verdict and money distribution.
4. System composes email with:
   - Dispute ID and case summary
   - Admin verdict and reasoning
   - Money refunded or held
   - Appeal instructions (if applicable)
5. System sends separate emails to raiser and defendant.
6. Email includes link to view dispute details.

**A.2 Send account ban notification**

1. Admin bans user account (UC-51).
2. System identifies banned user.
3. System composes email with:
   - Account suspension notice
   - Ban reason provided by admin
   - Ban duration (permanent or temporary)
   - Appeal process instructions
   - Contact support information
4. System sends email to user's registered email.
5. User receives notification immediately.

**A.3 Send registration approval notification**

1. Admin approves registration request (UC-60).
2. System identifies approved user.
3. System composes congratulations email with:
   - Approval confirmation
   - New role (FREELANCER or BROKER)
   - Welcome message and next steps
   - Platform guidelines link
   - Getting started tutorial link
4. System sends email to user.
5. User can start using new role features.

**A.4 Send registration rejection notification**

1. Admin rejects registration request (UC-60).
2. System identifies rejected user.
3. System composes rejection email with:
   - Rejection notice
   - Detailed rejection reason from admin
   - Improvement suggestions
   - Resubmission instructions
   - Contact support for questions
4. System sends email to user.
5. User can address issues and resubmit.

**A.5 Send report resolution notification**

1. Admin resolves or dismisses report (UC-56).
2. System identifies reporter and reviewer.
3. System composes email to reporter with:
   - Report resolution status
   - Admin decision (resolved or dismissed)
   - Admin note explaining decision
   - Thank you for reporting message
4. If review deleted: System sends email to reviewer notifying deletion.
5. Both parties receive notifications.

**A.6 Admin manually sends announcement email**

1. Admin navigates to "Send Announcement" page.
2. Admin selects recipients: All Users, Specific Role, or Custom List.
3. Admin enters email subject.
4. Admin composes email body using rich text editor.
5. Admin can add attachments if needed.
6. Admin previews email before sending.
7. Admin clicks "Send" button.
8. System validates recipients list.
9. System sends emails in batches (to avoid spam filters).
10. System shows progress: "Sending emails: 150/500 sent...".
11. System displays completion message with success/failure counts.

**A.7 Send milestone completion notification**

1. Freelancer completes milestone in project.
2. System identifies project client and broker.
3. System composes email with:
   - Milestone name and description
   - Completion notification
   - Request for client review
   - Link to approve or request changes
4. System sends email to client and broker.
5. Email prompts client to review deliverables.

**A.8 Send payment received notification**

1. System processes payment transaction (deposit, escrow release, withdrawal).
2. System identifies transaction recipient.
3. System composes email with:
   - Payment received confirmation
   - Amount and currency
   - Transaction ID
   - New wallet balance
   - Transaction details link
4. System sends email to recipient.
5. User receives immediate confirmation.

**A.9 Retry failed email delivery**

1. Email delivery fails (invalid email, server error, rate limit).
2. System logs failure reason and timestamp.
3. System queues email for retry.
4. System waits exponential backoff period (1 min, 5 min, 30 min, 2 hours).
5. System attempts redelivery.
6. If retry successful: System logs success.
7. If retry fails after 3 attempts: System marks as permanently failed.
8. Admin notified of permanently failed emails for investigation.

**A.10 User disables email notifications**

1. User navigates to notification settings in profile.
2. User toggles "Email Notifications" to OFF.
3. System updates user preferences in database.
4. System still sends critical emails (security alerts, account bans).
5. System skips non-critical emails (milestone updates, reviews).

---

### Exceptions

- **EX-01:** EmailServiceException - Email service provider is down or unreachable
- **EX-02:** InvalidEmailException - User email address is invalid or malformed
- **EX-03:** RateLimitException - Email service rate limit exceeded, retry later
- **EX-04:** TemplateNotFoundException - Email template for event type not found
- **EX-05:** ConfigurationException - Email service credentials or configuration missing

---

### Priority

**Critical**

---

### Frequency of Use

- **System:** Continuous (automated)
- **Admin:** Occasional (manual announcements)

---

### Business Rules

**BR-204:** Email notifications are sent automatically for critical events: dispute resolution, account ban/unban, registration approval/rejection, report resolution.

**BR-205:** Critical security emails (password reset, account ban, suspicious login) are always sent regardless of user notification preferences.

**BR-206:** Non-critical emails (milestone updates, reviews, reminders) respect user notification preferences.

**BR-207:** Email templates must include: platform branding, user name, event details, relevant action links, unsubscribe link.

**BR-208:** Failed email deliveries are retried up to 3 times with exponential backoff: 1 min, 5 min, 30 min, 2 hours.

**BR-209:** Permanently failed emails (after 3 retries) are logged and admin is notified for investigation.

**BR-210:** Email service must support HTML templates with inline CSS for proper rendering across email clients.

**BR-211:** All emails include unsubscribe link at bottom (except critical security emails).

**BR-212:** Admin announcement emails are sent in batches of 50 per minute to avoid spam filters.

**BR-213:** Email content must be in Vietnamese for Vietnamese users, English for international users (i18n support).

**BR-214:** Email subject line must be concise (max 78 characters) and clearly describe content.

**BR-215:** All outgoing emails are logged with: recipient, subject, event type, sent timestamp, delivery status.

**BR-216:** Email delivery status tracked: PENDING (queued), SENT (delivered to mail server), DELIVERED (confirmed received), FAILED (delivery failed).

---

### Other Information

- **Performance:** Email sending is asynchronous to avoid blocking main application flow. Uses job queue (Redis/Bull) for processing.
- **Concurrency:** Email service can process multiple emails in parallel (up to 10 concurrent sends).
- **Audit:** All email sends are logged with delivery status. Failed emails logged with error reason.
- **Notification:** No meta-notifications for email sends (would create infinite loop).
- **Recovery:** Failed emails queued for retry with exponential backoff. Admin can manually retry failed emails.
- **Security:** Email templates sanitize user input to prevent XSS. No sensitive data (passwords, tokens) included in emails.
- **Compliance:** Unsubscribe link required by email regulations (CAN-SPAM, GDPR). User preferences stored securely.

---

### Assumptions

1. Email service provider (SMTP server or API like SendGrid, Mailgun) is configured and reliable.
2. Users provide valid email addresses during registration.
3. Email templates are professionally designed and tested across email clients.
4. System has proper error handling for email delivery failures.
5. Email delivery is not guaranteed immediate; delays possible due to mail server queues.

---

## UC-63: View List Feedback

### Feature Name

**Feedback Management**

---

### UC ID and Name

**UC-63: View List Feedback (View List Review)**

---

### Created By

Development Team

---

### Date Created

04/01/2026

---

### Primary Actor

Admin

---

### Secondary Actors

Staff

---

### Description

Admin views a paginated list of all reviews (feedback) submitted by users about other users after project completion. Reviews include ratings (1-5 stars) and comments about user performance, communication, and professionalism. Admin can monitor review quality, identify suspicious reviews, and moderate content that violates guidelines. This feature helps maintain review system integrity and provides insights into user reputation trends.

---

### Trigger

1. Admin clicks on "Reviews" or "Feedback Management" menu from admin dashboard.
2. Admin needs to investigate suspicious reviews or review patterns.
3. Admin needs to analyze review trends and user ratings.

---

### Preconditions

1. Admin or Staff is logged in with appropriate role.
2. Reviews exist in database (users have submitted reviews after projects).

---

### Post-conditions

1. A paginated list of reviews is displayed with key information.
2. Admin can monitor review quality and identify issues.
3. Admin can take moderation actions on suspicious reviews.

---

### Normal Flow

1. Admin navigates to Reviews page from admin menu.
2. System validates user has ADMIN or STAFF role.
3. System loads default review list with parameters:
   - deletedAt IS NULL (exclude deleted reviews)
   - page = 1
   - limit = 20
   - sortBy = createdAt
   - sortOrder = DESC (newest first)
4. System retrieves reviews from database with pagination.
5. System displays reviews table with columns:
   - Review ID (truncated)
   - Created Date
   - Reviewer (person who wrote review)
   - Target User (person being reviewed)
   - Project Title
   - Rating (1-5 stars)
   - Comment (truncated excerpt)
   - Weight (review importance multiplier)
   - Status (Active or Deleted)
   - Report Count (if review has been reported)
   - Actions (View Detail, View Reports, Delete)
6. System shows summary statistics at top:
   - Total reviews
   - Reviews this month
   - Average rating platform-wide
   - Reviews with reports
   - Deleted reviews count
7. System displays pagination controls at bottom.
8. Admin can click on any review row to view full details.

---

### Alternative Flows

**A.1 Filter by rating**

1. Admin selects rating filter dropdown.
2. Admin chooses rating: 1 Star, 2 Stars, 3 Stars, 4 Stars, 5 Stars, or "All Ratings".
3. System filters reviews by selected rating.
4. Table updates to show matching reviews.
5. Low ratings (1-2 stars) highlighted in red for attention.

**A.2 Filter by review status**

1. Admin selects status filter dropdown.
2. Admin chooses status: Active (deletedAt IS NULL) or Deleted (deletedAt IS NOT NULL).
3. System filters reviews by deletion status.
4. Deleted reviews shown with strikethrough and deletion reason.

**A.3 Filter by review weight**

1. Admin selects weight filter.
2. Admin chooses weight range: Low (< 1.0), Normal (1.0), High (1.5-2.0).
3. System filters reviews by weight value.
4. High weight reviews are from large projects with significant budget.

**A.4 Search by reviewer or target user**

1. Admin enters keywords in search box.
2. System performs search on reviewer name/email and target user name/email.
3. System displays matching reviews.
4. If no match: System shows "No reviews found".

**A.5 Search by project**

1. Admin enters project title or ID in search box.
2. System searches reviews by associated project.
3. System displays all reviews for that project.
4. Admin can see all participant reviews together.

**A.6 View review detail**

1. Admin clicks on review row.
2. System opens detail modal showing:
   - Full review information (ID, created date)
   - Reviewer details (name, email, avatar, role)
   - Target user details (name, email, avatar, role)
   - Project details (title, budget, status, participants)
   - Rating (1-5 stars with visual stars)
   - Full comment text
   - Weight value and calculation reason
   - Edit history (if review was edited)
   - Report count and reasons (if reported)
   - Deletion info (if deleted: deletedBy, deletedAt, deleteReason)
3. Admin can see complete context for review.
4. Admin can identify if review is legitimate or suspicious.

**A.7 View review edit history**

1. Admin clicks "View Edit History" button.
2. System displays review version history from audit_logs:
   - Version number (1, 2, 3, etc.)
   - Edit timestamp
   - Changes made (rating change, comment change)
   - Previous values vs new values
3. Admin can see if user changed review significantly after posting.
4. Admin can identify review manipulation patterns.

**A.8 View reviews with reports**

1. Admin clicks "Reported Reviews" quick filter.
2. System displays only reviews that have at least one report (reportCount > 0).
3. Table shows additional column: Report Count.
4. Admin can click "View Reports" to see report details.
5. Admin can navigate to report moderation page (UC-56).

**A.9 Soft delete review**

1. Admin clicks "Delete Review" button from detail view.
2. System opens confirmation modal.
3. Admin enters deletion reason (mandatory, min 20 characters).
4. Admin confirms deletion.
5. System performs soft-delete:
   - Sets deletedAt to current timestamp
   - Sets deletedBy to admin user ID
   - Sets deleteReason to admin's explanation
6. Review remains in database but hidden from users.
7. System recalculates target user's trust score (review no longer counts).
8. System sends notification to reviewer about deletion.
9. System logs deletion to audit_logs.
10. Success message: "Review deleted successfully".

**A.10 Restore deleted review**

1. Admin views deleted reviews (status filter = Deleted).
2. Admin clicks "Restore" button on deleted review.
3. System opens confirmation modal.
4. Admin enters restoration reason.
5. Admin confirms restoration.
6. System performs restoration:
   - Sets deletedAt to NULL
   - Records restoration in audit_logs
   - Sends notification to reviewer about restoration
7. System recalculates target user's trust score (review counts again).
8. Review becomes visible to users again.
9. Success message: "Review restored successfully".

**A.11 View suspicious review patterns**

1. Admin clicks "Suspicious Reviews" quick filter.
2. System applies criteria for suspicious reviews:
   - Multiple 5-star reviews from same reviewer in short time
   - Multiple 1-star reviews targeting same user
   - Review content very similar to other reviews (possible copy-paste)
   - Reviewer and target user have no completed projects together
   - Review posted long after project completion (> 30 days)
3. System displays reviews matching suspicious criteria.
4. Suspicious reviews highlighted in orange.
5. Admin can investigate and take action.

**A.12 Export review data**

1. Admin clicks "Export" button.
2. System asks for export format: Excel or CSV.
3. Admin confirms export.
4. System generates file with current filtered reviews.
5. File includes all columns plus: reviewer email, target user email, project ID, deletion info.
6. System downloads file to admin's computer.

---

### Exceptions

- **EX-01:** UnauthorizedException - User is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN or STAFF
- **EX-03:** InternalServerError - Database error while loading reviews
- **EX-04:** NotFoundException - Review not found when trying to delete/restore
- **EX-05:** ValidationException - Deletion reason too short or missing

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Daily
- **Staff:** Frequent

---

### Business Rules

**BR-217:** Only ADMIN and STAFF roles can view all reviews list. Regular users see only reviews for specific users/projects.

**BR-218:** Reviews sorted by createdAt descending by default (newest reviews first).

**BR-219:** Deleted reviews are soft-deleted (deletedAt set) not removed from database for audit trail.

**BR-220:** Deletion reason is mandatory and must be at least 20 characters for documentation.

**BR-221:** When review is deleted, target user's trust score is recalculated excluding that review.

**BR-222:** When review is restored, target user's trust score is recalculated including that review.

**BR-223:** Review weight calculated based on project budget: < 2M (0.8), 2M-10M (1.0), 10M-50M (1.5), > 50M (2.0).

**BR-224:** Users can edit reviews within 72 hours of posting. After 72 hours, reviews are locked.

**BR-225:** Edit history is maintained in audit_logs for transparency and fraud detection.

**BR-226:** Reviews can only be posted after project status is COMPLETED. Cannot review during active projects.

**BR-227:** Users cannot review themselves. System blocks self-reviews.

**BR-228:** Each user can review another user only once per project. Duplicate reviews blocked.

**BR-229:** Suspicious review patterns trigger automatic flagging for admin review.

**BR-230:** Maximum page size is 50 reviews to prevent performance issues.

**BR-231:** Export functionality respects current active filters and includes only visible data.

---

### Other Information

- **Performance:** Review queries should complete within 2 seconds. Uses database indexing on createdAt, reviewerId, targetUserId, deletedAt.
- **Concurrency:** Multiple admins can view reviews simultaneously. Soft-delete prevents conflicts.
- **Audit:** All review deletions and restorations are logged to audit_logs with action DELETE_REVIEW or RESTORE_REVIEW.
- **Notification:** Reviewer receives email when their review is deleted or restored with admin's explanation.
- **Recovery:** Soft-delete allows review recovery if deletion was mistake. Trust scores recalculated automatically.

---

### Assumptions

1. Users submit honest reviews about their project experiences.
2. Admin reviews suspicious patterns and takes fair moderation actions.
3. Trust score calculation service is available for recalculation after deletions/restorations.
4. Database has proper indexes for fast querying on large review tables.

---

**End of Use Case Specifications**
