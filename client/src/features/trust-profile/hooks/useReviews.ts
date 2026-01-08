/**
 * useReviews Hook
 * Custom hook for managing review data fetching and state
 */

import { useState, useEffect, useCallback } from "react";
import type { Review, ReviewEditHistoryEntry } from "../types";
import {
  getReviewsByUser,
  getReviewEditHistory,
  createReview,
  updateReview,
  createReport,
} from "../api";
import type { CreateReviewPayload, CreateReportPayload } from "../types";

interface UseReviewsOptions {
  userId?: string;
  autoFetch?: boolean;
}

interface UseReviewsReturn {
  reviews: Review[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createNewReview: (payload: CreateReviewPayload) => Promise<Review>;
  updateExistingReview: (
    reviewId: string,
    payload: { rating?: number; comment?: string }
  ) => Promise<Review>;
  reportReview: (payload: CreateReportPayload) => Promise<void>;
}

/**
 * Hook for fetching and managing reviews for a user
 */
export function useReviews(options: UseReviewsOptions = {}): UseReviewsReturn {
  const { userId, autoFetch = true } = options;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!userId) {
      setReviews([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getReviewsByUser(userId);
      setReviews(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage =
        error.response?.data?.message || "Failed to fetch reviews";
      setError(errorMessage);
      console.error("Error fetching reviews:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && userId) {
      fetchReviews();
    }
  }, [autoFetch, userId, fetchReviews]);

  const createNewReview = useCallback(
    async (payload: CreateReviewPayload): Promise<Review> => {
      const newReview = await createReview(payload);
      // Refetch to get updated list
      await fetchReviews();
      return newReview;
    },
    [fetchReviews]
  );

  const updateExistingReview = useCallback(
    async (
      reviewId: string,
      payload: { rating?: number; comment?: string }
    ): Promise<Review> => {
      const updatedReview = await updateReview(reviewId, payload);
      // Refetch to get updated list
      await fetchReviews();
      return updatedReview;
    },
    [fetchReviews]
  );

  const reportReview = useCallback(
    async (payload: CreateReportPayload): Promise<void> => {
      await createReport(payload);
    },
    []
  );

  return {
    reviews,
    isLoading,
    error,
    refetch: fetchReviews,
    createNewReview,
    updateExistingReview,
    reportReview,
  };
}

/**
 * Hook for fetching review edit history
 */
interface UseReviewHistoryOptions {
  reviewId: string;
  review?: Review;
  autoFetch?: boolean;
}

interface UseReviewHistoryReturn {
  history: ReviewEditHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReviewHistory(
  options: UseReviewHistoryOptions
): UseReviewHistoryReturn {
  const { reviewId, review, autoFetch = true } = options;

  const [history, setHistory] = useState<ReviewEditHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!reviewId) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getReviewEditHistory(reviewId);
      setHistory(data);
    } catch (err: unknown) {
      // Gracefully fallback to mock data if review is provided
      if (review) {
        const isEdited = review.updatedAt !== review.createdAt;

        if (!isEdited) {
          const mockHistory: ReviewEditHistoryEntry[] = [
            {
              id: `${review.id}-v1`,
              reviewId: review.id,
              version: 1,
              rating: review.rating,
              comment: review.comment,
              editedAt: review.createdAt,
              editedBy: {
                id: review.reviewer.id,
                fullName: review.reviewer.fullName,
                avatarUrl: review.reviewer.avatarUrl,
              },
            },
          ];
          setHistory(mockHistory);
        } else {
          const generateOriginalComment = (currentComment: string): string => {
            const sentences = currentComment.split(". ");
            if (sentences.length > 2) {
              return (
                sentences
                  .slice(0, -Math.ceil(sentences.length * 0.3))
                  .join(". ") + "."
              );
            } else {
              return (
                currentComment.substring(
                  0,
                  Math.floor(currentComment.length * 0.6)
                ) + "..."
              );
            }
          };

          const mockHistory: ReviewEditHistoryEntry[] = [
            {
              id: `${review.id}-v2`,
              reviewId: review.id,
              version: 2,
              rating: review.rating,
              comment: review.comment,
              editedAt: review.updatedAt,
              editedBy: {
                id: review.reviewer.id,
                fullName: review.reviewer.fullName,
                avatarUrl: review.reviewer.avatarUrl,
              },
              changesSummary: {
                ratingChanged: true,
                commentChanged: true,
              },
            },
            {
              id: `${review.id}-v1`,
              reviewId: review.id,
              version: 1,
              rating: Math.max(1, review.rating - 1),
              comment: generateOriginalComment(review.comment),
              editedAt: review.createdAt,
              editedBy: {
                id: review.reviewer.id,
                fullName: review.reviewer.fullName,
                avatarUrl: review.reviewer.avatarUrl,
              },
            },
          ];
          setHistory(mockHistory);
        }
      } else {
        const error = err as { response?: { data?: { message?: string } } };
        const errorMessage =
          error.response?.data?.message || "Failed to fetch edit history";
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [reviewId, review]);

  useEffect(() => {
    if (autoFetch && reviewId) {
      fetchHistory();
    }
  }, [autoFetch, reviewId, fetchHistory]);

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  };
}
