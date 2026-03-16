/**
 * Admin Review Service - API Layer
 * Handles admin-specific review moderation API calls
 */

import { apiClient } from "@/shared/api/client";
import type { AdminReview } from "../types";

export interface ModerationAssigneeOption {
  id: string;
  fullName: string;
  email?: string;
  role?: string;
}

/**
 * Get all reviews for admin moderation
 * @param filters - Optional filters for status, etc.
 */
export const getReviewsForModeration = async (filters?: {
  status?: string;
  page?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  return apiClient.get<AdminReview[]>(
    `/reviews/admin/moderation${queryString ? `?${queryString}` : ""}`
  );
};

/**
 * Soft delete a review (Admin only)
 * @param reviewId - ID of the review to soft delete
 * @param reason - Reason for deletion
 * @param notes - Optional additional notes (appended to reason)
 */
export const softDeleteReview = async (
  reviewId: string,
  reason: string,
  notes?: string
) => {
  const fullReason = notes ? `${reason}: ${notes}` : reason;
  return apiClient.delete<{
    message: string;
  }>(`/reviews/${reviewId}`, {
    data: { reason: fullReason },
  });
};

/**
 * Restore a soft-deleted review (Admin only)
 * @param reviewId - ID of the review to restore
 * @param reason - Reason for restoration
 */
export const restoreReview = async (reviewId: string, reason: string) => {
  return apiClient.post<{
    message: string;
    review: AdminReview;
  }>(`/reviews/${reviewId}/restore`, { reason });
};

/**
 * Dismiss a report on a review (Admin only)
 * @param reviewId - ID of the review with the report
 * @param reason - Reason for dismissing the report
 */
export const dismissReport = async (reviewId: string, reason?: string) => {
  return apiClient.post<{
    message: string;
  }>(`/reviews/${reviewId}/dismiss-report`, { reason });
};

export const openModerationCase = async (
  reviewId: string,
  assignmentVersion: number
) => {
  return apiClient.post<AdminReview>(
    `/reviews/admin/moderation/${reviewId}/open`,
    { assignmentVersion },
  );
};

export const takeModerationCase = async (
  reviewId: string,
  assignmentVersion: number
) => {
  return apiClient.post<AdminReview>(
    `/reviews/admin/moderation/${reviewId}/take`,
    { assignmentVersion },
  );
};

export const releaseModerationCase = async (
  reviewId: string,
  assignmentVersion: number
) => {
  return apiClient.post<AdminReview>(
    `/reviews/admin/moderation/${reviewId}/release`,
    { assignmentVersion },
  );
};

export const reassignModerationCase = async (
  reviewId: string,
  assigneeId: string,
  assignmentVersion: number,
  reason?: string,
) => {
  return apiClient.post<AdminReview>(
    `/reviews/admin/moderation/${reviewId}/reassign`,
    { assigneeId, assignmentVersion, reason },
  );
};

/**
 * Get flagged reviews that need attention
 */
export const getFlaggedReviews = async () => {
  return apiClient.get<AdminReview[]>(`/reviews/admin/flagged`);
};

/**
 * Bulk action on multiple reviews
 * @param reviewIds - Array of review IDs
 * @param action - Action to perform
 * @param reason - Reason for the action
 */
export const bulkModerationAction = async (
  reviewIds: string[],
  action: "SOFT_DELETE" | "RESTORE" | "DISMISS_REPORT",
  reason: string
) => {
  return apiClient.post<{
    success: boolean;
    processedCount: number;
    results: Array<{
      reviewId: string;
      success: boolean;
      error?: string;
    }>;
  }>(`/reviews/admin/bulk-action`, {
    reviewIds,
    action,
    reason,
  });
};

export const getModerationAssignees = async () => {
  const response = await apiClient.get<{
    users?: Array<{
      id: string;
      fullName?: string | null;
      email?: string | null;
      role?: string | null;
    }>;
  }>("/users", {
    params: {
      role: "ADMIN",
      limit: 100,
    },
  });

  return (response.users || []).map((user) => ({
    id: user.id,
    fullName: user.fullName || user.email || "Admin",
    email: user.email || undefined,
    role: user.role || undefined,
  })) as ModerationAssigneeOption[];
};
