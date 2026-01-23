# Use Case Specification: UC-59 Resolve Dispute

## 2.2 <<Feature Name: Dispute Resolution>>

### a. <<Use Case Name 5.9>>

---

## UC ID and Name

**UC-59: Resolve Dispute**

---

## Created By

BangDC

---

## Date Created

04/01/2026

---

## Primary Actor

Admin

---

## Secondary Actors

N/A

---

## Description

Admin reviews evidence from both parties and makes a final verdict to resolve the dispute. The system automatically processes money transfers according to the verdict, updates project and milestone status, applies penalties to the losing party, and notifies all involved parties.

---

## Trigger

1. Admin opens a dispute detail page (UC-58) with status "IN_MEDIATION".
2. Admin reviews all evidence and decides on a verdict.
3. Admin clicks the "Resolve Dispute" button.

---

## Preconditions

1. Admin is logged in with ADMIN role.
2. Dispute status must be "IN_MEDIATION".
3. Related Escrow must be in "DISPUTED" status.
4. Both raiser and defendant have provided evidence or responses.

---

## Post-conditions

1. Dispute status changes to "RESOLVED".
2. Money is distributed according to verdict (refund to client or release to freelancer).
3. Project and Milestone status are updated based on verdict.
4. Trust score of the losing party is decreased.
5. Transaction records are created in wallet history.
6. Audit log entries are created for all actions.
7. Real-time notifications are sent to raiser, defendant, and broker.

---

## Normal Flow

1. Admin navigates to Dispute Detail page from dispute list (UC-57).
2. System displays dispute information including:
   - Raiser's reason and evidence files
   - Defendant's response and evidence files
   - Disputed amount
   - Project name and milestone details
   - Current status and deadlines
3. Admin reviews all information carefully.
4. Admin clicks "Resolve Dispute" button.
5. System opens resolution modal with form fields:
   - Verdict dropdown (WIN_CLIENT, WIN_FREELANCER, SPLIT)
   - Admin Comment textarea (required)
   - Split Ratio input (only visible if verdict = SPLIT)
6. Admin selects verdict "WIN_CLIENT" or "WIN_FREELANCER".
7. Admin enters reason for verdict in admin comment field.
8. Admin clicks "Submit Resolution" button.
9. System validates input:
   - Verdict is valid enum value
   - Admin comment is not empty
   - Dispute status is IN_MEDIATION
   - Escrow status is DISPUTED
10. System initiates database transaction with pessimistic locking:
    - Lock Dispute record
    - Lock Escrow record
    - Lock Project and Milestone records
    - Lock Wallet records of client, freelancer, broker
11. System updates Dispute record:
    - status = RESOLVED
    - result = selected verdict
    - adminComment = entered comment
    - resolvedById = current admin's userId
    - resolvedAt = current timestamp
12. System calculates money distribution based on verdict:
    - If WIN_CLIENT: Full refund to client's wallet
    - If WIN_FREELANCER: Release funds to freelancer and broker according to escrow percentages
13. System executes wallet transactions:
    - Update client wallet: Decrease heldBalance, increase balance (if WIN_CLIENT)
    - Update freelancer wallet: Decrease heldBalance, increase balance and totalEarned (if WIN_FREELANCER)
    - Update broker wallet: Increase balance and totalEarned (if WIN_FREELANCER)
    - Create Transaction records for each wallet change
14. System updates Escrow status:
    - REFUNDED if verdict is WIN_CLIENT
    - RELEASED if verdict is WIN_FREELANCER
15. System updates Project status:
    - CANCELED if verdict is WIN_CLIENT
    - COMPLETED if verdict is WIN_FREELANCER
16. System updates Milestone status:
    - PENDING if verdict is WIN_CLIENT (milestone not paid)
    - PAID if verdict is WIN_FREELANCER (milestone paid out)
17. System identifies the losing party:
    - If WIN_CLIENT: Loser is freelancer
    - If WIN_FREELANCER: Loser is client
18. System increments totalDisputesLost counter for the losing user.
19. System commits transaction.
20. System triggers async operations (not blocking):
    - Recalculate trust score for losing party
    - Check if user needs warning flag (3+ disputes lost)
21. System creates audit log entry with all resolution details.
22. System emits event for notifications:
    - Notify raiser about resolution
    - Notify defendant about resolution
    - Notify broker about project status change
