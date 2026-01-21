# Use Case Descriptions — UC14–UC24 (Client)

This document follows the template in `docs/Usecases/usecases_Sample.md`.

**Source context used**: `docs/InterDev.md`, `docs/schema.txt`, and the UC diagram for Client UC-14..UC-24.

---

## UC‑14: Manage Broker’s Specs (Review/Approve Broker’s Specs)
- UC ID and name: UC‑14 — Manage Broker’s Specs (Review/Approve Broker’s Specs)
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Broker

- Trigger: The client opens a project request/specification and chooses “Review Spec” or “Approve Spec”.
- Description: Let the client review the broker-prepared project specification (scope, roles, timeline, milestones, budget split) and approve it so the request can move forward to contract/matching.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: A broker has been assigned to the request.
  - PRE3: The broker has published a specification version for the request.
  - PRE4: The request is in a status that allows review (e.g., waiting for client approval).

- Postconditions:
  - POST1: The latest spec is marked as reviewed by the client.
  - POST2: If approved, the request status moves to the next step (e.g., “Approved for matching/contract”).
  - POST3: A notification is sent to the broker about the client decision.

- Normal Flow:
  1. The client opens the Request/Project area and selects a request.
  2. The system shows the broker-prepared spec summary (scope, deliverables, assumptions, timeline).
  3. The client opens the full spec details, including milestone list and per-milestone amounts.
  4. The system displays change highlights (if this is a newer version).
  5. The client reviews key sections: in-scope/out-of-scope, acceptance criteria, milestone deliverables, payment plan.
  6. The client may add questions or comments for clarification.
  7. The client chooses one action: Approve Spec / Request Changes.
  8. The system requests confirmation to prevent accidental approval.
  9. The system saves the client decision and updates the request/spec status.
  10. The system notifies the broker and records an audit log entry.

- Alternative Flows:
  - AF1: The client requests changes at step 7
    - 7.1 The client selects “Request Changes” and enters requested adjustments.
    - 7.2 The system marks the spec as “Needs revision” and keeps the request in a pre-approval state.
    - 7.3 The broker is notified to revise and submit a new spec version.
  - AF2: The spec has multiple versions at step 3
    - 3.1 The client selects a version to view (latest is default).
    - 3.2 The system shows version history (created time, author, summary of changes).
  - AF3: The client only reviews without approving
    - 7.1 The client exits after reading.
    - 7.2 The system keeps status unchanged but records “Viewed at” timestamp.

- Exceptions:
  - E1: The spec fails to load at step 2  show “Unable to load spec, please try again.”
  - E2: The request status changed (broker updated spec) at step 9 → show “Spec was updated; please review the latest version.”

- Priority: High.
- Frequency of Use: Medium (typically once per request, plus revisions).

- Business Rules:
  - BR1: A client approval is required before matching/contract steps can proceed.
  - BR2: The system keeps spec version history and who approved which version.
  - BR3: Approving a spec locks the approved version for contract generation (later revisions require a new approval).

- Other Information:
  1. A concise summary and “diff highlights” helps non-technical clients understand changes.
  2. All decisions should be written to audit logs for dispute resolution later.

- Assumptions: The broker has already translated the request into a complete spec and milestones.

---

## UC‑15: View List Current Project
- UC ID and name: UC‑15 — View List Current Project
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: —

- Trigger: The client opens “My Projects / Current Projects”.
- Description: Show the client a clear list of active or ongoing projects, with basic status, key members (broker/freelancer), progress, and quick actions.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The system can read project data for the client.

- Postconditions:
  - POST1: The current project list is shown with status and progress.
  - POST2: The client can open a project to see details, milestones, chat, and workspace.

- Normal Flow:
  1. The client navigates to the Current Projects page.
  2. The system loads all projects where the client is the owner (clientId).
  3. The system displays each project card/row with: title, broker, freelancer (if assigned), status, and last updated time.
  4. The system shows progress indicators (e.g., milestone completion, task completion).
  5. The client filters/sorts projects (by status, date, progress).
  6. The client selects a project to open its workspace.
  7. The system navigates to the project overview page.

- Alternative Flows:
  - AF1: No current projects
    - 2.1 The system shows an empty state and a link to create/view requests.
  - AF2: Many projects
    - 3.1 The system uses paging or infinite scroll.
    - 3.2 The client searches by project title.

