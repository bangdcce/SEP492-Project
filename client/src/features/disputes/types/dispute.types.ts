import type {
  DisputeCategory,
  DisputePriority,
  DisputeStatus,
  DisputeType,
  DisputeResult,
  UserRole,
} from "../../staff/types/staff.types";

export interface DisputeUserSummary {
  id: string;
  fullName?: string;
  email?: string;
  role?: UserRole;
}

export interface DisputeProjectSummary {
  id: string;
  title?: string;
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
  responseDeadline?: string;
  resolutionDeadline?: string;
  assignedStaffId?: string;
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
  category?: DisputeCategory;
  priority?: DisputePriority;
  disputeType?: DisputeType;
  projectId?: string;
  raisedById?: string;
  defendantId?: string;
  createdFrom?: string;
  createdTo?: string;
  deadlineBefore?: string;
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

export interface DisputeComplexity {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timeEstimation: {
    minMinutes: number;
    recommendedMinutes: number;
    maxMinutes: number;
  };
  confidence: number;
}
