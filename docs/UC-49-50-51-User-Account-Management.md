# Use Case Specifications: User Account Management

## 2.2 <<Feature Name: User Account Management>>

---

## UC-49: Manage User Accounts

### UC ID and Name

**UC-49: Manage User Accounts**

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

Admin views a paginated list of all user accounts in the system with filtering and search capabilities. This allows Admin to monitor user activities, identify problematic accounts, and access individual account details for further actions such as viewing details or banning accounts.

---

### Trigger

1. Admin clicks on "User Management" or "Accounts" menu in the admin dashboard.
2. Admin needs to search for a specific user account.

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. User management module is active and operational.

---

### Post-conditions

1. A paginated list of user accounts is displayed with key information.
2. Admin can filter, search, and sort the user list.
3. Admin can navigate to individual account detail pages.

---

### Normal Flow

1. Admin navigates to User Management page from admin dashboard.
2. System validates admin has ADMIN role.
3. System loads default user list with query parameters:
   - page = 1
   - limit = 20
   - sortBy = createdAt
   - sortOrder = DESC
4. System retrieves user data from database with pagination.
5. System displays user table with columns:
   - User ID (truncated)
   - Full Name
   - Email
   - Role (badge)
   - Badge Type (NEW, VERIFIED, TRUSTED, WARNING)
   - Trust Score
   - Total Projects Finished
   - Total Disputes Lost
   - Created Date
   - Actions (View, Ban/Unban)
6. System shows pagination controls at bottom.
7. Admin can click on any user row to view details (UC-50).
8. Admin can click "Ban" button to ban account (UC-51).

---

### Alternative Flows

**A.1 Filter users by role**

Branches from step 5 in Normal Flow.

1. Admin selects role filter dropdown (ALL, CLIENT, FREELANCER, BROKER, STAFF, ADMIN).
2. Admin chooses specific role to filter (e.g., FREELANCER).
3. System sends request with role query parameter.
4. System returns only users with selected role.
5. Table updates to show filtered results.

**A.2 Filter users by badge type**

Branches from step 5 in Normal Flow.

1. Admin selects badge filter dropdown (ALL, NEW, VERIFIED, TRUSTED, WARNING).
2. Admin chooses badge type (e.g., WARNING to find problematic users).
3. System filters users by calculated badge property.
4. System returns matching users.
5. Table updates with filtered results.

**A.3 Search users by name or email**

Branches from step 5 in Normal Flow.

1. Admin types keywords into search box.
2. System performs fuzzy search on fullName and email fields.
3. System displays matching results as admin types.
4. If no results found: System shows "No users match your search criteria".

**A.4 Sort users by different columns**

Branches from step 5 in Normal Flow.

1. Admin clicks on column header (Trust Score, Projects Finished, Disputes Lost, Created Date).
2. System sorts table by that column in ascending order.
3. Arrow indicator shows current sort direction.
4. Admin clicks again to reverse sort order.

**A.5 Filter users with high disputes**

Branches from step 5 in Normal Flow.

1. Admin toggles "High Risk Users" filter switch.
2. System filters users where totalDisputesLost >= 2.
3. System displays only users flagged as high risk.
4. Results are highlighted in orange or red color.

**A.6 Change page size**

Branches from step 5 in Normal Flow.

1. Admin clicks page size dropdown showing "20 per page".
2. Admin selects different size: 10, 50, or 100.
3. System reloads table with new limit.
4. Pagination controls update accordingly.

**A.7 Navigate between pages**

Branches from step 6 in Normal Flow.

1. Admin sees pagination showing "Page 1 of 15".
2. Admin clicks "Next" or specific page number.
3. System loads next page of users.
4. Page indicator updates to current page.

---

### Exceptions

- **EX-01:** UnauthorizedException - User is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN
- **EX-03:** InternalServerError - Database connection error while loading users
- **EX-04:** ValidationException - Invalid filter or sort parameters

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Multiple times per day for monitoring and support

---

### Business Rules

**BR-91:** Only users with ADMIN role can access user management listing. STAFF role has read-only access.

**BR-92:** User list default sorting is by createdAt descending (newest users first).

**BR-93:** Maximum page size is limited to 100 users to prevent performance issues.

**BR-94:** Badge calculation is done dynamically based on user stats (totalProjectsFinished, totalDisputesLost, currentTrustScore, isVerified).

**BR-95:** Users with WARNING badge (totalDisputesLost >= 1 and not redeemed) must be highlighted in yellow/orange color.

