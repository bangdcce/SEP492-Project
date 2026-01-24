export enum EventType {
  DISPUTE_HEARING = "DISPUTE_HEARING",
  PROJECT_MEETING = "PROJECT_MEETING",
  INTERNAL_MEETING = "INTERNAL_MEETING",
  PERSONAL_BLOCK = "PERSONAL_BLOCK",
  REVIEW_SESSION = "REVIEW_SESSION",
  TASK_DEADLINE = "TASK_DEADLINE",
  OTHER = "OTHER",
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
  metadata?: Record<string, any>;
  participants?: any[];
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
