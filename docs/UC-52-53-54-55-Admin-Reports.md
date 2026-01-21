# Use Case Specifications: Admin Reports & Statistics

## 2.3 <<Feature Name: Admin Reports & Statistics>>

---

## UC-52: View System Log

### UC ID and Name

**UC-52: View System Log (Audit Log)**

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

Admin views a paginated list of all system activities (audit logs) to monitor user actions, security events, and system operations. The log includes information about who performed what action, when, on which entity, and from what IP address. This feature helps Admin track system usage, investigate security incidents, and maintain compliance.

---

### Trigger

1. Admin navigates to "System Logs" or "Audit Logs" menu from admin dashboard.
2. Admin needs to investigate suspicious activity or security incident.
3. Admin needs to track specific user actions or entity changes.

---

### Preconditions

1. Admin or Staff is logged in with appropriate role.
2. Audit logs module is active and recording events.

---

### Post-conditions

1. A paginated list of audit logs is displayed with key information.
2. Admin can filter, search, and analyze system activities.
3. Admin can view detailed information about specific log entries.

---

### Normal Flow

1. Admin clicks on "System Logs" menu from admin dashboard.
2. System validates user has ADMIN or STAFF role.
3. System loads default audit log list with parameters:
   - page = 1
   - limit = 20
   - sortBy = createdAt
   - sortOrder = DESC (newest first)
4. System retrieves audit logs from database with pagination.
5. System displays audit log table with columns:
   - Timestamp (date and time)
   - Actor (user name and avatar)
   - Action (LOGIN, CREATE, UPDATE, DELETE, etc.)
   - Entity Type (User, Project, Dispute, Review, etc.)
   - Entity ID (truncated)
   - IP Address
   - Risk Level badge (LOW/NORMAL/HIGH)
6. System shows summary statistics at top:
   - Total logs today
   - Unique users active today
   - High risk actions count
7. System displays pagination controls at bottom.
8. Admin can click on any log row to view full details.

---

### Alternative Flows

**A.1 Filter by user**

Branches from step 5 in Normal Flow.

1. Admin enters user ID or email in user filter field.
2. System sends request with userId parameter.
3. System returns only logs created by that user.
4. Table updates with filtered results.
5. Filter badge shows active filter.

**A.2 Filter by action type**

Branches from step 5 in Normal Flow.

1. Admin selects action filter dropdown.
2. Admin chooses action type (LOGIN, CREATE, UPDATE, DELETE, VIEW, etc.).
3. System filters logs by exact action match.
4. System displays matching logs only.

**A.3 Filter by entity type**

Branches from step 5 in Normal Flow.

1. Admin selects entity type dropdown.
2. Admin chooses entity (User, Project, Dispute, Milestone, Review, etc.).
3. System filters logs for that entity type only.
4. Table updates with filtered results.

**A.4 Filter by date range**

Branches from step 5 in Normal Flow.

1. Admin clicks date range picker.
2. Admin selects start date (dateFrom).
3. Admin selects end date (dateTo).
4. System filters logs between dateFrom 00:00:00 and dateTo 23:59:59.
5. System displays logs within date range.

**A.5 Filter by risk level**

Branches from step 5 in Normal Flow.

1. Admin clicks risk level filter.
2. Admin selects risk level (LOW, NORMAL, HIGH).
3. System filters logs by risk level from security analysis metadata.
4. HIGH risk logs are highlighted in red/orange.
5. Table shows only logs matching selected risk level.

**A.6 Search by entity ID or keyword**

Branches from step 5 in Normal Flow.

1. Admin types keyword into search box.
2. System performs fuzzy search on action, entityType, entityId, and actor name.
3. Search results appear as admin types.
4. If no match: System shows "No logs match your search".

**A.7 View log detail**

Branches from step 8 in Normal Flow.

1. Admin clicks on log row.
2. System opens detail modal showing:
   - Full actor information (ID, name, email, avatar)
   - Action and entity details
   - Timestamp with timezone
   - IP address and user agent
   - Security analysis (risk level, suspicious flags)
   - Before data (old state) in JSON format
   - After data (new state) in JSON format
   - Metadata (additional context)
