//Badge Types
export type BadgeType = "NEW" | "VERIFIED" | "TRUSTED" | "WARNING" | "NORMAL";

//Trust Statistics
export interface TrustStats {
  finished: number;
  disputes: number;
  score: number | string;
}

//Simplified User Profile for Trust Display
export interface User {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  isEmailVerified?: boolean;
  currentTrustScore: number | string;
  badge: BadgeType;
  stats: TrustStats;
  role?: string;
  bio?: string;
  skills?: string[];
  createdAt?: string;
}
// Reviewer Information (Nested in Review)
export interface ReviewerInfo {
  id: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  badge?: BadgeType;
  currentTrustScore?: number;
  stats?: TrustStats;
  email?: string;
  joinedDate?: string;
}

// Project Information (Nested in Review)
export interface ProjectInfo {
  id: string;
  title: string;
  totalBudget: number;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  category?: string;
}

export interface ProjectHistoryItem {
  projectId: string;
  title: string;
  status: string;
  totalBudget: number;
  completedAt: string;
  targetRoleInProject: string;
  viewerRoleInProject?: string | null;
  client?: {
    id: string;
    fullName: string;
  } | null;
  broker?: {
    id: string;
    fullName: string;
  } | null;
  freelancer?: {
    id: string;
    fullName: string;
  } | null;
}

export interface TrustProfileResponse {
  user: User;
  reviews: Review[];
  projectHistory: ProjectHistoryItem[];
  reviewEligibility?: TrustProfileReviewEligibility;
}

export type TrustProfileReviewEligibilityReason =
  | "ELIGIBLE"
  | "SELF_PROFILE"
  | "VIEWER_NOT_AVAILABLE"
  | "NO_SHARED_COMPLETED_PROJECT"
  | "ALREADY_REVIEWED_ALL_SHARED_PROJECTS";

export interface TrustProfileReviewCandidateProject {
  projectId: string;
  title: string;
  status: string;
  completedAt: string;
  targetRoleInProject: string;
  viewerRoleInProject: string | null;
}

export interface TrustProfileReviewEligibility {
  canCreateReview: boolean;
  reason: TrustProfileReviewEligibilityReason;
  pendingReviewCount: number;
  nextProject: TrustProfileReviewCandidateProject | null;
}
// Review Entity
export interface Review {
  id: string;
  rating: number;
  comment: string;
  weight: number;
  createdAt: string;
  updatedAt: string; // For detecting edited reviews
  reviewer: ReviewerInfo;
  project: ProjectInfo;
}

// Review Statistics (for Preview Section)
export interface ReviewStats {
  averageScore: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}
// DTOs for API Calls
export interface CreateReviewPayload {
  projectId: string;
  targetUserId: string;
  rating: number;
  comment?: string;
}

// Filter & Sort Types
export type StarFilter = "all" | 1 | 2 | 3 | 4 | 5;
export type SortOption = "newest" | "relevant" | "lowest";

// Edit History Entry (for View Edit History feature)
export interface ReviewEditHistoryEntry {
  id: string;
  reviewId: string;
  version: number;
  rating: number;
  comment: string;
  editedAt: string;
  editedBy: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  changesSummary?: {
    ratingChanged: boolean;
    commentChanged: boolean;
  };
}

// Report Abuse Types
export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "DOXING"
  | "FAKE_REVIEW"
  | "INAPPROPRIATE_LANGUAGE"
  | "OFF_TOPIC"
  | "OTHER";

export interface CreateReportPayload {
  reviewId: string;
  reason: ReportReason;
  description?: string;
}

export type ReviewReportStatus = "PENDING" | "RESOLVED" | "REJECTED";

export interface ReviewReportActor {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface ReviewReportReviewSummary {
  id: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  reviewer?: ReviewReportActor | null;
}

export interface AdminReviewReport {
  id: string;
  reason: ReportReason;
  description?: string;
  status: ReviewReportStatus;
  adminNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  reporter?: ReviewReportActor | null;
  resolver?: ReviewReportActor | null;
  review: ReviewReportReviewSummary;
}

export interface PaginatedAdminReviewReports {
  data: AdminReviewReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Review Status Types (for Admin moderation)
export type ReviewStatus = "ACTIVE" | "FLAGGED" | "SOFT_DELETED";

// Report Info (for flagged reviews)
export interface ReportInfo {
  reportCount: number;
  reasons: ReportReason[];
  flaggedKeywords?: string[];
  lastReportedAt: string;
  reportedBy?: Array<{
    id: string;
    fullName: string;
  }>;
}

// Moderation History Entry (for tracking admin actions)
export interface ModerationHistoryEntry {
  id: string;
  action:
    | "SOFT_DELETE"
    | "RESTORE"
    | "DISMISS_REPORT"
    | "ASSIGNED"
    | "RELEASED";
  reason?: string;
  notes?: string;
  performedBy: {
    id: string;
    fullName: string;
    role?: string;
  };
  performedAt: string;
}

// Extended Review with Admin fields (for moderation pages)
export interface AdminReview extends Review {
  status: ReviewStatus;
  reportInfo?: ReportInfo;
  moderationHistory?: ModerationHistoryEntry[];
  openedBy?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  currentAssignee?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  lastAssignedBy?: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  lastAssignedAt?: string | null;
  assignmentVersion?: number;
  lockStatus?: {
    isOpened: boolean;
    isAssigned: boolean;
    openedById?: string | null;
    currentAssigneeId?: string | null;
  };
}