**BR-96:** Search functionality performs case-insensitive partial matching on fullName and email fields.

**BR-97:** Password hash must never be returned in list API response for security reasons.

---

### Other Information

- **Performance:** User list query should complete within 2 seconds. Uses database indexing on email, role, and createdAt fields.
- **Concurrency:** Multiple admins can view user list simultaneously without conflicts.
- **Audit:** User list viewing is not logged. Only actions like ban/unban are audited.
- **Notification:** No notifications triggered by viewing user list.
- **Recovery:** Read-only operation. Failed queries can be retried without side effects.

---

### Assumptions

1. User data is complete with all required fields.
2. Database has proper indexes for fast querying.
3. Admin understands badge types and trust score meanings.

---

## UC-50: View Account Detail

### UC ID and Name

**UC-50: View Account Detail**

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

Admin views complete details of a specific user account including profile information, statistics, trust score breakdown, project history, dispute history, flags, and badges. This provides comprehensive information for admin to make decisions about account actions.

---

### Trigger

1. Admin clicks on a user row from user list (UC-49).
2. Admin searches for user ID and navigates directly to detail page.

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. User account exists in database.

---

### Post-conditions

1. Complete user account details are displayed.
2. Admin can see full statistics and history.
3. Admin can take actions (Ban, View Projects, View Disputes).

---

### Normal Flow

1. Admin clicks on user row or navigates to user detail URL.
2. System retrieves userId from URL or click event.
3. System validates admin has permission to view user details.
4. System loads user data with relations:
   - Basic profile (fullName, email, phoneNumber, role)
   - Statistics (totalProjectsFinished, totalDisputesLost, totalLateProjects)
   - Trust score details (currentTrustScore, calculation breakdown)
   - Badge information (badge type and reason)
   - Active flags and warnings
   - Recent projects (last 5)
   - Recent disputes (if any)
5. System displays user detail page with sections:
   - Header: User avatar, name, email, role badge, trust score badge
   - Overview: Account created date, verification status, badge type
   - Statistics Dashboard: Projects finished/cancelled, disputes lost, late deliveries
   - Trust Score: Current score with breakdown chart
   - Project History: List of recent projects with status
   - Dispute History: List of disputes involved in
   - Flags & Warnings: Active warnings and resolution status
   - Account Actions: Ban/Unban button, Reset Password button
6. System shows calculated badge with explanation tooltip.
7. Admin can click on project or dispute links to view details.
8. Admin can click action buttons at bottom of page.

---

### Alternative Flows

**A.1 View trust score breakdown**

Branches from step 5 in Normal Flow.

1. Admin clicks "View Trust Score Details" button.
2. System opens modal showing trust score calculation:
   - Base score from projects finished
   - Penalties from disputes lost
   - Penalties from late deliveries
   - Bonuses from verified status
   - Final calculated score
3. Modal shows formula and values used.
4. Admin can close modal to return to detail view.

**A.2 View project history**

Branches from step 5 in Normal Flow.

1. Admin scrolls to Project History section.
2. System displays table of projects user involved in:
   - Project name
   - Role in project (Client, Freelancer, Broker)
   - Status (Completed, Cancelled, In Progress)
   - Completion date
3. Admin clicks "View All Projects" to see paginated full list.
4. Admin clicks specific project to open project detail page in new tab.

**A.3 View dispute history**

Branches from step 5 in Normal Flow.

1. Admin scrolls to Dispute History section.
2. System shows list of disputes:
   - Dispute ID
   - User role (Raiser or Defendant)
   - Result (Won, Lost, Split)
   - Resolved date
3. Disputes user lost are highlighted in red.
4. Admin can click dispute to view full details.

**A.4 View active flags and warnings**

Branches from step 5 in Normal Flow.

1. Admin scrolls to Flags & Warnings section.
2. System displays active UserFlag records:
   - Flag type (HIGH_DISPUTE_LOSS, PATTERN_FRAUD, etc.)
   - Flag severity (LOW, MEDIUM, HIGH, CRITICAL)
   - Created date
   - Resolution status (Active or Resolved)
3. Admin can see reason for each flag.
4. Admin can mark flag as resolved if issue is cleared.

**A.5 User has WARNING badge**

Branches from step 6 in Normal Flow.

1. System detects user badge is WARNING.
2. System displays prominent warning banner at top:
   - "This user has lost X dispute(s) and may be high risk."
   - Recommendation: "Review dispute history before approving projects."
3. User statistics section highlighted in yellow/orange.
4. Ban button is more prominent for quick action.

