# Use Case Specification: UC-57 View List Dispute

## 2.2 <<Feature Name: Dispute Resolution>>

### a. <<Use Case Name 5.7>>

---

## UC ID and Name

**UC-57: View List Dispute**

---

## Created By

Development Team

---

## Date Created

04/01/2026

---

## Primary Actor

Admin, Staff

---

## Secondary Actors

Client, Freelancer

---

## Description

This use case allows users to view a paginated list of disputes in the system. Admin and Staff can view all disputes with filtering and sorting capabilities. Regular users (Client/Freelancer) can only view disputes where they are directly involved as either the raiser or defendant.

---

## Trigger

1. Admin/Staff clicks on "Dispute Management" menu in the Dashboard.
2. Client/Freelancer clicks on "My Disputes" tab in their account section.

---

## Preconditions

1. User is logged in to the system.
2. User has appropriate role permission (Admin/Staff or Verified User).
3. Dispute module is active with available data.

---

## Post-conditions

1. A paginated list of disputes is displayed on screen.
2. Applied filters and sorting preferences are reflected in the results.
3. User can navigate to dispute details by clicking on any row.

---

## Normal Flow

1. User opens the Disputes page from navigation menu.
2. System verifies user login and permission.
3. System displays a table showing disputes with columns:
   - Dispute ID
   - Project Name
   - Raiser
   - Defendant
   - Category
   - Priority
   - Status
   - Created Date
   - Deadline
4. System shows 20 disputes per page by default, sorted by urgency (high priority + approaching deadline first).
5. System displays pagination controls at the bottom showing total count and page numbers.
6. User can view the list and identify disputes that need attention.
7. User can click on any dispute row to view full details.

---

## Alternative Flows

### A. Apply filters

1. User clicks on filter dropdowns above the table (Status, Category, Priority).
2. User selects desired filter values (e.g., Status = "Open", Priority = "High").
3. System updates the table to show only matching disputes.
4. System displays active filter badges with X buttons to remove them.

### B. Search disputes

1. User types keywords into the search box (project name, user name, or issue description).
2. System searches and displays matching results as user types.
3. System shows "No results found" if no matches exist.

### C. Sort the list

1. User clicks on any column header (Priority, Created Date, Deadline, Status).
2. System sorts the table by that column in ascending order.
3. User clicks again to reverse to descending order.
4. System shows an arrow icon indicating current sort direction.

### D. View overdue or urgent disputes only

1. User toggles "Show Overdue Only" or "Show Urgent Only" switch.
2. System filters to show only disputes past deadline or within 48 hours of deadline.
3. System highlights these disputes in red or orange color.

### E. Change page size

1. User clicks on page size dropdown (showing "20 per page").
2. User selects different size: 10, 50, or 100.
3. System reloads the table with selected number of items per page.

### F. Navigate pages

1. User clicks "Next", "Previous", or specific page number.
2. System loads and displays disputes for that page.
3. System updates pagination indicator to show current page.

---

## Exceptions

### EX-01: User not authenticated

1. System detects no valid login session.
2. System redirects to login page with message "Please log in to continue".

### EX-02: User lacks permission

1. System detects user role cannot access disputes.
2. System shows error: "You don't have permission to view this page".
3. System redirects to dashboard.

### EX-03: Server error or timeout

1. System cannot load data due to network/server issue.
2. System displays error toast: "Cannot load disputes. Please try again".
3. System shows a "Retry" button for user to reload.

### EX-04: No disputes found

1. System loads successfully but finds no matching disputes.
2. System displays empty state with message "No disputes found".
3. If filters are active, system shows "Clear Filters" button.

---

## Priority

**High**

---

## Frequency of Use

- **Admin/Staff:** Daily (20-30 times)
- **Regular users:** Weekly (2-5 times)

---

## Business Rules

**BR-58:** Admin and Staff roles can view all disputes in the system. Client and Freelancer roles can only view disputes where they are the raiser or defendant.

**BR-59:** Default sorting is by "urgency" which combines priority level and time remaining to resolution deadline.

**BR-60:** Maximum page size is limited to 100 disputes per page to prevent performance issues.

**BR-61:** A dispute is considered "overdue" when the resolution deadline has passed and status is not "Resolved" or "Rejected".

**BR-62:** A dispute is considered "urgent" when the resolution deadline is within 48 hours and status is "Open".

**BR-63:** Search functionality matches keywords against: project name, dispute reason, raiser name, and defendant name.

**BR-64:** Disputes with High or Critical priority must be visually highlighted with orange or red color badges.

**BR-65:** The list view shows only summary information. Full evidence files and activity history are loaded only when user opens the detail page.

---

## Other Information

- **Performance:** Query uses QueryBuilder with LEFT JOIN on raiser, defendant, and project tables. Smart sorting with computed urgency score (priority + deadline proximity). No explicit timeout but database query should complete within reasonable time.
- **Concurrency:** Multiple users can view the list simultaneously. No pessimistic locks required as this is a read-only operation.
- **Audit:** Activities logged via DisputeActivityEntity when disputes are created, updated, or resolved. List viewing itself is not logged to avoid excessive audit records.
- **Notification:** No notifications on listing. EventEmitter used for dispute creation/resolution events only.
- **Recovery:** Read-only operation with no transaction. Failed queries simply return error response without data corruption. Safe to retry immediately.

---

## Assumptions

1. The system has active disputes from ongoing projects.
2. Admin users understand dispute management procedures.
3. Users have stable internet connection.
4. Dispute, Project, and User data are properly linked in the database.

---

**End of Use Case Specification**