3. Admin can copy entity ID or IP address.
4. Admin can close modal to return to list.

**A.8 Export logs**

Branches from step 5 in Normal Flow.

1. Admin clicks "Export" button.
2. System asks for export format (CSV or JSON).
3. Admin confirms export.
4. System generates file with current filtered logs.
5. System downloads file to admin's computer.
6. File includes all visible columns plus metadata.

---

### Exceptions

- **EX-01:** UnauthorizedException - User is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN or STAFF
- **EX-03:** InternalServerError - Database error while loading logs
- **EX-04:** ValidationException - Invalid filter parameters or date format

---

### Priority

**High**

---

### Frequency of Use

- **Admin:** Daily
- **Staff:** Frequent

---

### Business Rules

**BR-117:** Only ADMIN and STAFF roles can view system audit logs. Regular users cannot access this feature.

**BR-118:** Audit logs are sorted by createdAt descending by default (newest logs first).

**BR-119:** Risk level is automatically calculated based on action type: LOW (VIEW, EXPORT, LIST), NORMAL (CREATE, UPDATE), HIGH (DELETE, LOGIN, BAN, WITHDRAW).

**BR-120:** High risk actions include DELETE, LOGIN, CHANGE_PASSWORD, BAN_USER, RESOLVE_DISPUTE, APPROVE_WITHDRAWAL, UPDATE_SENSITIVE_DATA.

**BR-121:** Suspicious activities (bot user agents, new IP addresses) automatically elevate risk level to HIGH.

**BR-122:** Before data and after data show complete state snapshots for auditing purposes.

**BR-123:** Security analysis metadata includes: risk level, suspicious flags, bot detection, IP change detection.

**BR-124:** Logs are immutable once created. They cannot be edited or deleted by users.

**BR-125:** Date range filter includes entire day: dateFrom at 00:00:00 and dateTo at 23:59:59.

**BR-126:** Maximum page size is 100 logs to prevent performance issues.

**BR-127:** Export functionality respects current active filters and includes only visible data.

---

### Other Information

- **Performance:** Audit log queries should complete within 2 seconds. Uses database indexing on actorId, createdAt, entityType, and action fields.
- **Concurrency:** Multiple admins can view logs simultaneously without conflicts. Read-only operation.
- **Audit:** Viewing audit logs is not logged to prevent log recursion. Only export actions are logged.
- **Notification:** No notifications triggered by viewing audit logs.
- **Recovery:** Read-only operation. Failed queries can be retried without side effects.
- **Security:** IP address and user agent are captured for security analysis. Sensitive data in before/after snapshots are not masked.

---

### Assumptions

1. All system actions are properly logged via AuditLogsService.
2. Database has proper indexes for fast querying on large log tables.
3. Admin understands risk level meanings and security flags.
4. Logs are retained according to compliance requirements (e.g., 90 days minimum).

---

## UC-53: View Statistic Admin Dashboard

### UC ID and Name

**UC-53: View Statistic Admin Dashboard**

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

Admin views a comprehensive statistics dashboard showing key metrics and insights about platform activities. The dashboard displays aggregate data about users, projects, disputes, warnings, financial transactions, and system health. This provides Admin with a quick overview of platform status and helps identify trends or issues requiring attention.

---

### Trigger

1. Admin logs in and lands on admin dashboard (default landing page).
2. Admin clicks "Dashboard" menu from sidebar.

---

### Preconditions

1. Admin or Staff is logged in with appropriate role.
2. System has collected sufficient data for statistics calculation.

---

### Post-conditions

1. Dashboard displays current statistics with visual charts and numbers.
2. Admin can see trends and identify issues requiring attention.
3. Admin can click on specific metrics to drill down into details.

---

### Normal Flow

