import type {
  DisputeEvidence,
  DisputeFollowUpAction,
  DisputeMessage,
} from "@/features/disputes/types/dispute.types";

export type HearingTier = "TIER_1" | "TIER_2";

export type HearingStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELED"
  | "RESCHEDULED";

export type HearingLifecycle = "ACTIVE" | "ARCHIVED";

export type SpeakerRole =
  | "ALL"
  | "MODERATOR_ONLY"
  | "RAISER_ONLY"
  | "DEFENDANT_ONLY"
  | "WITNESS_ONLY"
  | "OBSERVER_ONLY"
  | "MUTED_ALL";

export type HearingParticipantRole =
  | "RAISER"
  | "DEFENDANT"
  | "WITNESS"
  | "MODERATOR"
  | "OBSERVER";

export type HearingParticipantResponseStatus =
  | "PENDING"
  | "NO_RESPONSE"
  | "ACCEPTED"
  | "DECLINED"
  | "TENTATIVE";

export interface HearingParticipantConfirmationItem {
  userId: string;
  role: string;
  status: HearingParticipantResponseStatus | string;
  isRequired: boolean;
   caseRole?: HearingParticipantRole | null;
  respondedAt?: string | null;
  responseDeadline?: string | null;
}

export interface HearingParticipantConfirmationSummary {
  totalParticipants: number;
  requiredParticipants: number;
  accepted: number;
  declined: number;
  tentative: number;
  pending: number;
  requiredAccepted: number;
  requiredDeclined: number;
  requiredTentative: number;
  requiredPending: number;
  allRequiredAccepted: boolean;
  hasModeratorAccepted: boolean;
  primaryPartyAcceptedCount: number;
  primaryPartyPendingCount: number;
  primaryPartyDeclinedCount: number;
  confirmedPrimaryRoles: HearingParticipantRole[];
  confirmationSatisfied: boolean;
  participants: HearingParticipantConfirmationItem[];
}

export interface HearingParticipantSummary {
  id: string;
  userId: string;
  role: HearingParticipantRole;
  invitedAt?: string | null;
  isRequired?: boolean;
  isOnline?: boolean;
  confirmedAt?: string | null;
  declineReason?: string | null;
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
  lifecycle?: HearingLifecycle;
  scheduledAt: string;
  scheduledEndAt?: string | null;
  graceEndsAt?: string | null;
  pauseAutoCloseAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  closureReason?: string | null;
  agenda?: string | null;
  requiredDocuments?: string[] | null;
  externalMeetingLink?: string | null;
  moderatorId?: string | null;
  currentSpeakerRole?: SpeakerRole | null;
  isChatRoomActive?: boolean;
  isEvidenceIntakeOpen?: boolean;
  evidenceIntakeOpenedAt?: string | null;
  evidenceIntakeClosedAt?: string | null;
  evidenceIntakeOpenedBy?: string | null;
  evidenceIntakeReason?: string | null;
  pausedAt?: string | null;
  pausedById?: string | null;
  pauseReason?: string | null;
  summary?: string | null;
  findings?: string | null;
  noShowNote?: string | null;
  accumulatedPauseSeconds?: number;
  speakerRoleBeforePause?: SpeakerRole | null;
  estimatedDurationMinutes?: number | null;
  rescheduleCount?: number;
  previousHearingId?: string | null;
  lastRescheduledAt?: string | null;
  hearingNumber?: number;
  tier?: HearingTier;
  isActionable?: boolean;
  isArchived?: boolean;
  freezeReason?: string | null;
  minutesRecorded?: boolean;
  participants?: HearingParticipantSummary[];
  participantConfirmationSummary?: HearingParticipantConfirmationSummary;
  dispute?: HearingDisputeSummary;
  permissions?: {
    canSendMessage?: boolean;
    sendMessageBlockedReason?: string;
    canUploadEvidence?: boolean;
    uploadEvidenceBlockedReason?: string;
    canAttachEvidenceLink?: boolean;
    attachEvidenceBlockedReason?: string;
    canManageEvidenceIntake?: boolean;
    manageEvidenceIntakeBlockedReason?: string;
  };
}

export interface HearingPhaseGateStatus {
  requiredRole: HearingParticipantRole;
  requiredCount: number;
  submittedCount: number;
  canTransition: boolean;
  missingParticipants: Array<{
    participantId: string;
    userId: string;
    displayName: string;
  }>;
  reason?: string;
}