- Exceptions:
  - E1: Projects cannot be loaded → show “Unable to load projects, please try again.”

- Priority: High.
- Frequency of Use: High (frequent monitoring during project execution).

- Business Rules:
  - BR1: A client can only view projects where they are a member/owner.
  - BR2: Status values are consistent across the system (Planning/In Progress/On Hold/Completed/Cancelled).
  - BR3: Default sort shows most recently updated projects first.

- Other Information:
  1. Provide quick links to Chat, Milestones, and Dispute (if available).

- Assumptions: The platform creates a project workspace once contract/payment prerequisites are satisfied.

---

## UC‑16: Review Milestone (Feedback/Approve Milestone)
- UC ID and name: UC‑16 — Review Milestone (Feedback/Approve Milestone)
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Broker, Freelancer

- Trigger: The client opens a milestone marked “Submitted/Pending review” and chooses to review it.
- Description: Allow the client to review delivered work for a milestone, provide feedback, and approve it to release escrow funds (virtual) or reject it for rework.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The project exists and the client is a member.
  - PRE3: The milestone exists and has been submitted with proof of work (e.g., link, demo, files).
  - PRE4: The milestone is in a reviewable state (e.g., SUBMITTED / PENDING_REVIEW).

- Postconditions:
  - POST1: The milestone review decision is recorded.
  - POST2: If approved, the milestone status moves forward and escrow release can occur (via UC‑17 Checkout if required).
  - POST3: If rejected, feedback is saved and the milestone returns to an “In progress / Needs changes” state.

- Normal Flow:
  1. The client opens a project from the current project list.
  2. The client navigates to the Milestones section.
  3. The system shows milestones with status and due dates.
  4. The client opens a milestone that is waiting for review.
  5. The system displays the milestone details: description, acceptance criteria, amount, and proof of work.
  6. The client optionally checks broker notes or staff recommendations (if present) for technical guidance.
  7. The client tests/reviews the delivered output (demo links, documents, screenshots).
  8. The client provides feedback comments.
  9. The client chooses Approve or Request Changes/Reject.
  10. The system asks for confirmation and warns that approval may release escrow funds.
  11. The system records the decision, updates milestone status, and notifies broker/freelancer.
  12. If approved and payment release is required, the system redirects to UC‑17 Checkout.

- Alternative Flows:
  - AF1: Client requests changes at step 9
    - 9.1 The client selects “Request Changes” and enters clear change requests.
    - 9.2 The system marks milestone as “Changes requested” and assigns it back to the freelancer.
    - 9.3 The freelancer updates work and resubmits proof of work, returning to step 4.
  - AF2: Broker performs a technical review before client decision at step 6
    - 6.1 The broker leaves “Reviewed” notes and recommendations.
    - 6.2 The client uses these notes to decide approve vs request changes.
  - AF3: Proof of work is incomplete at step 5
    - 5.1 The client requests the freelancer to attach missing evidence.
    - 5.2 The milestone remains in review state until updated.

- Exceptions:
  - E1: Proof link cannot be accessed at step 7 → show a warning and allow the client to request a new link.
  - E2: Status changed concurrently at step 11 → show “Milestone updated, please refresh.”

- Priority: High.
- Frequency of Use: Medium to high (per milestone submission).

- Business Rules:
  - BR1: Escrow release can only occur after client approval.
  - BR2: Feedback/comments are permanently stored for auditing and dispute resolution.
  - BR3: A milestone must have proof of work before it can be approved.

- Other Information:
  1. The system should show a clear timeline of submissions, reviews, and approvals.

- Assumptions: Payment is simulated; escrow logic still enforces hold/release events.

---

## UC‑17: Checkout
- UC ID and name: UC‑17 — Checkout
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Payment

- Trigger: The client chooses to pay/fund escrow for a milestone or to release escrow after approval, depending on the project phase.
- Description: Allow the client to complete a payment action related to project escrow (deposit/hold for milestone funding, or release on milestone approval) using the platform’s simulated payment flow.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The project and milestone exist.
  - PRE3: The system has calculated the required amount and fee split (freelancer/broker/platform).
  - PRE4: The payment method (simulation) is available.

