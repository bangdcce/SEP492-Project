export type HearingTier = "TIER_1" | "TIER_2";

export type HearingStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED"
  | "RESCHEDULED";

export interface ScheduleHearingInput {
  disputeId: string;
  scheduledAt: string;
  estimatedDurationMinutes?: number;
  agenda?: string;
  requiredDocuments?: string[];
  tier?: HearingTier;
  externalMeetingLink?: string;
  isEmergency?: boolean;
}

export interface RescheduleHearingInput {
  hearingId: string;
  scheduledAt: string;
  estimatedDurationMinutes?: number;
  agenda?: string;
  requiredDocuments?: string[];
  externalMeetingLink?: string;
  isEmergency?: boolean;
}

export interface EndHearingInput {
  hearingId: string;
  summary?: string;
  findings?: string;
  pendingActions?: string[];
  forceEnd?: boolean;
}
