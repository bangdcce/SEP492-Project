import { useMemo, useState } from "react";
import type { ProjectHistoryItem, Review, User } from "../types";
import { CreateReviewModal } from "../modals/CreateReviewModal";
import { ReviewItem } from "../components/review/ReviewItem";
import { ReviewsFullPage } from "../components/review/ReviewsFullPage";
import { TrustScoreCard } from "../components/review/TrustScoreCard";
import { StarRating } from "../components/ui/StarRating";

interface TrustProfileSectionProps {
  user: User;
  reviews: Review[];
  projectHistory: ProjectHistoryItem[];
  isLoading?: boolean;
  previewCount?: number;
  className?: string;
  currentUserId?: string;
  onReviewUpdated?: () => void;
}

export function TrustProfileSection({
  user,
  reviews,
  projectHistory,
  previewCount = 3,
  className = "",
  currentUserId,
  onReviewUpdated,
}: TrustProfileSectionProps) {
  const [isFullPageOpen, setIsFullPageOpen] = useState(false);
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false);

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
        const value = review.rating as 1 | 2 | 3 | 4 | 5;
        if (value >= 1 && value <= 5) {
          acc[value] += 1;
        }
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<1 | 2 | 3 | 4 | 5, number>,
    );

    return {
      totalReviews,
      averageScore,
      ratingDistribution,
    };
  }, [reviews]);

  const currentUserReviews = useMemo(() => {
    if (!currentUserId) {
      return [];
    }
    return reviews.filter((review) => review.reviewer.id === currentUserId);
  }, [currentUserId, reviews]);

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (currentUserId) {
        if (a.reviewer.id === currentUserId) return -1;
        if (b.reviewer.id === currentUserId) return 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reviews, currentUserId]);

  const sharedReviewableProjects = useMemo(() => {
    const isReviewableStatus = (status?: string | null) => {
      const normalized = String(status || "").toUpperCase();
      return normalized === "COMPLETED" || normalized === "PAID";
    };

    const includesUser = (
      project: ProjectHistoryItem,
      participantId?: string | null
    ) => {
      if (!participantId) {
        return false;
      }

      return (
        project.client?.id === participantId ||
        project.broker?.id === participantId ||
        project.freelancer?.id === participantId
      );
    };

    return [...projectHistory]
      .filter((project) => isReviewableStatus(project.status))
      .filter((project) => includesUser(project, user.id))
      .filter((project) => includesUser(project, currentUserId))
      .sort(
        (a, b) =>
          new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime(),
      );
  }, [projectHistory, currentUserId, user.id]);

  const latestPendingReviewProject = useMemo(() => {
    return (
      sharedReviewableProjects.find(
        (project) =>
          !currentUserReviews.some(
            (review) => review.project.id === project.projectId,
          ),
      ) || null
    );
  }, [currentUserReviews, sharedReviewableProjects]);

  const canCreateReview = Boolean(
    currentUserId &&
      currentUserId !== user.id &&
      latestPendingReviewProject?.projectId,
  );

  const previewReviews = sortedReviews.slice(0, previewCount);

  return (
    <>
      <div className={`grid grid-cols-1 gap-6 lg:grid-cols-12 ${className}`}>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-4">
            <TrustScoreCard user={user} />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-8" data-testid="trust-profile-reviews-section">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl text-slate-900">Reviews</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {stats.totalReviews} total review{stats.totalReviews === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
                {stats.totalReviews > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
                    <div className="text-2xl text-slate-900">{stats.averageScore.toFixed(1)}</div>
                    <StarRating rating={stats.averageScore} />
                  </div>
                ) : null}

                {canCreateReview ? (
                  <button
                    type="button"
                    data-testid="open-create-review"
                    onClick={() => setIsCreateReviewOpen(true)}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                  >
                    Leave a Review
                  </button>
                ) : null}
              </div>
            </div>

          {canCreateReview && latestPendingReviewProject ? (
              <p className="mt-3 text-xs text-slate-500">
                Review will be linked to project <span className="font-medium">{latestPendingReviewProject.title}</span>.
              </p>
            ) : null}
          </div>

          {stats.totalReviews === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
              <div className="mb-2 text-gray-400">
                <svg
                  className="mx-auto h-16 w-16"
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
              <h4 className="text-slate-900">No reviews yet</h4>
              <p className="text-sm text-gray-600">This user has not received any reviews yet.</p>
            </div>
          ) : (
            <>
              {!canCreateReview &&
              currentUserReviews.length > 0 &&
              sharedReviewableProjects.length > 0 ? (
                <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3">
                  <p className="text-sm text-teal-700">
                    You have already reviewed this user on every shared completed project.
                  </p>
                </div>
              ) : null}

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

              {stats.totalReviews > previewCount ? (
                <button
                  type="button"
                  onClick={() => setIsFullPageOpen(true)}
                  className="w-full rounded-lg border-2 border-teal-500 bg-white py-3 text-teal-600 shadow-sm transition-colors hover:bg-teal-50"
                >
                  See all {stats.totalReviews} reviews
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {isFullPageOpen ? (
        <ReviewsFullPage
          reviews={sortedReviews}
          stats={stats}
          onBack={() => setIsFullPageOpen(false)}
          currentUserId={currentUserId}
          onReviewUpdated={onReviewUpdated}
        />
      ) : null}

      {canCreateReview && latestPendingReviewProject ? (
        <CreateReviewModal
          isOpen={isCreateReviewOpen}
          onClose={() => setIsCreateReviewOpen(false)}
          projectId={latestPendingReviewProject.projectId}
          targetUser={{
            id: user.id,
            fullName: user.fullName,
          }}
          onSuccess={() => {
            onReviewUpdated?.();
            setIsCreateReviewOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