- Postconditions:
  - POST1: A transaction record is created (e.g., DEPOSIT/HOLD/RELEASE/REFUND depending on context).
  - POST2: The escrow record is updated (fundedAmount/releasedAmount/status).
  - POST3: The project or milestone status updates accordingly.

- Normal Flow:
  1. The client initiates checkout from a project action (e.g., fund milestone escrow or confirm release).
  2. The system shows a checkout summary: milestone, amount, currency, and fees.
  3. The system shows how funds will be split (developer share, broker share, platform fee) if applicable.
  4. The client selects a payment method (simulated) and confirms.
  5. The system sends the payment request to the payment service.
  6. The payment service returns success.
  7. The system creates a transaction record and updates wallet/escrow balances.
  8. The system updates milestone/payment status (e.g., escrow funded or funds released).
  9. The system shows a success message and returns the client to the project page.

- Alternative Flows:
  - AF1: The client cancels at step 4
    - 4.1 The system returns to the previous page with no changes.
  - AF2: Partial funding is allowed (if enabled) at step 2
    - 2.1 The client chooses a smaller deposit.
    - 2.2 The system marks escrow as partially funded.
  - AF3: The project uses a “per milestone hold” approach
    - 1.1 The client funds only the specific milestone escrow, not the entire project budget.

- Exceptions:
  - E1: Payment fails at step 6 → show failure reason and allow retry.
  - E2: Network error at step 5 → show a short error and keep checkout pending.

- Priority: High.
- Frequency of Use: Medium (when funding and approving milestones).

- Business Rules:
  - BR1: The client cannot release funds for a milestone that is not approved.
  - BR2: Fee split percentages follow platform configuration (e.g., developer/broker/platform).
  - BR3: Every payment action must write an audit log entry and a transaction record.

- Other Information:
  1. For thesis scope, payment may be simulated, but statuses and records must behave consistently.

- Assumptions: The platform provides a payment simulation service and keeps transaction history.

---

## UC‑18: Invite Another Account To Project (Manage Authorization For Invited)
- UC ID and name: UC‑18 — Invite Another Account To Project (Manage Authorization For Invited)
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: —

- Trigger: The client opens a project’s member area and clicks “Invite member”.
- Description: Allow the client to invite another account (e.g., staff/supervisor or stakeholder) into a project workspace and manage what that invited person can view or do.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The project exists and is active.
  - PRE3: The client has permission to manage members in the project.

- Postconditions:
  - POST1: An invitation is created and sent (notification/email simulation).
  - POST2: If accepted, the invited user becomes a member of the project.
  - POST3: The invited user’s authorization is stored and applied in the workspace.

- Normal Flow:
  1. The client opens a project and goes to Members/Team.
  2. The system shows current members and their roles.
  3. The client clicks “Invite another account”.
  4. The client enters the invitee email/username.
  5. The system validates the account exists and is eligible.
  6. The client selects permissions for the invitee (Manage Authorization): view-only, comment, review milestones, etc.
  7. The client sends the invitation.
  8. The system records the invitation and notifies the invitee.
  9. The invitee accepts the invitation.
  10. The system adds the invitee to the project and applies permissions.
  11. The client can later edit the invitee’s permissions.

- Alternative Flows:
  - AF1: The invitee does not have an account at step 5
    - 5.1 The system offers to send an invite link to register.
    - 5.2 The invitation stays pending until registration is complete.
  - AF2: The client updates authorization after joining at step 11
    - 11.1 The client changes permission level.
    - 11.2 The system applies the change immediately.
  - AF3: Invitation expired
    - 8.1 The invite is not accepted before expiry.
    - 8.2 The client resends a new invitation.

- Exceptions:
  - E1: Invitation cannot be sent → show “Unable to send invitation, please try again.”

- Priority: Medium to high.
- Frequency of Use: Low to medium (per project/team setup).

- Business Rules:
  - BR1: Only project owners (client) can invite/remove members and set permissions.
  - BR2: Invited users can only access areas allowed by their authorization.
  - BR3: All membership and permission changes are logged.

- Other Information:
  1. Typical invitees: Staff (supervisor), client stakeholders.

- Assumptions: The platform supports role/permission checks per project.

---