export interface HearingWorkspaceDossier {
  dispute: {
    id: string;
    status?: string;
    phase?: string;
    disputeType?: string;
    priority?: string;
    category?: string;
    disputedAmount?: number;
    reason?: string | null;
    defendantResponse?: string | null;
    raisedAt?: string | null;
    createdAt?: string | null;
    raiser?: {
      id: string;
      role?: string;
      name?: string;
      email?: string;
    };
    raisedBy?: {
      id: string;
      role?: string;
      name?: string;
      email?: string;
    };
    defendant: {
      id: string;
      role?: string;
      name?: string;
      email?: string;
    };
    assignedStaff?: {
      id: string;
      name?: string;
      email?: string;
    } | null;
  } | null;
  project: {
    id: string;
    title?: string;
    description?: string;
    status?: string;
    totalBudget?: number;
    currency?: string;
    pricingModel?: string;
    startDate?: string | null;
    endDate?: string | null;
    clientId?: string;
    freelancerId?: string;
    brokerId?: string;
  } | null;
  projectSpec: {
    id: string;
    title?: string;
    status?: string;
    referenceLinks?: Array<{ label: string; url: string }>;
    updatedAt?: string | null;
  } | null;
  milestone: {
    milestoneId: string;
    milestoneTitle?: string;
    milestoneStatus?: string;
    milestoneAmount?: number;
    milestoneDueDate?: string | null;
    startDate?: string | null;
    submittedAt?: string | null;
    description?: string | null;
    proofOfWork?: string | null;
  } | null;
  milestoneTimeline: Array<{
    id: string;
    title?: string;
    status?: string;
    amount?: number;
    dueDate?: string | null;
    sortOrder?: number;
  }>;
  contracts: Array<{
    id: string;
    projectId: string;
    title?: string;
    status?: string;
    contractUrl?: string | null;
    createdAt?: string;
    termsPreview?: string | null;
    termsContent?: string | null;
  }>;
  issues: Array<{
    code: string;
    label: string;
    value?: string | number | null;
  }>;
}

export interface HearingWorkspaceSummary {
  hearing: DisputeHearingSummary;
  phase: {
    current: string;
    sequence: string[];
    currentStep: number;
    totalSteps: number;
    progressPercent: number;
    gate: HearingPhaseGateStatus;
  };
  evidenceIntake: {
    isOpen: boolean;
    openedAt?: string | null;
    closedAt?: string | null;
    openedBy?: string | null;
    reason?: string | null;
  };
  dossier: HearingWorkspaceDossier;
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  statements: HearingStatementSummary[];
  questions: HearingQuestionSummary[];
  timeline: HearingTimelineEvent[];
  attendance: HearingAttendanceSummary | null;
}

export interface HearingScheduleResult {
  manualRequired: boolean;
  reason?: string;
  reasonCode?:
    | "NO_STAFF_AVAILABLE"
    | "NO_REQUIRED_PARTICIPANTS"
    | "NO_COMMON_SLOT"
    | "REQUIRED_DECLINED"
    | "CONFIRMATION_TIMEOUT"
    | "MANUAL_REVIEW_REQUIRED";
  hearing: DisputeHearingSummary;
  calendarEvent: {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    referenceId?: string;
  };
  participants: HearingParticipantSummary[];
  scheduledAt: string;
  responseDeadline: string;
  participantConfirmationSummary: HearingParticipantConfirmationSummary;
  warnings: string[];
}

