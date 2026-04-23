import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, CalendarDays, CheckCircle2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from "@/shared/components/ui";
import type {
  ProjectHistoryItem,
  Review,
  TrustProfileReviewCandidateProject,
  TrustProfileReviewEligibility,
  User,
} from "../types";
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
  reviewEligibility?: TrustProfileReviewEligibility;
  onReviewUpdated?: () => void;
}

export function TrustProfileSection({
  user,
  reviews,
  projectHistory,
  previewCount = 3,
  className = "",
  currentUserId,
  reviewEligibility,
  onReviewUpdated,
}: TrustProfileSectionProps) {
  const [isFullPageOpen, setIsFullPageOpen] = useState(false);
  const profileDomains = Array.isArray(user.userDomains)
    ? user.userDomains
    : [];
  const joinedDateLabel = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : null;
  const roleLabel = String(user.role || "")
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const avatarFallback = user.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formatCompletedDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Unknown date";
    }
    return parsed.toLocaleDateString();
  };

  const getWorkspacePath = (
    projectId: string,
    viewerRoleInProject?: string | null,
  ) => {
    const role = String(viewerRoleInProject || "").toUpperCase();

    if (role === "BROKER") {
      return `/broker/workspace/${projectId}`;
    }

    if (role === "FREELANCER") {
      return `/freelancer/workspace/${projectId}`;
    }

    if (role === "STAFF") {
      return `/projects/${projectId}`;
    }

    return `/client/workspace/${projectId}`;
  };

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
      participantId?: string | null,
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
          new Date(b.completedAt || 0).getTime() -
          new Date(a.completedAt || 0).getTime(),
      );
  }, [projectHistory, currentUserId, user.id]);

  const computedPendingReviewProjects = useMemo(() => {
    return sharedReviewableProjects.filter(
      (project) =>
        !currentUserReviews.some(
          (review) => review.project.id === project.projectId,
        ),
    );
  }, [currentUserReviews, sharedReviewableProjects]);

  const pendingReviewProjects = useMemo<
    TrustProfileReviewCandidateProject[]
  >(() => {
    if (reviewEligibility?.pendingProjects?.length) {
      return [...reviewEligibility.pendingProjects].sort(
        (a, b) =>
          new Date(b.completedAt || 0).getTime() -
          new Date(a.completedAt || 0).getTime(),
      );
    }

    return [...computedPendingReviewProjects]
      .map((project) => ({
        projectId: project.projectId,
        title: project.title,
        status: project.status,
        completedAt: project.completedAt,
        targetRoleInProject: project.targetRoleInProject,
        viewerRoleInProject: project.viewerRoleInProject ?? null,
      }))
      .sort(
        (a, b) =>
          new Date(b.completedAt || 0).getTime() -
          new Date(a.completedAt || 0).getTime(),
      );
  }, [reviewEligibility, computedPendingReviewProjects]);

  const pendingReviewCount =
    reviewEligibility?.pendingReviewCount ?? pendingReviewProjects.length;

  const viewerCanReviewTarget = Boolean(
    currentUserId && currentUserId !== user.id,
  );
  const hasPendingReviewDebt = pendingReviewCount > 0;
  const pendingReviewPreview = pendingReviewProjects.slice(0, 3);

  const previewReviews = sortedReviews.slice(0, previewCount);

  return (
    <>
      <div className={`space-y-6 ${className}`}>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-20 w-20 border-2 border-slate-100 shadow-sm">
              <AvatarImage
                src={user.avatarUrl || undefined}
                alt={user.fullName}
              />
              <AvatarFallback className="bg-slate-100 text-lg font-semibold text-slate-700">
                {avatarFallback}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Public Profile
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
                {user.fullName}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {roleLabel ? (
                  <Badge
                    variant="secondary"
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                  >
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    {roleLabel}
                  </Badge>
                ) : null}

                {user.isVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    KYC Verified
                  </span>
                ) : null}

                {joinedDateLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Joined {joinedDateLabel}
                  </span>
                ) : null}
              </div>

              {user.bio ? (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {user.bio}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-4">
              <TrustScoreCard user={user} />

              {profileDomains.length > 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Domains & Industries
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Public areas this profile works in.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profileDomains.map((domain) => (
                      <span
                        key={domain.id}
                        className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
                      >
                        {domain.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="space-y-4 lg:col-span-8"
            data-testid="trust-profile-reviews-section"
          >
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl text-slate-900">Reviews</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {stats.totalReviews} total review
                    {stats.totalReviews === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  {stats.totalReviews > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
                      <div className="text-2xl text-slate-900">
                        {stats.averageScore.toFixed(1)}
                      </div>
                      <StarRating rating={stats.averageScore} />
                    </div>
                  ) : null}
                </div>
              </div>

              {hasPendingReviewDebt ? (
                <div
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
                  data-testid="review-debt-row"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-amber-900">
                      Review debt: {pendingReviewCount} completed shared project
                      {pendingReviewCount === 1 ? "" : "s"} waiting for your
                      review.
                    </p>
                    <span className="text-[11px] text-amber-800">
                      Showing {pendingReviewPreview.length} of{" "}
                      {pendingReviewCount}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-amber-800">
                    Open each project workspace to create the missing reviews.
                  </p>

                  <div className="mt-3 space-y-2">
                    {pendingReviewPreview.map((project) => (
                      <div
                        key={project.projectId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {project.title}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            #{project.projectId.slice(0, 8)} ·{" "}
                            {formatCompletedDate(project.completedAt)} · You:{" "}
                            {project.viewerRoleInProject || "UNKNOWN"} · Target:{" "}
                            {project.targetRoleInProject}
                          </p>
                        </div>

                        <Link
                          to={getWorkspacePath(
                            project.projectId,
                            project.viewerRoleInProject,
                          )}
                          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
                        >
                          Open workspace
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {viewerCanReviewTarget &&
              !hasPendingReviewDebt &&
              reviewEligibility?.reason === "NO_SHARED_COMPLETED_PROJECT" ? (
                <p className="mt-3 text-xs text-slate-500">
                  You can only review this profile after completing at least one
                  shared project.
                </p>
              ) : null}

              {viewerCanReviewTarget &&
              !hasPendingReviewDebt &&
              reviewEligibility?.reason ===
                "ALREADY_REVIEWED_ALL_SHARED_PROJECTS" ? (
                <p className="mt-3 text-xs text-slate-500">
                  You have already reviewed this user for every completed shared
                  project.
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
                <p className="text-sm text-gray-600">
                  This user has not received any reviews yet.
                </p>
              </div>
            ) : (
              <>
                {!hasPendingReviewDebt &&
                currentUserReviews.length > 0 &&
                sharedReviewableProjects.length > 0 ? (
                  <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3">
                    <p className="text-sm text-teal-700">
                      You have already reviewed this user on every shared
                      completed project.
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
    </>
  );
}
