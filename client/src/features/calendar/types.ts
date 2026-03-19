export enum EventType {
  DISPUTE_HEARING = "DISPUTE_HEARING",
  PROJECT_MEETING = "PROJECT_MEETING",
  INTERNAL_MEETING = "INTERNAL_MEETING",
  PERSONAL_BLOCK = "PERSONAL_BLOCK",
  REVIEW_SESSION = "REVIEW_SESSION",
  TASK_DEADLINE = "TASK_DEADLINE",
  OTHER = "OTHER",
}

export enum AvailabilityType {
  AVAILABLE = "AVAILABLE",
  BUSY = "BUSY",
  OUT_OF_OFFICE = "OUT_OF_OFFICE",
  PREFERRED = "PREFERRED",
  DO_NOT_DISTURB = "DO_NOT_DISTURB",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  RESCHEDULING = "RESCHEDULING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum RescheduleRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  AUTO_RESOLVED = "AUTO_RESOLVED",
  WITHDRAWN = "WITHDRAWN",
}

export type EventInviteResponse = "accept" | "decline" | "tentative";

export interface CalendarEventParticipant {
  id: string;
  eventId: string;
  userId: string;
  role: string;
  status: string;
  responseDeadline?: string | null;
  respondedAt?: string | null;
  responseNote?: string | null;
  user?: {
    id: string;
    fullName?: string;
    email?: string;
    handle?: string;
    role?: string;
  } | null;
}

export interface CalendarDisputeSummaryMetadata {
  id: string;
  displayCode: string;
  displayTitle: string;
  projectTitle?: string;
  reasonExcerpt: string;
  status?: string;
  appealState: string;
}

export interface CalendarHearingSummaryMetadata {
  hearingId: string;
  hearingNumber?: number;
  tier?: string;
  status?: string;
  isActionable: boolean;
  isArchived: boolean;
  freezeReason?: string;
  scheduledAt?: string;
  nextAction?: string;
  appealState: string;
  externalMeetingLink?: string;
}

export interface CalendarDisputeContext {
  disputeId: string;
  hearingId: string;
  displayCode: string;
  hearingNumber?: number;
  projectId?: string;
  projectTitle?: string;
  claimantName?: string;
  defendantName?: string;
  counterpartyName?: string;
  perspective?: "CLAIMANT" | "DEFENDANT" | "OTHER";
  viewerSystemRole?: string;
  viewerHearingRole?: "CLAIMANT" | "DEFENDANT" | "WITNESS" | "MODERATOR" | "OBSERVER";
}

export interface CalendarEventMetadata {
  hearingId?: string;
  disputeSummary?: CalendarDisputeSummaryMetadata;
  hearingSummary?: CalendarHearingSummaryMetadata;
  [key: string]: any;
}

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  startTime: string; // ISO Date string
  endTime: string; // ISO Date string
  durationMinutes: number;
  location?: string;
  externalMeetingLink?: string;
  status: EventStatus;
  organizerId: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: CalendarEventMetadata;
  disputeContext?: CalendarDisputeContext;
  participants?: CalendarEventParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface RescheduleTimeSlot {
  start: string;
  end: string;
}

export interface RescheduleRequest {
  id: string;
  eventId: string;
  requesterId: string;
  reason: string;
  proposedTimeSlots?: RescheduleTimeSlot[];
  useAutoSchedule: boolean;
  status: RescheduleRequestStatus;
  createdAt: string;
  event?: CalendarEvent;
  requester?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

export interface CreateEventRequest {
  title: string;
  type: EventType;
  startTime: string;
  endTime: string;
  description?: string;
  participantUserIds?: string[];
  referenceType?: string;
  referenceId?: string;
  location?: string;
  externalMeetingLink?: string;
  reminderMinutes?: number;
  notes?: string;
  metadata?: Record<string, any>;
  useAutoSchedule?: boolean;
}

export interface CalendarEventFilter {
  startDate?: string;
  endDate?: string;
  type?: EventType;
  status?: EventStatus;
  organizerId?: string;
  participantId?: string;
}

export interface RescheduleRequestFilter {
  status?: RescheduleRequestStatus;
  eventId?: string;
  requesterId?: string;
  page?: number;
  limit?: number;
}