1. Admin navigates to admin dashboard page.
2. System validates user has ADMIN or STAFF role.
3. System loads statistics from multiple modules in parallel:
   - Dispute statistics (byStatus, byPriority, overdue, urgent)
   - User warning statistics (totalActive, totalAppealed, bySeverity, byType)
   - User statistics (total users, new users this month, by role, by badge)
   - Project statistics (total projects, in progress, completed, by status)
   - Financial statistics (total deposits, withdrawals, escrow held, platform revenue)
   - System health (audit log count today, active sessions, error rate)
4. System displays dashboard with sections:
   - Overview Cards: Total Users, Active Projects, Open Disputes, Platform Revenue
   - Dispute Metrics: Pie chart by status, bar chart by priority, overdue/urgent counts
   - User Warning Metrics: Active flags count, severity distribution, flag types breakdown
   - Financial Metrics: Total wallet balance, escrow held, withdrawals pending
   - Recent Activities: Last 10 audit logs (quick view)
   - System Health: Server status, database status, error logs count
5. Each metric card shows:
   - Current value (large number)
   - Trend indicator (up/down arrow with percentage)
   - Sparkline chart (last 7 days trend)
6. System auto-refreshes dashboard every 60 seconds.
7. Admin can click on any metric card to navigate to detailed view.

---

### Alternative Flows

**A.1 View dispute statistics detail**

Branches from step 4 in Normal Flow.

1. Admin clicks on "Disputes" metric card.
2. System displays detailed dispute statistics:
   - Count by status: OPEN, IN_MEDIATION, RESOLVED, REJECTED, APPEALED
   - Count by priority: LOW, MEDIUM, HIGH, CRITICAL
   - Overdue disputes count (past resolution deadline)
   - Urgent disputes count (deadline within 48 hours)
3. System shows bar chart for visual representation.
4. Admin can click "View All Disputes" to navigate to UC-57.

**A.2 View user warning statistics detail**

Branches from step 4 in Normal Flow.

1. Admin clicks on "User Warnings" metric card.
2. System displays detailed warning statistics:
   - Total active flags
   - Total appealed flags
   - Count by severity: LOW, MEDIUM, HIGH, CRITICAL
   - Count by type: MULTIPLE_DISPUTES_LOST, HIGH_DISPUTE_LOSS_RATE, LATE_DELIVERY_PATTERN, etc.
3. System shows pie chart for severity distribution.
4. Admin can click "View All Flags" to navigate to user warnings page.

**A.3 View financial statistics detail**

Branches from step 4 in Normal Flow.

1. Admin clicks on "Financial Overview" card.
2. System displays detailed financial data:
   - Total platform revenue (fees collected)
   - Total deposits by all users
   - Total withdrawals processed
   - Total escrow held (locked in active projects)
   - Pending withdrawal requests count
3. System shows line chart of revenue over last 30 days.
4. Admin can click "View Financial Report" to navigate to UC-55.

**A.4 View user statistics detail**

Branches from step 4 in Normal Flow.

1. Admin clicks on "Users" metric card.
2. System displays user statistics:
   - Total users count
   - New users this month
   - Count by role: CLIENT, FREELANCER, BROKER, STAFF, ADMIN
   - Count by badge: NEW, VERIFIED, TRUSTED, WARNING
   - Active users today
3. System shows stacked bar chart for role distribution.
4. Admin can click "Manage Users" to navigate to UC-49.

**A.5 Filter dashboard by date range**

Branches from step 3 in Normal Flow.

1. Admin clicks date range selector at top of dashboard.
2. Admin selects time period: Today, Last 7 Days, Last 30 Days, Last 90 Days, Custom Range.
3. If Custom Range: Admin picks start and end dates.
4. System reloads all statistics filtered by selected date range.
5. Dashboard updates with filtered data.
6. Trend indicators compare to previous equivalent period.

**A.6 Manual refresh**

Branches from step 6 in Normal Flow.

1. Admin clicks "Refresh" button.
2. System immediately reloads all statistics.
3. Loading spinner shows for each metric card.
4. Dashboard updates with latest data.
5. Last updated timestamp updates.

**A.7 Export dashboard report**

Branches from step 4 in Normal Flow.