**A.6 User has TRUSTED badge**

Branches from step 6 in Normal Flow.

1. System detects user badge is TRUSTED.
2. System displays success banner: "This user has excellent track record."
3. Badge shows: "TRUSTED - 5+ projects completed with score 4.5+".
4. Statistics section highlighted in green.

---

### Exceptions

- **EX-01:** UserNotFoundException - User account does not exist or invalid ID
- **EX-02:** ForbiddenException - Admin lacks permission to view this account
- **EX-03:** InternalServerError - Database error while loading user details
- **EX-04:** DataInconsistencyException - User statistics are inconsistent (needs recalculation)

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Multiple times per day when investigating user issues

---

### Business Rules

**BR-98:** Only ADMIN role can view full user account details including internal flags and warnings.

**BR-99:** Badge is calculated on-the-fly using virtual property getter, not stored in database.

**BR-100:** Trust score breakdown shows detailed formula: Base score - (disputes × 0.5) - (late projects × 0.2) + (verified bonus).

**BR-101:** Project history shows last 5 projects by default. Full history requires separate paginated view.

**BR-102:** Dispute history only shows resolved disputes. Open disputes are marked as "In Progress".

**BR-103:** Active flags are displayed with severity color coding: LOW (blue), MEDIUM (yellow), HIGH (orange), CRITICAL (red).

**BR-104:** Password hash and sensitive authentication data must never be displayed in detail view.

**BR-105:** User email and phone number are displayed but cannot be edited from admin panel (user must edit via profile).

---

### Other Information

- **Performance:** User detail query with all relations should complete within 1 second. Heavy data like full project list is paginated separately.
- **Concurrency:** Multiple admins can view same user detail simultaneously without locking.
- **Audit:** Viewing user details is not logged. Only actions taken (ban, flag resolution) are audited.
- **Notification:** No notifications sent when admin views user details.
- **Recovery:** Read-only operation. Failed queries can be retried safely.

---

### Assumptions

1. User data relationships (projects, disputes, flags) are properly maintained.
2. Trust score calculation service is available for on-demand recalculation.
3. Admin understands trust score formula and badge criteria.

---

## UC-51: Ban Account

### UC ID and Name

**UC-51: Ban Account**

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

Admin bans or unbans a user account to restrict access to the platform. Banned users cannot log in, create projects, or perform any actions. This is used for disciplinary action against users who violate platform rules, commit fraud, or have excessive dispute losses.

---

### Trigger

1. Admin clicks "Ban Account" button from user detail page (UC-50).
2. Admin clicks "Ban" button from user list action column (UC-49).

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. User account exists and is currently active or banned.
3. Admin has reviewed user history and determined ban is warranted.

---

### Post-conditions

1. User account ban status is updated (banned or unbanned).
2. If banned: User cannot log in and all active sessions are terminated.
3. If unbanned: User can log in normally again.
4. Audit log entry is created with ban reason and admin ID.
5. Notification is sent to user's email about account status change.

---

### Normal Flow

1. Admin views user detail page or user list.
2. Admin reviews user's dispute history, flags, and violations.
3. Admin clicks "Ban Account" button.
4. System opens confirmation modal with fields:
   - Ban Reason dropdown (Fraud, Multiple Dispute Losses, Terms Violation, Other)
   - Ban Comment textarea (required, min 20 characters)
   - Permanent Ban checkbox (default: unchecked for temporary ban)
5. Admin selects ban reason from dropdown.
6. Admin enters detailed explanation in ban comment field.
7. Admin decides if ban is permanent (checks checkbox if yes).
8. Admin clicks "Confirm Ban" button.
9. System validates inputs:
   - Ban reason is selected
   - Ban comment is at least 20 characters
10. System initiates database transaction:
    - Update user record: Add isBanned flag (new field or use UserFlag)
    - Create UserFlag record with type BAN and reason
    - Set bannedAt timestamp and bannedById to current admin
11. System terminates all active sessions for banned user:
    - Delete all AuthSession records for this user
    - Invalidate all refresh tokens
12. System commits transaction.
13. System sends email notification to user:
    - Subject: "Account Suspended - InterDev"
    - Body: "Your account has been suspended. Reason: [reason]. Contact support for appeal."
14. System creates audit log entry with ban details.
15. System displays success message: "User account has been banned successfully."
16. System updates user detail page showing "BANNED" status badge in red.
17. If on user list: User row shows "BANNED" badge and "Unban" button.

---

### Alternative Flows

**A.1 Unban previously banned account**

Branches from step 3 in Normal Flow.

