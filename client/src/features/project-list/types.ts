export type Project = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  clientId: string;
  brokerId?: string;
  freelancerId?: string;
  totalBudget: number;
  currency?: string;
  createdAt: string;
  // Dispute-related fields (enriched by backend)
  hasActiveDispute?: boolean;
  activeDisputeCount?: number;
  client?: ProjectMember | null;
  broker?: ProjectMember | null;
  freelancer?: ProjectMember | null;
  reviewSummary?: ProjectReviewSummary;
  pendingReviewTargets?: ProjectMember[];
};

export type ProjectMember = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role: string;
};

export type ProjectReviewSummary = {
  totalReviewSlots: number;
  completedReviews: number;
  pendingReviews: number;
  currentUserPendingReviews: number;
  currentUserCanReview: boolean;
};
