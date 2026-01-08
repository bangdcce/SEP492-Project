//Badge Types
export type BadgeType = "NEW" | "VERIFIED" | "TRUSTED" | "WARNING" | "NORMAL";

//Trust Statistics
export interface TrustStats {
  finished: number;
  disputes: number;
  score: number;
}

//Simplified User Profile for Trus Display
export interface User {
  id: string;
  fullName: string;
  avatarUrl: string;
  isVerified: boolean;
  currentTrustScore: number;
  badge: BadgeType;
  stats: TrustStats;
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
  action: "SOFT_DELETE" | "RESTORE" | "DISMISS_REPORT";
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
}