export interface HearingStatementSummary {
  id: string;
  hearingId: string;
  participantId: string;
  type: HearingStatementType;
  title?: string | null;
  content: string;
  structuredContent?: HearingStatementContentBlock[] | null;
  citedEvidenceIds?: string[] | null;
  status: HearingStatementStatus;
  attachments?: string[] | null;
  replyToStatementId?: string | null;
  retractionOfStatementId?: string | null;
  orderIndex?: number;
  isRedacted?: boolean;
  redactedReason?: string | null;
  platformDeclarationAccepted?: boolean;
  platformDeclarationAcceptedAt?: string | null;
  versionNumber?: number;
  versionHistory?: HearingStatementVersionSnapshot[];
  createdAt: string;
  updatedAt?: string;
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
  | "HEARING_PAUSED"
  | "HEARING_RESUMED"
  | "HEARING_ENDED"
  | "HEARING_TIME_WARNING"
  | "HEARING_FOLLOW_UP_SCHEDULED"
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
    presentOnlineCount?: number;
    presentEverJoinedCount?: number;
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
  | "ANSWER"
  | "WITNESS_TESTIMONY"
  | "OBJECTION"
  | "SURREBUTTAL";

export type HearingStatementStatus = "DRAFT" | "SUBMITTED";

export type HearingStatementContentBlockKind =
  | "SUMMARY"
  | "FACTS"
  | "EVIDENCE_BASIS"
  | "ANALYSIS"
  | "REMEDY"
  | "ATTESTATION"
  | "CUSTOM";

export interface HearingStatementContentBlock {
  id?: string;
  kind: HearingStatementContentBlockKind;
  heading?: string | null;
  body: string;
}

export interface HearingStatementVersionSnapshot {
  versionNumber: number;
  savedAt: string;
  status: HearingStatementStatus;
  title?: string | null;
  content: string;
  attachments?: string[] | null;
  citedEvidenceIds?: string[] | null;
  structuredContent?: HearingStatementContentBlock[] | null;
  changeSummary?: string | null;
}

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
  summary: string;
  findings: string;
  pendingActions?: Array<string | DisputeFollowUpAction>;
  forceEnd?: boolean;
  noShowNote?: string;
}

export interface ExtendHearingInput {
  hearingId: string;
  additionalMinutes: number;
  reason: string;
}

export interface InviteSupportInput {
  hearingId: string;
  userId: string;
  participantRole?: HearingParticipantRole;
  reason: string;
}

export interface SupportCandidate {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/* ────────── Verdict types ────────── */

export interface VerdictReasoning {
  violatedPolicies: string[];
  supportingEvidenceIds?: string[];
  policyReferences?: string[];
  legalReferences?: string[];
  contractReferences?: string[];
  evidenceReferences?: string[];
  factualFindings: string;
  legalAnalysis: string;
  analysis?: string;
  conclusion: string;
  remedyRationale?: string;
  trustPenaltyRationale?: string;
}

export interface VerdictSummary {
  id: string;
  disputeId: string;
  adjudicatorId: string;
  adjudicatorRole: string;
  result: string; // 'WIN_CLIENT' | 'WIN_FREELANCER' | 'SPLIT'
  faultType: string;
  faultyParty: string; // 'raiser' | 'defendant' | 'both' | 'none'
  reasoning: VerdictReasoning;
  amountToFreelancer: number;
  amountToClient: number;
  platformFee?: number;
  trustScorePenalty?: number;
  isBanTriggered?: boolean;
  banDurationDays?: number;
  warningMessage?: string | null;
  tier: number; // 1 = Staff, 2 = Admin appeal
  isAppealVerdict: boolean;
  overridesVerdictId?: string | null;
  appealDeadline?: string | null;
  isAppealed?: boolean;
  appealReason?: string | null;
  appealedAt?: string | null;
  appealResolvedAt?: string | null;
  appealResolvedById?: string | null;
  appealResolution?: string | null;
  disputeStatus?: string | null;
  currentTier?: number | null;
  issuedAt: string;
  adjudicator?: {
    id: string;
    fullName?: string;
    email?: string;
  };
}

export interface AppealInput {
  reason: string;
  disclaimerAccepted: boolean;
  disclaimerVersion?: string;
}

export interface VerdictReadiness {
  canIssueVerdict: boolean;
  checklist: Record<string, boolean>;
  blockingChecklist?: string[];
  unmetChecklist: string[];
  unmetChecklistDetails: string[];
  absentRequiredParticipants?: Array<{
    participantId: string;
    userId: string;
    role: HearingParticipantRole;
  }>;
  context: {
    disputeId: string;
    disputeStatus?: string;
    disputePhase?: string;
    hearingId?: string | null;
    hearingStatus?: HearingStatus | null;
  };
}

export interface HearingVerdictInput {
  verdict: {
    result: string;
    adminComment: string;
    faultType: string;
    faultyParty: string;
    reasoning: VerdictReasoning;
    splitRatioClient?: number;
    amountToFreelancer?: number;
    amountToClient?: number;
    trustScorePenalty?: number;
    banUser?: boolean;
    banDurationDays?: number;
    warningMessage?: string;
  };
  closeHearing: {
    summary: string;
    findings: string;
    pendingActions?: Array<string | DisputeFollowUpAction>;
    forceEnd?: boolean;
    noShowNote?: string;
  };
}