1. Admin clicks "Export Report" button.
2. System asks for format: PDF or Excel.
3. Admin confirms export.
4. System generates comprehensive report including:
   - All metric values
   - Charts as images
   - Date range and timestamp
   - Admin name and export time
5. System downloads file to admin's computer.

---

### Exceptions

- **EX-01:** UnauthorizedException - User is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN or STAFF
- **EX-03:** InternalServerError - Database error while calculating statistics
- **EX-04:** TimeoutException - Statistics query taking too long, partial data shown
- **EX-05:** DataInconsistencyException - Statistics mismatch detected, cache invalidated

---

### Priority

**Critical**

---

### Frequency of Use

- **Admin:** Multiple times per day
- **Staff:** Daily

---

### Business Rules

**BR-128:** Only ADMIN and STAFF roles can view admin dashboard statistics.

**BR-129:** Dashboard auto-refreshes every 60 seconds to show near real-time data.

**BR-130:** Dispute statistics include: byStatus counts, byPriority counts, overdue count, urgent count (deadline within 48 hours).

**BR-131:** User warning statistics include: totalActive flags, totalAppealed flags, distribution by severity, distribution by type.

**BR-132:** Financial statistics aggregate data from WalletEntity and TransactionEntity tables.

**BR-133:** Trend indicators compare current period to previous equivalent period (e.g., this month vs last month).

**BR-134:** Overdue disputes are those with resolutionDeadline less than current time and status not RESOLVED or REJECTED.

**BR-135:** Urgent disputes have resolutionDeadline within next 48 hours (URGENT_THRESHOLD_HOURS = 48).

**BR-136:** Statistics are cached for 5 minutes to improve performance. Manual refresh bypasses cache.

**BR-137:** If statistics query exceeds 5 seconds timeout, system shows partial data with warning message.

**BR-138:** Platform revenue equals sum of all FEE_DEDUCTION transactions with status COMPLETED.

---

### Other Information

- **Performance:** Dashboard must load within 3 seconds for good UX. Statistics queries run in parallel for faster loading.
- **Concurrency:** Multiple admins viewing dashboard simultaneously share cached statistics.
- **Audit:** Dashboard views are not logged. Only export actions are logged to audit_logs.
- **Notification:** No notifications triggered by viewing dashboard.
- **Recovery:** If statistics calculation fails, system shows last cached values with "stale data" warning.
- **Caching:** Statistics cached for 5 minutes using Redis. Cache key includes date range parameters.

---

### Assumptions

1. Database has proper indexes for efficient aggregate queries.
2. Statistics calculation completes within reasonable time even with large datasets.
3. Admin understands metric meanings and trend indicators.
4. System has sufficient resources to handle parallel statistics queries.

---

## UC-54: View Subscription Report

### UC ID and Name

**UC-54: View Subscription Report**

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

Admin views detailed reports about user subscriptions and pricing packages on the platform. This includes statistics about subscription plans, user distribution across plans, revenue from subscriptions, renewal rates, and churn analysis. The report helps Admin understand subscription business performance and make data-driven decisions about pricing strategy.

---

### Trigger

1. Admin clicks on "Subscription Report" or "Plans & Packages" menu in admin dashboard.
2. Admin needs to analyze subscription performance for business review.

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. Platform has subscription/pricing system implemented.
3. Subscription data exists in database.

---

### Post-conditions

1. Comprehensive subscription report is displayed with metrics and charts.
2. Admin can analyze subscription trends and performance.
3. Admin can export report for further analysis.

---

### Normal Flow

1. Admin navigates to Subscription Report page from admin menu.
2. System validates user has ADMIN role.
3. System loads default report with date range: Last 30 Days.
4. System calculates subscription metrics:
   - Total active subscriptions
   - New subscriptions this period
   - Cancelled subscriptions this period
   - Renewal rate percentage
   - Churn rate percentage
   - Average revenue per user (ARPU)
   - Monthly recurring revenue (MRR)
5. System retrieves subscription plan data:
   - Count of users per plan (Free, Basic, Pro, Enterprise)
   - Revenue per plan
   - Most popular plan
   - Plan upgrade/downgrade counts
