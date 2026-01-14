/**
 * TrustProfileSection Component
 * Complete, reusable trust profile display with reviews
 *
 * Features:
 * - Grid layout: Trust Score Card (4 cols) + Reviews (8 cols)
 * - Sticky trust card on scroll
 * - Built-in "See all reviews" functionality
 * - Automatic stats calculation
 * - Full-page reviews view
 * - Current user's review prioritized at top
 * - Edit functionality for own reviews
 *
 * Usage:
 * <TrustProfileSection
 *   user={userData}
 *   reviews={reviewsData}
 *   currentUserId="logged-in-user-id"
 * />
 */

import { useState, useMemo } from "react";
import type { Review, User } from "../types";
import { TrustScoreCard } from "../components/review/TrustScoreCard";
import { ReviewItem } from "../components/review/ReviewItem";
import { StarRating } from "../components/ui/StarRating";
import { ReviewsFullPage } from "../components/review/ReviewsFullPage";

interface TrustProfileSectionProps {
  user: User;
  reviews: Review[];
  isLoading?: boolean;
  /** Number of reviews to show initially (default: 3) */
  previewCount?: number;
  /** Custom className for the container */
  className?: string;
  /** Current logged-in user ID - used to prioritize own review and enable edit */
  currentUserId?: string;
  /** Callback when review is updated (for refreshing data) */
  onReviewUpdated?: () => void;
}

export function TrustProfileSection({
  user,
  reviews,
  previewCount = 3,
  className = "",
  currentUserId,
  onReviewUpdated,
}: TrustProfileSectionProps) {
  const [isFullPageOpen, setIsFullPageOpen] = useState(false);

  // Calculate stats from reviews
  const stats = useMemo(() => {
    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        averageScore: 0,
        ratingDistribution: {
          5: 0,
          4: 0,
          3: 0,
          2: 0,
          1: 0,
        },
      };
    }

    const totalScore = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageScore = totalScore / totalReviews;

    const ratingDistribution = reviews.reduce(
      (acc, review) => {
        const rating = review.rating as 1 | 2 | 3 | 4 | 5;
        if (rating >= 1 && rating <= 5) {
          acc[rating]++;
        }
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
    );

    return {
      totalReviews,
      averageScore,
      ratingDistribution,
    };
  }, [reviews]);

  // Find current user's review (if exists)
  const currentUserReview = useMemo(() => {
    if (!currentUserId) return null;
    return reviews.find((r) => r.reviewer.id === currentUserId) || null;
  }, [reviews, currentUserId]);

  // Sort reviews: current user's review first, then by date (newest first)
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      // Current user's review always first
      if (currentUserId) {
        if (a.reviewer.id === currentUserId) return -1;
        if (b.reviewer.id === currentUserId) return 1;
      }
      // Then sort by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reviews, currentUserId]);

  const previewReviews = sortedReviews.slice(0, previewCount);

  return (
    <>
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${className}`}>
        {/* Left Column: Trust Score Card (4/12 - Sticky) */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-4">
            <TrustScoreCard user={user} />
          </div>
        </div>

        {/* Right Column: Reviews Section (8/12) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Reviews Header Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-slate-900 text-xl">Reviews</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.totalReviews} total review
                  {stats.totalReviews !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Average Rating Display - Compact */}
              {stats.totalReviews > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="text-2xl text-slate-900">
                    {stats.averageScore.toFixed(1)}
                  </div>
                  <StarRating rating={stats.averageScore} />
                </div>
              )}
            </div>
          </div>

          {/* Reviews List */}
          {stats.totalReviews === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 shadow-sm text-center">
              <div className="text-gray-400 mb-2">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h4 className="text-slate-900 mb-1">No reviews yet</h4>
              <p className="text-sm text-gray-600">
                This user hasn't received any reviews yet.
              </p>
            </div>
          ) : (
            <>
              {/* Show "Your Review" badge if current user has reviewed */}
              {currentUserReview && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-teal-700">
                    ✓ You have already reviewed this user
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {previewReviews.map((review) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    isOwnReview={currentUserId === review.reviewer.id}
                    onReviewUpdated={onReviewUpdated}
                  />
                ))}
              </div>

              {/* See All Reviews Button */}
              {stats.totalReviews > previewCount && (
                <button
                  onClick={() => setIsFullPageOpen(true)}
                  className="
                    w-full py-3 rounded-lg border-2 border-teal-500 
                    text-teal-600 hover:bg-teal-50 transition-colors
                    bg-white shadow-sm
                  "
                >
                  See all {stats.totalReviews} reviews
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full Reviews Page Overlay */}
      {isFullPageOpen && (
        <ReviewsFullPage
          reviews={sortedReviews}
          stats={stats}
          onBack={() => setIsFullPageOpen(false)}
          currentUserId={currentUserId}
          onReviewUpdated={onReviewUpdated}
        />
      )}
    </>
  );
}
