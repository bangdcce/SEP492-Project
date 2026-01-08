/**
 * Review Service - API Layer
 * Handles all review-related API calls
 */

import { apiClient } from "@/shared/api/client";
import type {
  CreateReviewPayload,
  CreateReportPayload,
  Review,
  ReviewEditHistoryEntry,
} from "./types";

/**
 * Create a new review for a user on a completed project
 */
export const createReview = async (payload: CreateReviewPayload) => {
  return apiClient.post<Review>("/reviews", payload);
};

/**
 * Get reviews for a specific user
 */
export const getReviewsByUser = async (userId: string) => {
  return apiClient.get<Review[]>(`/reviews?targetUserId=${userId}`);
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