6. System displays report with sections:
   - Overview Cards: Active Subscriptions, MRR, ARPU, Churn Rate
   - Plan Distribution: Pie chart showing users per plan
   - Revenue by Plan: Bar chart showing revenue per plan
   - Subscription Trends: Line chart of new/cancelled subscriptions over time
   - Renewal Analysis: Renewal rate by plan
   - Churn Analysis: Reasons for cancellation breakdown
7. System shows data table with columns:
   - Plan Name
   - Active Users
   - New This Month
   - Cancelled This Month
   - Revenue This Month
   - Renewal Rate
8. Admin can interact with charts (hover, zoom, filter).

---

### Alternative Flows

**A.1 Filter by date range**

Branches from step 3 in Normal Flow.

1. Admin clicks date range selector.
2. Admin selects time period: Last 7 Days, Last 30 Days, Last 90 Days, This Year, Custom Range.
3. If Custom Range: Admin picks start and end dates.
4. System recalculates all metrics for selected period.
5. Report updates with filtered data.
6. Comparison shows change vs previous period.

**A.2 Filter by subscription plan**

Branches from step 6 in Normal Flow.

1. Admin selects plan filter dropdown.
2. Admin chooses specific plan (Free, Basic, Pro, Enterprise) or "All Plans".
3. System filters report to show only selected plan data.
4. Charts and metrics update to show plan-specific data.

**A.3 View user list by plan**

Branches from step 7 in Normal Flow.

1. Admin clicks on plan name in data table.
2. System displays list of users subscribed to that plan:
   - User name and email
   - Subscription start date
   - Next renewal date
   - Payment status (Active, Overdue, Cancelled)
3. Admin can search or filter user list.
4. Admin can click user to view full profile (UC-50).

**A.4 View renewal details**

Branches from step 6 in Normal Flow.

1. Admin clicks on "Renewal Analysis" section.
2. System displays detailed renewal metrics:
   - Total renewals this period
   - Renewal rate by plan
   - Average days to renewal
   - Failed renewal count and reasons
3. System shows list of upcoming renewals (next 30 days).
4. Admin can see which users have payment failures.

**A.5 View churn analysis**

Branches from step 6 in Normal Flow.

1. Admin clicks on "Churn Analysis" section.
2. System displays churn details:
   - Total churn count and rate
   - Churn by plan
   - Reasons for cancellation (survey data)
   - Average subscription lifetime
3. System shows list of recently cancelled users.
4. Admin can identify patterns in cancellation reasons.

**A.6 Export subscription report**

Branches from step 6 in Normal Flow.

1. Admin clicks "Export Report" button.
2. System asks for format: PDF, Excel, or CSV.
3. Admin confirms export.
4. System generates report file including:
   - All metrics and statistics
   - Charts as images (for PDF)
   - Data tables with all rows
   - Date range and timestamp
5. System downloads file to admin's computer.

**A.7 View revenue forecast**

Branches from step 4 in Normal Flow.

1. Admin clicks "Revenue Forecast" tab.
2. System calculates projected MRR based on:
   - Current active subscriptions
   - Historical renewal rates
   - Seasonal trends
3. System displays forecast chart for next 6 months.
4. System shows confidence intervals and assumptions.

---

### Exceptions

- **EX-01:** UnauthorizedException - Admin is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN
- **EX-03:** InternalServerError - Database error while calculating subscription metrics
- **EX-04:** NoDataException - No subscription data available for selected period
- **EX-05:** FeatureNotImplementedException - Subscription system not yet deployed

---

### Priority

**Medium**

---

### Frequency of Use

- **Admin:** Weekly

---

### Business Rules

**BR-139:** Only ADMIN role can view subscription reports. STAFF role does not have access.

**BR-140:** Subscription report includes only paying plans (Free plan shown separately for comparison).

**BR-141:** Active subscriptions are those with status ACTIVE and nextBillingDate in the future.

**BR-142:** Churn rate calculated as: (Cancelled Subscriptions / Total Subscriptions at Start of Period) × 100%.

**BR-143:** Renewal rate calculated as: (Successful Renewals / Total Renewal Attempts) × 100%.

