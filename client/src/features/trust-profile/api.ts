/**
 * Review Service - API Layer
 * Handles all review-related API calls
 */

import { apiClient } from "@/shared/api/client";
import type {
  CreateReviewPayload,
  CreateReportPayload,
  ProjectReviewAvailability,
  TrustProfileResponse,
  Review,
  ReviewEditHistoryEntry,
} from "./types";

/**
 * Create a new review for a user on a completed project
 */
export const createReview = async (payload: CreateReviewPayload) => {
  return apiClient.post<Review>("/reviews", payload);
};

export const getTrustProfile = async (userId: string) => {
  return apiClient.get<TrustProfileResponse>(`/trust-profiles/${userId}`);
};

/**
 * Get reviews for a specific user
 */
export const getReviewsByUser = async (userId: string) => {
  return apiClient.get<Review[]>(`/reviews?targetUserId=${userId}`);
};

export const getProjectReviewStatus = async (
  projectId: string,
  targetUserId: string,
) => {
  const searchParams = new URLSearchParams({
    projectId,
    targetUserId,
  });

  return apiClient.get<ProjectReviewAvailability>(
    `/reviews/status?${searchParams.toString()}`,
  );
};

/**
 * Update an existing review (within 72 hours)
 */
export const updateReview = async (
  reviewId: string,
  payload: { rating?: number; comment?: string }
) => {
  return apiClient.patch<Review>(`/reviews/${reviewId}`, payload);
};

/**
 * Get edit history for a review
 */
export const getReviewEditHistory = async (reviewId: string) => {
  return apiClient.get<ReviewEditHistoryEntry[]>(
    `/reviews/${reviewId}/history`
  );
};

/**
 * Report a review for abuse
 */
export const createReport = async (payload: CreateReportPayload) => {
  return apiClient.post("/reports", payload);
};