1. Admin views user detail page for banned user.
2. System displays "BANNED" status badge in red.
3. Admin clicks "Unban Account" button.
4. System opens confirmation modal:
   - Show original ban reason and date
   - Unban Reason textarea (required)
5. Admin enters reason for unban (e.g., "Appeal approved", "Ban period ended").
6. Admin clicks "Confirm Unban" button.
7. System validates unban reason is not empty.
8. System updates user record:
   - Remove isBanned flag or set to false
   - Update or resolve UserFlag record
   - Set unbannedAt timestamp and unbannedById
9. System commits changes.
10. System sends email to user: "Account Reinstated - You can now log in."
11. System creates audit log entry with unban details.
12. System displays success message: "User account has been unbanned."
13. User detail page updates to show active status.

**A.2 Admin cancels ban action**

Branches from step 8 in Normal Flow.

1. Admin clicks "Cancel" button in confirmation modal.
2. System closes modal without making any changes.
3. System returns to user detail page or list.

**A.3 Ban reason validation fails**

Branches from step 9 in Normal Flow.

1. System detects ban reason is not selected or comment is too short.
2. System displays validation error below invalid field.
3. System keeps modal open with entered values preserved.
4. Admin corrects errors and resubmits.
5. Rejoin Normal Flow at step 9.

**A.4 User has active projects when banned**

Branches from step 10 in Normal Flow.

1. System checks if user has active projects (status IN_PROGRESS).
2. System displays warning modal:
   - "This user has X active projects. Banning will affect these projects."
   - List of affected projects shown
   - Options: "Ban Anyway" or "Cancel"
3. If admin clicks "Ban Anyway":
   - System proceeds with ban
   - Projects remain active but user cannot access them
   - Project stakeholders are notified about situation
4. If admin clicks "Cancel":
   - System returns to detail page without banning
   - Admin can resolve projects first before banning

**A.5 User tries to log in while banned**

This is a separate flow when banned user attempts login.

1. User enters email and password on login page.
2. System validates credentials are correct.
3. System checks user has isBanned flag set to true.
4. System returns 403 Forbidden with message: "Your account has been suspended. Reason: [reason]. Contact support for assistance."
5. Login is rejected and user cannot proceed.

---

### Exceptions

- **EX-01:** UserNotFoundException - User account does not exist
- **EX-02:** ForbiddenException - Admin lacks permission to ban users
- **EX-03:** ValidationException - Ban reason or comment does not meet requirements
- **EX-04:** DatabaseException - Transaction failed during ban operation, auto rollback
- **EX-05:** ConflictException - User is already banned (when banning) or already active (when unbanning)

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Occasional

---

### Business Rules

**BR-106:** Only ADMIN role can ban or unban user accounts. STAFF role cannot perform these actions.

**BR-107:** Ban reason must be selected from predefined list: Fraud, Multiple Dispute Losses, Terms Violation, Harassment, Payment Issues, Other.

**BR-108:** Ban comment is mandatory and must be at least 20 characters to ensure proper documentation.

**BR-109:** When user is banned, all active sessions are immediately terminated and refresh tokens are invalidated.

**BR-110:** Banned users cannot log in, access any pages, or perform any actions on the platform.

**BR-111:** Email notification about ban/unban must be sent to user's registered email address.

**BR-112:** Ban action creates UserFlag record with type BAN for tracking and reporting purposes.

**BR-113:** Permanent bans require additional confirmation and admin approval before execution.

**BR-114:** Unban action requires documented reason for audit trail and appeal records.

**BR-115:** Users with active projects should be warned before banning to prevent project disruption.

**BR-116:** Ban and unban actions are logged to audit_logs table with admin ID, user ID, reason, and timestamp.

---

### Other Information

- **Performance:** Ban operation must complete within 2 seconds including session termination. Database uses transaction to ensure atomicity.
- **Concurrency:** Pessimistic locking on user record during ban to prevent concurrent modifications.
- **Audit:** All ban and unban actions are logged with full details including admin ID, timestamp, and reason.
- **Notification:** Email sent immediately after ban/unban. If email service fails, ban still proceeds but notification is queued for retry.
- **Recovery:** Transaction-based operation. If ban fails, all changes are rolled back. Admin can retry safely.

---

### Assumptions

1. Admin has thoroughly investigated user violations before banning.
2. Email service is operational for sending ban notifications.
3. User account data is consistent and valid.
4. Ban appeals are handled through separate support ticket system (not in this UC).

---

**End of Use Case Specifications**