## UC‑19: Join Chat Room
- UC ID and name: UC‑19 — Join Chat Room
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Broker, Freelancer, Staff (if invited)

- Trigger: The client clicks “Chat” inside a project workspace.
- Description: Let the client enter the project chat room to communicate with broker/freelancer and coordinate work, clarify requirements, and keep written history for audit/dispute.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The client is a member of the project.
  - PRE3: The project has an available chat room.

- Postconditions:
  - POST1: The chat room opens and shows the message history.
  - POST2: The client can send messages and receive replies.

- Normal Flow:
  1. The client opens a project workspace.
  2. The client clicks the Chat tab.
  3. The system verifies the client’s membership and permissions.
  4. The system loads the chat history for the project.
  5. The system displays messages grouped by time and sender.
  6. The client types a message.
  7. The system sends the message and stores it.
  8. Other members receive the message.
  9. The client can search or scroll older messages.

- Alternative Flows:
  - AF1: No previous messages
    - 4.1 The system shows an empty state and a prompt to start the conversation.
  - AF2: The client is view-only (invited role)
    - 3.1 The system allows reading but disables sending.

- Exceptions:
  - E1: Chat history fails to load → show “Unable to load chat, please try again.”
  - E2: Message send fails → show a short error and allow retry.

- Priority: High.
- Frequency of Use: High.

- Business Rules:
  - BR1: Chat is linked to a specific project and visible only to project members.
  - BR2: Chat history is kept for auditing and dispute evidence.
  - BR3: Users can only send messages if they have permission.

- Other Information:
  1. Chat may be simplified (no realtime) but must preserve message order and authorship.

- Assumptions: The system stores project chat logs even if realtime features are limited.

---

## UC‑20: Rate Freelancer/Broker
- UC ID and name: UC‑20 — Rate Freelancer/Broker
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: —

- Trigger: The client completes a project (or reaches a rating stage) and clicks “Rate”.
- Description: Let the client rate and review the freelancer and/or broker after project completion, contributing to trust score and future matching.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The project exists and is completed or in a state allowing reviews.
  - PRE3: The client has not already submitted a review for the target user in this project.

- Postconditions:
  - POST1: A review record is created (rating + comment).
  - POST2: The rated user’s trust score can be recalculated or updated.
  - POST3: The client sees a confirmation and can view their submitted review.

- Normal Flow:
  1. The client opens the completed project.
  2. The client selects “Rate Freelancer/Broker”.
  3. The system shows the rating form: 1–5 stars and a comment box.
  4. The client selects a rating score.
  5. The client writes optional feedback (quality, communication, timeliness).
  6. The client submits the review.
  7. The system saves the review and links it to the project and target user.
  8. The system displays a success message.

- Alternative Flows:
  - AF1: The client rates both broker and freelancer
    - 3.1 The system shows two sections or a stepper for each role.
    - 3.2 The client submits each review separately.
  - AF2: The client skips comment
    - 5.1 The system allows submission with rating only.

- Exceptions:
  - E1: Duplicate review attempt → show “You have already rated this user for this project.”
  - E2: Save fails → show “Unable to submit review, please try again.”

- Priority: Medium to high.
- Frequency of Use: Medium.

- Business Rules:
  - BR1: Reviews are only allowed for projects in eligible states (e.g., completed).
  - BR2: One reviewer can rate a target user once per project.
  - BR3: Reviews contribute to trust score calculations.

- Other Information:
  1. Ratings may be weighted (see `reviews.weight` in schema).

- Assumptions: Trust score uses ratings, disputes, and verification signals.

---

## UC‑21: Manage Subscription
- UC ID and name: UC‑21 — Manage Subscription
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Payment

- Trigger: The client opens Subscription/Plans and chooses to view or change a plan.
- Description: Allow the client to manage any platform subscription or plan-based access (if enabled). In demo scope, this may be simplified to plan selection and a checkout simulation.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: Subscription plans are available in the system configuration.

- Postconditions:
  - POST1: The client’s plan selection is saved.
  - POST2: If payment is required, checkout is completed (UC‑17) and status is updated.