**BR-144:** ARPU (Average Revenue Per User) = Total Revenue / Total Active Subscriptions.

**BR-145:** MRR (Monthly Recurring Revenue) = Sum of all active subscription monthly prices.

**BR-146:** Plan upgrades are when user moves to higher-priced plan. Downgrades are to lower-priced plan.

**BR-147:** Cancelled subscriptions remain active until end of current billing period.

**BR-148:** Revenue metrics include only COMPLETED transactions. PENDING or FAILED not counted.

**BR-149:** Subscription data aggregated by calendar month for monthly reports.

---

### Other Information

- **Performance:** Subscription report queries should complete within 3 seconds. Uses database views for pre-aggregated data.
- **Concurrency:** Multiple admins can view report simultaneously. Data is read-only.
- **Audit:** Viewing subscription report is not logged. Only export actions logged.
- **Notification:** No notifications triggered by viewing reports.
- **Recovery:** If calculation fails, system shows partial data with error notice.
- **Note:** This feature depends on subscription module implementation. If subscription system is not yet built, system shows "Coming Soon" placeholder.

---

### Assumptions

1. Platform has subscription/pricing system with plans and billing cycles.
2. Subscription data is properly tracked in database (SubscriptionEntity table).
3. Payment transactions are linked to subscriptions for revenue tracking.
4. Admin understands subscription business metrics (MRR, ARPU, Churn Rate).
5. If subscription system not implemented, this UC serves as specification for future development.

---

## UC-55: View Financial Report

### UC ID and Name

**UC-55: View Financial Report**

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

Admin views comprehensive financial reports showing all money flows on the platform. This includes deposits, withdrawals, escrow transactions, platform fees, refunds, and revenue analysis. The report provides Admin with complete financial visibility to monitor platform financial health, detect anomalies, and prepare financial statements.

---

### Trigger

1. Admin clicks on "Financial Report" or "Transactions" menu in admin dashboard.
2. Admin needs to review financial data for accounting or audit purposes.
3. Admin needs to analyze revenue trends and transaction patterns.

---

### Preconditions

1. Admin is logged in with ADMIN role.
2. Financial transactions are recorded in database (WalletEntity and TransactionEntity).
3. Platform has payment processing enabled.

---

### Post-conditions

1. Comprehensive financial report is displayed with all transaction data.
2. Admin can analyze financial performance and identify issues.
3. Admin can export report for accounting or audit purposes.

---

### Normal Flow

1. Admin navigates to Financial Report page from admin menu.
2. System validates user has ADMIN role.
3. System loads default report with date range: Current Month.
4. System calculates financial metrics from TransactionEntity and WalletEntity:
   - Total deposits (TransactionType.DEPOSIT, status COMPLETED)
   - Total withdrawals (TransactionType.WITHDRAWAL, status COMPLETED)
   - Total escrow held (sum of WalletEntity.heldBalance)
   - Total platform fees collected (TransactionType.FEE_DEDUCTION)
   - Total refunds issued (TransactionType.REFUND)
   - Net revenue (fees - refunds - operational costs)
5. System retrieves transaction statistics:
   - Transaction count by type
   - Transaction volume by status (PENDING, COMPLETED, FAILED)
   - Average transaction amount
   - Payment method distribution (BANK_TRANSFER, MOMO, VNPAY)
6. System displays report with sections:
   - Overview Cards: Total Revenue, Total Deposits, Total Withdrawals, Escrow Held
   - Transaction Volume: Line chart showing daily transaction volume
   - Revenue Breakdown: Pie chart of revenue sources (project fees, withdrawal fees, etc.)
   - Transaction by Type: Bar chart (DEPOSIT, WITHDRAWAL, ESCROW_HOLD, ESCROW_RELEASE, REFUND, FEE_DEDUCTION)
   - Payment Method Analysis: Distribution of payment methods used
   - Transaction Status: Pending/Processing/Completed/Failed counts
   - Top Users by Transaction Volume: Table showing users with most transaction activity
