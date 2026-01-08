/**
 * Admin Review Service - API Layer
 * Handles admin-specific review moderation API calls
 */

import { apiClient } from "@/shared/api/client";
import type { AdminReview } from "../types";

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
  // [DEV] Using test endpoint without auth - change back to /reviews/admin/moderation for production
  return apiClient.get<AdminReview[]>(
    `/reviews/test/moderation${queryString ? `?${queryString}` : ""}`
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
  // [DEV] Using test endpoint without auth
  return apiClient.delete<{
    message: string;
  }>(`/reviews/test/${reviewId}`, {
    data: { reason: fullReason },
  });
};

/**
 * Restore a soft-deleted review (Admin only)
 * @param reviewId - ID of the review to restore
 * @param reason - Reason for restoration
 */
export const restoreReview = async (reviewId: string, reason: string) => {
  // [DEV] Using test endpoint without auth
  return apiClient.post<{
    message: string;
    review: AdminReview;
  }>(`/reviews/test/${reviewId}/restore`, { reason });
};

/**
 * Dismiss a report on a review (Admin only)
 * @param reviewId - ID of the review with the report
 * @param reason - Reason for dismissing the report
 */
export const dismissReport = async (reviewId: string, reason?: string) => {
  // [DEV] Using test endpoint without auth
  return apiClient.post<{
    message: string;
  }>(`/reviews/test/${reviewId}/dismiss-report`, { reason });
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