- Normal Flow:
  1. The client opens the Manage Subscription page.
  2. The system shows current plan status and available plans.
  3. The client selects a new plan or renews.
  4. The system shows plan details: price, limits, and benefits.
  5. The client confirms the change.
  6. If the plan requires payment, the system redirects to UC‑17 Checkout.
  7. After successful checkout, the system activates the plan.
  8. The system shows a confirmation message and updated subscription status.

- Alternative Flows:
  - AF1: Free plan selection
    - 6.1 No checkout is required; the system updates the plan immediately.
  - AF2: Client cancels
    - 5.1 The system keeps the existing plan unchanged.

- Exceptions:
  - E1: Payment fails (during UC‑17) → subscription remains unchanged.
  - E2: Plan data cannot be loaded → show “Unable to load plans, please try again.”

- Priority: Medium.
- Frequency of Use: Low.

- Business Rules:
  - BR1: Only one active plan per account at a time.
  - BR2: Upgrades apply immediately; downgrades may apply at next cycle (if cycles exist).
  - BR3: Any paid plan activation requires a successful checkout record.

- Other Information:
  1. The current database schema does not show a dedicated subscription table; this UC may be implemented via configuration/demo logic.

- Assumptions: Subscription is simplified for thesis scope and may not be fully recurring.

---

## UC‑22: Manage Dispute
- UC ID and name: UC‑22 — Manage Dispute
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Broker, Freelancer, Admin

- Trigger: The client opens the Dispute section for a project/milestone.
- Description: Allow the client to manage disputes related to milestone delivery/payment, including viewing status, providing statements, adding evidence, and following admin resolution.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The project and milestone exist and the client is a member.
  - PRE3: A dispute is allowed by status/rules (e.g., milestone rejected repeatedly, or blocked payment).

- Postconditions:
  - POST1: The client can track dispute status and actions.
  - POST2: Any new evidence/notes are saved and visible to relevant roles.

- Normal Flow:
  1. The client opens a project and navigates to Disputes.
  2. The system shows existing disputes for the project/milestone and their statuses.
  3. The client selects a dispute to view details (UC‑24) or starts a new one (UC‑23).
  4. The system shows timeline: who raised it, reason, disputed amount, deadlines.
  5. The client adds a statement or response and uploads evidence (if needed).
  6. The system stores the update and notifies the other party.
  7. The client monitors admin review status and any required actions.
  8. When resolved, the system displays the resolution decision and its effect (release/refund/partial).

- Alternative Flows:
  - AF1: The client creates a new dispute at step 3
    - 3.1 The client clicks Create Dispute (UC‑23).
    - 3.2 After creation, the system returns to dispute detail (UC‑24).
  - AF2: The client views dispute detail at step 3
    - 3.1 The client opens View Dispute Information (UC‑24).
  - AF3: The client is the defendant
    - 5.1 The system requests a formal response before a deadline.
    - 5.2 The client submits response and evidence.

- Exceptions:
  - E1: Dispute cannot be accessed (not a member) → show “Access denied.”
  - E2: Upload fails at step 5 → show “Unable to upload evidence, please try again.”

- Priority: High.
- Frequency of Use: Low (only when issues occur).

- Business Rules:
  - BR1: Disputes are tied to a project and a milestone (`disputes.milestoneId`).
  - BR2: Evidence and notes are stored and time-stamped; actions create dispute activity records.
  - BR3: Admin is final decision maker; outcome affects escrow transactions and trust score.

- Other Information:
  1. The system may enforce response and resolution deadlines (`responseDeadline`, `resolutionDeadline`).

- Assumptions: Chat logs and audit logs can be used as supporting evidence.

---

## UC‑23: Create Dispute
- UC ID and name: UC‑23 — Create Dispute
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Broker, Freelancer, Admin

- Trigger: The client clicks “Create Dispute” from a milestone/project page.
- Description: Allow the client to formally raise a dispute against another party regarding milestone quality, scope, delay, or payment release, and submit initial evidence.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The client is a member of the project.
  - PRE3: The milestone exists and is eligible for dispute.
  - PRE4: No open dispute already exists for the same milestone (or the system allows multiple with parentDisputeId).

- Postconditions:
  - POST1: A new dispute record is created with status OPEN.
  - POST2: The defendant is notified to respond.
  - POST3: Escrow for the disputed milestone may be put on hold until resolution.

