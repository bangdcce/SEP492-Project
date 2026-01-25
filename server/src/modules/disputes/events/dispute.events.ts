// src/modules/disputes/events/dispute.events.ts

export const DISPUTE_EVENTS = {
  // Core events
  CREATED: 'dispute.created',
  ESCALATED: 'dispute.escalated',
  RESOLVED: 'dispute.resolved',
  REJECTED: 'dispute.rejected',
  INFO_REQUESTED: 'dispute.info_requested',
  INFO_PROVIDED: 'dispute.info_provided',
  REJECTION_APPEALED: 'dispute.rejection_appealed',
  REJECTION_APPEAL_RESOLVED: 'dispute.rejection_appeal_resolved',
  CLOSED: 'dispute.closed',

  // Assignment events (for workload tracking)
  ASSIGNED: 'dispute.assigned',
  REASSIGNED: 'dispute.reassigned',

  // Defendant Response events
  DEFENDANT_RESPONDED: 'dispute.defendant_responded',

  // Appeal events
  APPEAL_SUBMITTED: 'dispute.appeal_submitted',
  APPEAL_RESOLVED: 'dispute.appeal_resolved',
  APPEAL_DEADLINE_PASSED: 'dispute.appeal_deadline_passed',

  // Activity events
  NOTE_ADDED: 'dispute.note_added',
  EVIDENCE_ADDED: 'dispute.evidence_added',
  STATUS_CHANGED: 'dispute.status_changed',

  // Message events
  MESSAGE_SENT: 'dispute.message_sent',
  MESSAGE_HIDDEN: 'dispute.message_hidden',
} as const;

export type DisputeEventType = (typeof DISPUTE_EVENTS)[keyof typeof DISPUTE_EVENTS];
