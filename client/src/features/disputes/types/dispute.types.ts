import type {
  DisputeCategory,
  DisputePriority,
  DisputeStatus,
  DisputeType,
  DisputeResult,
  DisputePhase,
  UserRole,
} from "../../staff/types/staff.types";

export interface DisputeUserSummary {
  id: string;
  fullName?: string;
  email?: string;
  role?: UserRole;
  trustScore?: number;
  riskLevel?: string;
  totalReviews?: number;
}

export interface DisputeProjectSummary {
  id: string;
  title?: string;
  clientId?: string;
  brokerId?: string;
  freelancerId?: string;
}

export interface DisputeSummary {
  id: string;
  projectId: string;
  milestoneId: string;
  raisedById: string;
  raiserRole: UserRole;
  defendantId: string;
  defendantRole: UserRole;
  disputeType: DisputeType;
  category: DisputeCategory;
  priority: DisputePriority;
  disputedAmount?: number;
  reason: string;
  evidence?: string[];
  status: DisputeStatus;
  result: DisputeResult;
  phase?: DisputePhase;
  responseDeadline?: string;
  resolutionDeadline?: string;
  assignedStaffId?: string;
  infoRequestReason?: string;
  infoRequestDeadline?: string;
  infoRequestedAt?: string;
  infoProvidedAt?: string;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  isUrgent?: boolean;
  hoursUntilDeadline?: number | null;
  raiser?: DisputeUserSummary;
  defendant?: DisputeUserSummary;
  project?: DisputeProjectSummary;
}

export interface PaginatedDisputesResponse {
  data: DisputeSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  stats?: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    urgent: number;
  };
}

export interface DisputeFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  status?: DisputeStatus;
  statusIn?: DisputeStatus[];
  category?: DisputeCategory;
  priority?: DisputePriority;
  disputeType?: DisputeType;
  projectId?: string;
  milestoneId?: string;
  raisedById?: string;
  defendantId?: string;
  assignedStaffId?: string;
  includeUnassignedForStaff?: boolean;
  unassignedOnly?: boolean;
  createdFrom?: string;
  createdTo?: string;
  deadlineBefore?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  minDisputedAmount?: number;
  maxDisputedAmount?: number;
  overdueOnly?: boolean;
  urgentOnly?: boolean;
  appealed?: boolean;
  search?: string;
  asRaiser?: boolean;
  asDefendant?: boolean;
  asInvolved?: boolean;
}

export interface DisputeActivity {
  id: string;
  disputeId: string;
  actorId?: string;
  actorRole?: UserRole;
  action: string;
  description?: string;
  metadata?: Record<string, any>;
  isInternal?: boolean;
  timestamp: string;
  actor?: DisputeUserSummary;
}

export interface DisputeNote {
  id: string;
  disputeId: string;
  authorId: string;
  authorRole: UserRole;
  content: string;
  isInternal: boolean;
  isPinned: boolean;
  noteType: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  author?: DisputeUserSummary;
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  hearingId?: string | null;
  senderId?: string | null;
  senderRole?: UserRole | string;
  senderHearingRole?: "RAISER" | "DEFENDANT" | "WITNESS" | "MODERATOR" | "OBSERVER" | string;
  type?: string;
  content?: string | null;
  replyToMessageId?: string | null;
  relatedEvidenceId?: string | null;
  metadata?: Record<string, any> | null;
  isHidden?: boolean;
  hiddenReason?: string | null;
  createdAt: string;
  sender?: DisputeUserSummary;
}

export interface DisputeEvidence {
  id: string;
  disputeId: string;
  uploaderId: string;
  uploaderRole: string;
  storagePath?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  uploadedAt: string;
  signedUrl?: string;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  uploader?: {
    id: string;
    name?: string;
    fullName?: string;
  };
}

export interface DisputeEvidenceQuota {
  remaining: number;
  used: number;
  total: number;
}

export interface SettlementAttemptsSummary {
  raiserRemaining: number;
  defendantRemaining: number;
  maxAttemptsPerSide?: number;
}

export interface DisputeSettlement {
  id: string;
  disputeId: string;
  proposerId?: string;
  proposerRole?: UserRole | string;
  amountToFreelancer: number;
  amountToClient: number;
  terms?: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | string;
  rejectedReason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface DisputeComplexity {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timeEstimation: {
    minMinutes: number;
    recommendedMinutes: number;
    maxMinutes: number;
  };
  confidence: number;
}

export interface DisputeScheduleProposal {
  id: string;
  disputeId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: "ACTIVE" | "SUBMITTED" | "WITHDRAWN" | string;
  note?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SchedulingWorklistActionType =
  | "PROPOSE_SLOT"
  | "PROVIDE_INFO"
  | "CONFIRM_HEARING"
  | "NONE";

export type SchedulingWorklistPerspective = "RAISER" | "DEFENDANT" | "OTHER";

export type SchedulingWorklistNotEligibleReasonCode =
  | "TRIAGE_NOT_ACCEPTED"
  | "HEARING_ALREADY_SCHEDULED"
  | "DISPUTE_CLOSED"
  | "NO_PERMISSION"
  | "NONE";

export interface SchedulingWorklistItem {
  disputeId: string;
  displayCode: string;
  projectId?: string | null;
  projectTitle?: string | null;
  category?: string | null;
  status: DisputeStatus;
  perspective: SchedulingWorklistPerspective;
  raiserName?: string | null;
  raiserRole?: UserRole | string | null;
  defendantName?: string | null;
  defendantRole?: UserRole | string | null;
  counterpartyName?: string | null;
  counterpartyRole?: UserRole | string | null;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  assignedStaffEmail?: string | null;
  updatedAt: string;
  isNew: boolean;
  isSeen: boolean;
  requiresAction: boolean;
  actionType: SchedulingWorklistActionType;
  canProposeSlots: boolean;
  canCancel: boolean;
  notEligibleReasonCode: SchedulingWorklistNotEligibleReasonCode;
  notEligibleReasonText: string;
  infoRequestReason?: string | null;
  infoRequestDeadline?: string | null;
}

export interface SchedulingWorklistResponse {
  enabled: boolean;
  items: SchedulingWorklistItem[];
  generatedAt: string;
  degraded?: boolean;
  reasonCode?: "MIGRATION_REQUIRED" | "PARTIAL_DATA" | "NONE";
  message?: string;
}