- Normal Flow:
  1. The client opens the project and selects a milestone.
  2. The client clicks “Create Dispute”.
  3. The system shows a dispute form (reason, category, disputed amount, description).
  4. The client selects the defendant (freelancer or broker, depending on issue).
  5. The client enters a clear description of the problem and references the agreed spec.
  6. The client uploads evidence (screenshots, docs, links, chat reference).
  7. The client submits the dispute.
  8. The system creates the dispute record and sets response deadlines.
  9. The system notifies the defendant and admin.
  10. The system opens the dispute detail page (UC‑24).

- Alternative Flows:
  - AF1: The client disputes only part of the amount
    - 3.1 The client enters a disputedAmount smaller than the milestone amount.
    - 3.2 The system records partial dispute.
  - AF2: The client cancels at step 7
    - 7.1 The system discards the draft and returns to the milestone page.

- Exceptions:
  - E1: Validation failure at step 7 (missing reason/evidence) → show required fields.
  - E2: Duplicate dispute at step 8 → show “A dispute already exists for this milestone.”

- Priority: High.
- Frequency of Use: Low.

- Business Rules:
  - BR1: A dispute must include a reason and link to the milestone/project.
  - BR2: The defendant must respond before `responseDeadline` (if enforced).
  - BR3: Dispute creation and updates are written to dispute activities and audit logs.

- Other Information:
  1. The system supports appeals (`isAppealed`, `appealReason`) if enabled.

- Assumptions: Admin reviews disputes using spec, chat logs, and evidence.

---

## UC‑24: View Dispute Information (Add/Edit/Delete Dispute Material)
- UC ID and name: UC‑24 — View Dispute Information (Add/Edit/Delete Dispute Material)
- Created By: Team
- Date Created: 29/10/2025
- Primary Actor: Client
- Secondary Actors: Broker, Freelancer, Admin

- Trigger: The client opens a dispute from the dispute list.
- Description: Show full dispute details and allow the client to add, edit, or delete dispute materials (evidence, notes) while the dispute is open.

- Preconditions:
  - PRE1: The client is signed in.
  - PRE2: The dispute exists.
  - PRE3: The client is a permitted party (raiser/defendant) or an authorized project member.

- Postconditions:
  - POST1: The dispute information is displayed (status, timeline, parties, milestones, amounts).
  - POST2: Any added/edited/deleted materials are saved and reflected in the dispute timeline.

- Normal Flow:
  1. The client opens Manage Dispute (UC‑22) and selects a dispute.
  2. The system loads the dispute summary: reason, status, disputed amount, milestone.
  3. The system displays parties: raiser, defendant, and roles.
  4. The system shows evidence/materials and a timeline of dispute activities.
  5. The client reads admin requests or pending actions (e.g., respond by deadline).
  6. The client adds new dispute material (upload/link) with a short description.
  7. The system stores the material and records an activity entry.
  8. The client edits a previously submitted note/material description if allowed.
  9. The system saves the edits and records the change.
  10. The client deletes a material (if allowed) and confirms deletion.
  11. The system removes/hides the material and records an activity.
  12. The client monitors the final resolution result when admin resolves.

- Alternative Flows:
  - AF1: Dispute is resolved at step 6
    - 6.1 The system disables material changes and switches to read-only view.
  - AF2: The client responds as defendant
    - 5.1 The system shows “Submit response” section.
    - 5.2 The client provides response text and optional evidence.
  - AF3: Material deletion is restricted
    - 10.1 The system allows delete only for drafts or within a time window.
    - 10.2 Otherwise, it shows “Cannot delete after admin review started.”

- Exceptions:
  - E1: Dispute fails to load → show “Unable to load dispute, please try again.”
  - E2: Upload fails → show “Upload failed, please retry.”

- Priority: High.
- Frequency of Use: Low to medium (during active disputes).

- Business Rules:
  - BR1: Only participants (raiser/defendant/admin) can view full dispute detail.
  - BR2: Evidence changes are allowed only while dispute status is OPEN/IN_REVIEW (configurable).
  - BR3: All material updates must be logged in dispute activities with timestamps.

- Other Information:
  1. Dispute resolution can trigger escrow actions (release/refund/partial) and impact trust score.

- Assumptions: The system preserves an immutable timeline (who changed what and when).