7. System shows detailed transaction table with columns:
   - Transaction ID (truncated)
   - Date & Time
   - User (name)
   - Type (DEPOSIT, WITHDRAWAL, etc.)
   - Amount
   - Fee
   - Status
   - Payment Method
8. System shows current platform wallet summary:
   - Total user balance (sum of all WalletEntity.balance)
   - Total pending balance (sum of WalletEntity.pendingBalance)
   - Total held balance (sum of WalletEntity.heldBalance)
   - Platform reserve (system wallet balance)
9. Admin can sort and filter transaction table.

---

### Alternative Flows

**A.1 Filter by date range**

Branches from step 3 in Normal Flow.

1. Admin clicks date range selector.
2. Admin selects time period: Today, This Week, This Month, Last Month, This Quarter, This Year, Custom Range.
3. If Custom Range: Admin picks start and end dates.
4. System recalculates all financial metrics for selected period.
5. Report updates with filtered data.
6. Comparison shows change vs previous equivalent period.

**A.2 Filter by transaction type**

Branches from step 7 in Normal Flow.

1. Admin selects transaction type filter dropdown.
2. Admin chooses type: DEPOSIT, WITHDRAWAL, ESCROW_HOLD, ESCROW_RELEASE, REFUND, FEE_DEDUCTION, or "All Types".
3. System filters transactions to show only selected type.
4. Metrics and charts update to reflect filtered data.
5. Transaction table shows only matching rows.

**A.3 Filter by transaction status**

Branches from step 7 in Normal Flow.

1. Admin selects status filter dropdown.
2. Admin chooses status: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, or "All Statuses".
3. System filters transactions by status.
4. Table and charts update accordingly.

**A.4 Filter by payment method**

Branches from step 7 in Normal Flow.

1. Admin selects payment method filter.
2. Admin chooses method: BANK_TRANSFER, MOMO, VNPAY, or "All Methods".
3. System shows transactions using that payment method only.
4. Payment method analysis chart highlights selected method.

**A.5 Search for specific transaction**

Branches from step 7 in Normal Flow.

1. Admin enters search keywords in search box.
2. System performs search on:
   - Transaction ID
   - User name or email
   - External transaction ID
   - Description
3. System displays matching transactions.
4. If no match: System shows "No transactions found".

**A.6 View transaction detail**

Branches from step 7 in Normal Flow.

1. Admin clicks on transaction row.
2. System opens detail modal showing:
   - Complete transaction information
   - User details (name, email, wallet ID)
   - Amount, fee, net amount
   - Payment method and external ID
   - Reference entity (Project, Escrow, PayoutRequest)
   - Metadata (JSON object with additional details)
   - IP address and initiator
   - Timestamps (created, completed)
   - Balance after transaction
   - Related transactions (for ESCROW_HOLD ↔ ESCROW_RELEASE pairs)
3. Admin can copy transaction ID or view related entity.
4. Admin can click "View User Wallet" to see user's full wallet.

**A.7 View failed transactions**

Branches from step 6 in Normal Flow.

1. Admin clicks on "Failed Transactions" quick link.
2. System filters to show only FAILED status transactions.
3. System displays failure reason for each failed transaction.
4. Admin can see patterns in failures (e.g., insufficient balance, payment gateway error).
5. Admin can manually retry or cancel failed transactions if applicable.

**A.8 Export financial report**

Branches from step 6 in Normal Flow.

1. Admin clicks "Export Report" button.
2. System asks for format: PDF (summary), Excel (detailed), or CSV (raw data).
3. Admin confirms export.
4. System generates report file including:
   - All financial metrics
   - Charts as images (for PDF)
   - Complete transaction table (for Excel/CSV)
   - Date range and timestamp
   - Admin name and export time
5. System downloads file to admin's computer.
6. Export action is logged to audit_logs.

**A.9 Reconcile wallet balances**

Branches from step 8 in Normal Flow.

1. Admin clicks "Reconcile Wallets" button.
2. System performs reconciliation check:
   - Recalculates each user's wallet balance from transaction history
   - Compares with current WalletEntity.balance
   - Identifies discrepancies
