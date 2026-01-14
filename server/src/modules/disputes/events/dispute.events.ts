// src/modules/disputes/events/dispute.events.ts

export const DISPUTE_EVENTS = {
  // Core events
  CREATED: 'dispute.created',
  ESCALATED: 'dispute.escalated',
  RESOLVED: 'dispute.resolved',
  REJECTED: 'dispute.rejected',

  // Defendant Response events
  DEFENDANT_RESPONDED: 'dispute.defendant_responded',

  // Appeal events
  APPEAL_SUBMITTED: 'dispute.appeal_submitted',
  APPEAL_RESOLVED: 'dispute.appeal_resolved',

  // Activity events
  NOTE_ADDED: 'dispute.note_added',
  EVIDENCE_ADDED: 'dispute.evidence_added',
  STATUS_CHANGED: 'dispute.status_changed',
} as const;

export type DisputeEventType = (typeof DISPUTE_EVENTS)[keyof typeof DISPUTE_EVENTS];
