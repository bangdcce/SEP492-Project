import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
  MessageSquareQuote,
  Star,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { buildTrustProfilePath } from "@/features/trust-profile/routes";
import { CreateReviewModal } from "@/features/trust-profile/modals/CreateReviewModal";
import { getReviewsByUser } from "@/features/trust-profile/api";
import type { Review } from "@/features/trust-profile/types";
import type {
  WorkspaceProject,
  WorkspaceProjectParticipant,
} from "../../api";
import type { Milestone } from "../../types";

type ProjectReviewActionsCardProps = {
  project: WorkspaceProject;
  milestones: Milestone[];
  currentUserId?: string | null;
  currentUserRole?: string | null;
  pathname: string;
};

type ReviewTarget = WorkspaceProjectParticipant & {
  roleLabel: string;
};

const FINAL_REVIEWABLE_MILESTONE_STATUSES = new Set(["PAID"]);

const toTimestamp = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const getFinalMilestone = (milestones: Milestone[]): Milestone | null => {
  if (milestones.length === 0) {
    return null;
  }

  const sorted = [...milestones].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftDueDate = toTimestamp(left.dueDate);
    const rightDueDate = toTimestamp(right.dueDate);
    if (leftDueDate !== rightDueDate) {
      return leftDueDate - rightDueDate;
    }

    const leftCreatedAt = toTimestamp(left.createdAt);
    const rightCreatedAt = toTimestamp(right.createdAt);
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    return left.id.localeCompare(right.id);
  });

  return sorted[sorted.length - 1];
};

const participantRoleLabel = (role?: string | null) => {
  switch (String(role || "").toUpperCase()) {
    case "CLIENT":
      return "Client";
    case "BROKER":
      return "Broker";
    case "FREELANCER":
      return "Freelancer";
    default:
      return "Participant";
  }
};

export function ProjectReviewActionsCard({
  project,
  milestones,
  currentUserId,
  currentUserRole,
  pathname,
}: ProjectReviewActionsCardProps) {
  const [reviewsByTargetId, setReviewsByTargetId] = useState<Record<string, Review[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTarget, setActiveTarget] = useState<ReviewTarget | null>(null);

  const refreshTargetReviews = useCallback(async (targetId: string) => {
    const reviews = await getReviewsByUser(targetId);
    setReviewsByTargetId((current) => ({
      ...current,
      [targetId]: reviews,
    }));
  }, []);

  const finalMilestone = useMemo(
    () => getFinalMilestone(milestones),
    [milestones],
  );

  const isFinalMilestoneReadyForReview = FINAL_REVIEWABLE_MILESTONE_STATUSES.has(
    String(finalMilestone?.status || "").toUpperCase(),
  );

  const reviewableTargets = useMemo<ReviewTarget[]>(() => {
    const participants = [project.client, project.broker, project.freelancer];
    const deduped = new Map<string, ReviewTarget>();

    for (const participant of participants) {
      if (!participant?.id || participant.id === currentUserId || deduped.has(participant.id)) {
        continue;
      }

      deduped.set(participant.id, {
        ...participant,
        roleLabel: participantRoleLabel(participant.role),
      });
    }

    return Array.from(deduped.values());
  }, [currentUserId, project.broker, project.client, project.freelancer]);

  const isRatingAvailable =
    Boolean(currentUserId && currentUserId.trim().length > 0) &&
    isFinalMilestoneReadyForReview &&
    reviewableTargets.length > 0;

  useEffect(() => {
    let isCancelled = false;

    const loadReviewStatus = async () => {
      if (!isRatingAvailable) {
        setReviewsByTargetId({});
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const reviewPairs = await Promise.all(
          reviewableTargets.map(async (target) => [
            target.id,
            await getReviewsByUser(target.id),
          ] as const),
        );

        if (isCancelled) {
          return;
        }

        setReviewsByTargetId(Object.fromEntries(reviewPairs));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadReviewStatus();

    return () => {
      isCancelled = true;
    };
  }, [isRatingAvailable, project.id, reviewableTargets]);

  const targetState = useMemo(() => {
    return reviewableTargets.map((target) => {
      const existingReview = (reviewsByTargetId[target.id] || []).find(
        (review) =>
          review.reviewer.id === currentUserId && review.project.id === project.id,
      );

      return {
        ...target,
        existingReview,
      };
    });
  }, [currentUserId, project.id, reviewableTargets, reviewsByTargetId]);

  const hasPendingReview = targetState.some((target) => !target.existingReview);

  if (!isRatingAvailable) {
    return null;
  }

  return (
    <>
      <section className="rounded-[1.9rem] border border-teal-200 bg-linear-to-br from-teal-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="border-teal-200 bg-white text-teal-700 hover:bg-white">
                Post-delivery
              </Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                Reviews open
              </Badge>
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Rate project participants
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Final milestone{finalMilestone?.title ? ` (${finalMilestone.title})` : ""} is paid. Submit participant feedback here, and it will map directly to Trust Profile reviews and trust score updates.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
            {hasPendingReview
              ? "At least one review is still pending for this project."
              : "All available participant reviews for this project have been submitted."}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {targetState.map((target) => {
            const profilePath = buildTrustProfilePath(target.id, {
              role: currentUserRole,
              pathname,
            });

            return (
              <div
                key={target.id}
                className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">
                      {target.fullName || "Unknown user"}
                    </p>
                    <p className="text-sm text-slate-500">{target.roleLabel}</p>
                  </div>

                  {target.existingReview ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      Reviewed
                    </Badge>
                  ) : (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                      Pending
                    </Badge>
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {target.existingReview ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        You already submitted a review for this participant on <span className="font-medium">{project.title || "this project"}</span>.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>
                        Rating for <span className="font-medium">{project.title || "this project"}</span> is ready now that delivery and escrow release are complete.
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {!target.existingReview ? (
                    <button
                      type="button"
                      onClick={() => setActiveTarget(target)}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                    >
                      <Star className="h-4 w-4" />
                      Rate {target.roleLabel}
                    </button>
                  ) : null}

                  <Link
                    to={profilePath}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Trust Profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Loading review availability...</p>
        ) : null}
      </section>

      {activeTarget ? (
        <CreateReviewModal
          isOpen
          onClose={() => setActiveTarget(null)}
          projectId={project.id}
          targetUser={{
            id: activeTarget.id,
            fullName: activeTarget.fullName || "Unknown user",
          }}
          onSuccess={() => {
            const targetId = activeTarget.id;
            void refreshTargetReviews(targetId);
            setActiveTarget(null);
          }}
        />
      ) : null}
    </>
  );
}