3. System displays reconciliation report:
   - Total wallets checked
   - Discrepancies found (count)
   - List of wallets with mismatches
4. If discrepancies found: System alerts admin to investigate.
5. Admin can trigger automatic fix or manually adjust wallets.

**A.10 View user wallet detail**

Branches from step 9 in Normal Flow.

1. Admin clicks on user from "Top Users" table.
2. System displays user's wallet details:
   - Current balance breakdown (available, pending, held)
   - Total deposited, withdrawn, earned, spent
   - Transaction history (paginated)
   - Active escrows (money currently held)
3. Admin can see all transactions for that user.
4. Admin can manually adjust wallet if necessary (with reason).

---

### Exceptions

- **EX-01:** UnauthorizedException - Admin is not logged in or token expired
- **EX-02:** ForbiddenException - User role is not ADMIN
- **EX-03:** InternalServerError - Database error while calculating financial metrics
- **EX-04:** ReconciliationException - Wallet balance mismatch detected during reconciliation
- **EX-05:** DataCorruptionException - Transaction data inconsistency found

---

### Priority

**Critical**

---

### Frequency of Use

- **Admin:** Daily

---

### Business Rules

**BR-150:** Only ADMIN role can view financial reports. STAFF role does not have access to financial data.

**BR-151:** Financial metrics include only COMPLETED transactions. PENDING, PROCESSING, FAILED, CANCELLED excluded from revenue calculations.

**BR-152:** Platform revenue equals sum of all FEE_DEDUCTION transactions with status COMPLETED.

**BR-153:** Total deposits calculated from TransactionType.DEPOSIT with status COMPLETED.

**BR-154:** Total withdrawals calculated from TransactionType.WITHDRAWAL with status COMPLETED.

**BR-155:** Total escrow held equals sum of all WalletEntity.heldBalance across all users.

**BR-156:** Net revenue = Total fees - Total refunds - Operational costs (if tracked).

**BR-157:** Wallet reconciliation compares WalletEntity.balance with sum of all COMPLETED transactions for that wallet.

**BR-158:** Transaction table sorted by createdAt descending by default (newest first).

**BR-159:** Currency is VND by default. All amounts displayed in VND format (e.g., 1,000,000₫).

**BR-160:** Payment method statistics show distribution: BANK_TRANSFER, MOMO, VNPAY, and others.

**BR-161:** Failed transactions must include failureReason in description field for troubleshooting.

**BR-162:** Balance after transaction (balanceAfter field) provides audit trail for each transaction.

**BR-163:** Related transactions (relatedTransactionId) link paired operations like ESCROW_HOLD with ESCROW_RELEASE.

**BR-164:** External transaction ID (externalTransactionId) links to payment gateway for reconciliation.

**BR-165:** Financial report export is logged to audit_logs with action EXPORT_FINANCIAL_REPORT.

**BR-166:** Manual wallet adjustments require admin comment explaining reason for change.

---

### Other Information

- **Performance:** Financial report queries should complete within 3 seconds. Uses database materialized views for aggregate calculations.
- **Concurrency:** Multiple admins can view report simultaneously. Data is read-only except for reconciliation actions.
- **Audit:** All financial report exports and manual wallet adjustments are logged to audit_logs for compliance.
- **Notification:** No notifications triggered by viewing reports. Critical discrepancies during reconciliation send email alert to admin.
- **Recovery:** If metrics calculation fails, system shows last cached values with "stale data" warning. Admin can force refresh.
- **Security:** Financial data is highly sensitive. Access restricted to ADMIN only. All views logged.
- **Compliance:** Financial reports support accounting requirements and audit trails.

---

### Assumptions

1. All financial transactions are properly recorded in TransactionEntity table.
2. Wallet balances in WalletEntity are kept in sync with transactions.
3. Payment gateway integrations provide reliable transaction status updates.
4. Database has proper indexes for fast aggregation of financial data.
5. Admin understands financial metrics and transaction types.
6. System maintains accuracy in wallet balance calculations.

---

**End of Use Case Specifications**
