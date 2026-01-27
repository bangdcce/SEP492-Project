export type HearingTier = "TIER_1" | "TIER_2";

export type HearingStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED"
  | "RESCHEDULED";

export type SpeakerRole =
  | "ALL"
  | "MODERATOR_ONLY"
  | "RAISER_ONLY"
  | "DEFENDANT_ONLY"
  | "MUTED_ALL";

export type HearingParticipantRole =
  | "RAISER"
  | "DEFENDANT"
  | "WITNESS"
  | "MODERATOR"
  | "OBSERVER";

export interface HearingParticipantSummary {
  id: string;
  userId: string;
  role: HearingParticipantRole;
  isRequired?: boolean;
  isOnline?: boolean;
  confirmedAt?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  totalOnlineMinutes?: number;
  responseDeadline?: string | null;
  user?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

export interface HearingDisputeSummary {
  id: string;
  status?: string;
  phase?: string;
  priority?: string;
  assignedStaffId?: string | null;
}

export interface DisputeHearingSummary {
  id: string;
  disputeId: string;
  status: HearingStatus;
  scheduledAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  agenda?: string | null;
  requiredDocuments?: string[] | null;
  externalMeetingLink?: string | null;
  moderatorId?: string | null;
  currentSpeakerRole?: SpeakerRole | null;
  isChatRoomActive?: boolean;
  estimatedDurationMinutes?: number | null;
  rescheduleCount?: number;
  previousHearingId?: string | null;
  lastRescheduledAt?: string | null;
  hearingNumber?: number;
  tier?: HearingTier;
  participants?: HearingParticipantSummary[];
  dispute?: HearingDisputeSummary;
}

export interface HearingStatementSummary {
  id: string;
  hearingId: string;
  participantId: string;
  type: HearingStatementType;
  title?: string | null;
  content: string;
  status: HearingStatementStatus;
  attachments?: string[] | null;
  replyToStatementId?: string | null;
  retractionOfStatementId?: string | null;
  orderIndex?: number;
  isRedacted?: boolean;
  redactedReason?: string | null;
  createdAt: string;
  participant?: {
    id: string;
    userId: string;
    role: HearingParticipantRole;
    user?: {
      id: string;
      fullName?: string;
      email?: string;
      role?: string;
    };
  };
}

export interface HearingQuestionSummary {
  id: string;
  hearingId: string;
  askedById: string;
  targetUserId: string;
  question: string;
  answer?: string | null;
  status: HearingQuestionStatus;
  answeredAt?: string | null;
  deadline?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  isRequired?: boolean;
  orderIndex?: number;
  createdAt: string;
  askedBy?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
  targetUser?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
  cancelledBy?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

export type HearingTimelineEventType =
  | "HEARING_SCHEDULED"
  | "HEARING_STARTED"
  | "HEARING_ENDED"
  | "PARTICIPANT_JOINED"
  | "PARTICIPANT_LEFT"
  | "STATEMENT_SUBMITTED"
  | "QUESTION_ASKED"
  | "QUESTION_ANSWERED"
  | "QUESTION_CANCELLED";

export interface HearingTimelineEvent {
  id: string;
  type: HearingTimelineEventType | string;
  occurredAt: string;
  title: string;
  description?: string;
  relatedId?: string;
  actor?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

export interface HearingAttendanceParticipant {
  participantId: string;
  userId: string;
  role: HearingParticipantRole;
  isRequired?: boolean;
  confirmedAt?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  isOnline?: boolean;
  totalOnlineMinutes?: number;
  attendanceMinutes?: number;
  lateMinutes?: number;
  responseStatus?: string;
  attendanceStatus?: string;
  isNoShow?: boolean;
  user?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
}

export interface HearingAttendanceSummary {
  hearingId: string;
  scheduledAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  estimatedDurationMinutes?: number;
  requiredAttendanceMinutes?: number;
  totals: {
    totalParticipants: number;
    requiredParticipants: number;
    presentCount: number;
    noShowCount: number;
    onTimeCount: number;
    lateCount: number;
    veryLateCount: number;
    averageAttendanceMinutes: number;
  };
  participants: HearingAttendanceParticipant[];
}

export type HearingStatementType =
  | "OPENING"
  | "EVIDENCE"
  | "REBUTTAL"
  | "CLOSING"
  | "QUESTION"
  | "ANSWER";

export type HearingStatementStatus = "DRAFT" | "SUBMITTED";

export type HearingQuestionStatus =
  | "PENDING_ANSWER"
  | "ANSWERED"
  | "CANCELLED_BY_MODERATOR";

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