23. System displays success message: "Dispute resolved successfully. Verdict: [verdict]. Notifications sent."
24. System refreshes dispute detail page showing RESOLVED status and verdict details.

---

## Alternative Flows

**A.1 Resolve dispute with SPLIT verdict**

Branches from step 6 in Normal Flow.

1. Admin selects verdict "SPLIT" from dropdown.
2. System displays additional field "Split Ratio for Client (%)".
3. Admin enters split ratio value (0-100, default 50).
4. Admin enters admin comment explaining split decision.
5. Admin clicks "Submit Resolution".
6. System validates split ratio is between 0 and 100.
7. System calculates split distribution:
   - Client portion = totalAmount × (splitRatio / 100)
   - Freelancer portion = totalAmount × (1 - splitRatio / 100)
   - Broker commission = Freelancer portion × (broker commission rate)
   - Freelancer net = Freelancer portion - Broker commission
8. System uses largest remainder method to prevent rounding errors.
9. System executes partial refund to client and partial release to freelancer and broker.
10. System updates Escrow status to RELEASED.
11. System updates Project status to COMPLETED.
12. System updates Milestone status to PAID.
13. Both parties are marked as partial losers (smaller penalty for split decisions).
14. Rejoin Normal Flow at step 19.

**A.2 Admin cancels resolution**

Branches from step 8 in Normal Flow.

1. Admin clicks "Cancel" button in resolution modal.
2. System closes modal without saving any changes.
3. System returns to dispute detail page in view mode.

**A.3 Validation error on form submission**

Branches from step 9 in Normal Flow.

1. System detects validation error (empty comment or invalid verdict).
2. System displays error message below the invalid field.
3. System keeps modal open with entered values preserved.
4. Admin corrects the error and resubmits.
5. Rejoin Normal Flow at step 9.

**A.4 Dispute status is not IN_MEDIATION**

Branches from step 9 in Normal Flow.

1. System checks dispute status and finds it is not IN_MEDIATION.
2. System returns error: "Cannot resolve dispute. Status must be IN_MEDIATION."
3. System closes modal and refreshes page.
4. System displays warning message: "This dispute cannot be resolved in its current state."

**A.5 Escrow status mismatch**

Branches from step 9 in Normal Flow.

1. System checks escrow status and finds it is not DISPUTED.
2. System returns error: "Escrow status mismatch. Expected DISPUTED but found [actual status]."
3. System logs critical error for investigation.
4. System displays error message to admin: "Data inconsistency detected. Please contact technical support."

**A.6 Wallet not found or insufficient balance**

Branches from step 13 in Normal Flow.

1. System attempts to update wallet but wallet record does not exist.
2. Transaction fails and system rolls back all changes.
3. System logs critical error with userId and disputeId.
4. System displays error: "Wallet not found for user. Resolution failed. Please escalate to technical team."
5. Dispute remains in IN_MEDIATION status.

**A.7 Database transaction fails**

Branches from any step between 10-19 in Normal Flow.

1. System encounters database error during transaction.
2. System automatically rolls back all changes made in transaction.
3. System logs full error stack trace.
4. System displays error message: "Failed to resolve dispute due to server error. Please try again."
5. Admin can retry resolution from step 4.

**A.8 Trust score calculation fails**

Branches from step 20 in Normal Flow.

1. Trust score service is unavailable or calculation fails.
2. System logs error but continues with resolution (transaction already committed).
3. System schedules retry for trust score calculation after 5 minutes.
4. Admin receives notification about failed trust score update.
5. Resolution is still successful, only trust score update is deferred.

**A.9 Concurrent modification detected**

Branches from step 10 in Normal Flow.

1. System attempts to lock dispute but finds it is already locked by another admin.
2. System returns error: "Another admin is currently resolving this dispute."
3. System displays message: "Please wait and refresh the page to check current status."
4. Admin must wait for other admin to complete or timeout.

---

## Exceptions

### EX-01: Dispute not found

1. System queries database for dispute ID but record does not exist.
2. System returns 404 Not Found.
3. System displays error: "Dispute not found. It may have been deleted."
4. System redirects admin to dispute list page.

### EX-02: Invalid verdict value

1. System validates verdict enum and finds invalid value.
2. System returns 400 Bad Request with validation error.
3. System displays: "Invalid verdict selected. Please choose WIN_CLIENT, WIN_FREELANCER, or SPLIT."

### EX-03: Admin comment is empty

1. System validates admin comment field and finds it empty or whitespace only.
2. System returns validation error.
3. System displays: "Admin comment is required. Please provide reason for your verdict."
4. Form field is highlighted in red.

### EX-04: Admin lacks permission

1. System checks user role and finds user is not ADMIN.
2. System returns 403 Forbidden.
3. System displays: "You do not have permission to resolve disputes."
4. System logs unauthorized access attempt.

### EX-05: Database connection lost

1. System loses connection to database during transaction.
2. Transaction timeout occurs (30 seconds).
3. System automatically rolls back.
4. System displays: "Connection lost. Your changes were not saved. Please try again."

---

## Priority

**High**

---

## Frequency of Use

- **Admin:** Multiple times per day (depending on dispute volume)
- **Typical scenario:** 5-10 dispute resolutions per day in active system

---

## Business Rules

**BR-75:** Only users with ADMIN role can resolve disputes. STAFF role can only view and add notes.

**BR-76:** Dispute must be in IN_MEDIATION status to be resolved. Disputes in OPEN, RESOLVED, REJECTED, or APPEALED status cannot be resolved via this flow.

**BR-77:** Admin comment is mandatory for all resolutions. Minimum length is 10 characters to ensure meaningful explanation.

**BR-78:** All resolution operations must use database transaction with pessimistic locking to prevent concurrent modifications.

**BR-79:** Money distribution must be calculated atomically. Total distributed amount must exactly equal escrow totalAmount (no rounding loss).

**BR-80:** For WIN_CLIENT verdict: Full escrow amount is refunded to client's wallet. heldBalance decreases, balance increases.

**BR-81:** For WIN_FREELANCER verdict: Funds are released to freelancer and broker according to escrow split percentages. heldBalance decreases, balance and totalEarned increase.

**BR-82:** For SPLIT verdict: Split ratio must be between 0 and 100 inclusive. Client receives splitRatio percent, freelancer receives remainder minus broker commission.

**BR-83:** Losing party's totalDisputesLost counter is incremented. If counter reaches 3 or more, user is flagged for review.

**BR-84:** Trust score recalculation for losing party is triggered asynchronously. If it fails, system retries automatically without failing the resolution.

**BR-85:** Transaction records are created for all wallet changes with type REFUND or RELEASE and status COMPLETED.

**BR-86:** Escrow status transitions: DISPUTED to REFUNDED (if WIN_CLIENT) or RELEASED (if WIN_FREELANCER or SPLIT).

**BR-87:** Project status transitions: DISPUTED to CANCELED (if WIN_CLIENT) or COMPLETED (if WIN_FREELANCER or SPLIT).

**BR-88:** Milestone status transitions: LOCKED to PENDING (if WIN_CLIENT) or PAID (if WIN_FREELANCER or SPLIT).

**BR-89:** Once a dispute is resolved, it cannot be re-resolved. Admin must appeal process to challenge resolution.

**BR-90:** Real-time notifications are sent to raiser, defendant, and broker immediately after transaction commit.

---

## Other Information

- **Performance:** Resolution must complete within 5 seconds excluding async operations (trust score calculation). Transaction timeout is set to 30 seconds.
- **Concurrency:** Pessimistic row-level locking ensures only one admin can resolve a dispute at a time. Second admin receives error if dispute is locked.
- **Audit:** All resolution steps are logged to DisputeActivityEntity. Includes: admin ID, verdict, amounts distributed, timestamp.
- **Notification:** EventEmitter emits DisputeResolvedEvent with verdict and amounts. Notification service sends emails and in-app notifications to all parties.
- **Recovery:** Failed transactions auto-rollback completely. No partial state is saved. Admin can safely retry resolution after error.

---

## Assumptions

1. Admin has reviewed all evidence thoroughly before making verdict.
2. Wallet system is operational and all users have valid wallet records.
3. Database connection is stable for transaction duration.
4. Trust score service is available (if not, deferred recalculation is acceptable).
5. Event emitter and notification service are operational.
6. Escrow amounts have been correctly calculated when dispute was created.

---

**End of Use Case Specification**
