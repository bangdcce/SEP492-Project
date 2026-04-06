import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Flag,
  Gem,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EditReviewModal } from "../../modals/EditReviewModal";
import { ReportAbuseModal } from "../../modals/ReportAbuseModal";
import { ReviewDetailPage } from "../../pages/ReviewDetailPage";
import { ReviewEditHistoryPage } from "../../pages/ReviewEditHistoryPage";
import type { Review } from "../../types";
import { StarRating } from "../ui/StarRating";

interface ReviewItemProps {
  review: Review;
  isOwnReview?: boolean;
  onReviewUpdated?: () => void;
}

export function ReviewItem({
  review,
  isOwnReview = false,
  onReviewUpdated,
}: ReviewItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const [isDetailPageOpen, setIsDetailPageOpen] = useState(false);
  const [isHistoryPageOpen, setIsHistoryPageOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!commentRef.current) {
      return;
    }

    const lineHeight = parseInt(window.getComputedStyle(commentRef.current).lineHeight, 10);
    const height = commentRef.current.scrollHeight;
    const lines = Math.round(height / lineHeight);
    setShowReadMore(lines > 4);
  }, [review.comment]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const isEdited = review.updatedAt !== review.createdAt;
  const isHighValueProject = review.weight >= 1.5;

  const isEditableTime = () => {
    const createdAt = new Date(review.createdAt);
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 72;
  };

  const canEdit = isOwnReview && isEditableTime();

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    onReviewUpdated?.();
  };

  return (
    <>
      <div
        className={`relative rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md ${
          isOwnReview ? "border-teal-300 bg-teal-50/30" : "border-gray-200 bg-white"
        }`}
        data-testid={`review-card-${review.id}`}
      >
        {isOwnReview ? (
          <div className="absolute -top-2 left-4 rounded-md bg-teal-500 px-2 py-0.5 text-xs text-white">
            Your Review
          </div>
        ) : null}

        <div className="absolute right-4 top-4">
          <div className="relative">
            <button
              type="button"
              data-testid={`review-menu-${review.id}`}
              onClick={() => setShowMenu((value) => !value)}
              className="rounded-lg p-1 transition-colors hover:bg-gray-100"
            >
              <MoreVertical className="h-5 w-5 text-gray-500" />
            </button>

            {showMenu ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {canEdit ? (
                    <button
                      type="button"
                      data-testid={`edit-review-${review.id}`}
                      onClick={() => {
                        setIsEditModalOpen(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4 text-teal-500" />
                      Edit Review
                    </button>
                  ) : null}

                  {isOwnReview && !isEditableTime() ? (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400">
                      <Pencil className="h-4 w-4" />
                      Edit expired (72h limit)
                    </div>
                  ) : null}

                  {!isOwnReview ? (
                    <button
                      type="button"
                      data-testid={`report-review-${review.id}`}
                      onClick={() => {
                        setIsReportModalOpen(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Flag className="h-4 w-4 text-red-500" />
                      Report Review
                    </button>
                  ) : null}

                  <button
                    type="button"
                    data-testid={`review-history-${review.id}`}
                    onClick={() => {
                      setIsHistoryPageOpen(true);
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Clock className="h-4 w-4 text-gray-500" />
                    View Edit History
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className={`mb-4 flex items-start gap-3 ${isOwnReview ? "mt-2" : ""}`}>
          <div
            className="shrink-0 cursor-pointer"
            onClick={() => setIsDetailPageOpen(true)}
            data-testid={`review-avatar-${review.id}`}
          >
            {review.reviewer.avatarUrl ? (
              <img
                src={review.reviewer.avatarUrl}
                alt={review.reviewer.fullName}
                className="h-10 w-10 rounded-lg border border-gray-200 object-cover transition-colors hover:border-teal-500"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-slate-100 transition-colors hover:border-teal-500">
                <span className="text-slate-900">
                  {review.reviewer.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="mb-1 cursor-pointer text-slate-900 transition-colors hover:text-teal-600"
              onClick={() => setIsDetailPageOpen(true)}
            >
              {review.reviewer.fullName}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {formatDate(review.createdAt)}
              {isEdited ? <span className="text-xs italic text-gray-400">(edited)</span> : null}
            </div>
          </div>
        </div>

        <div className="mb-3 pl-13">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Project:</span>
            <span
              className="cursor-pointer text-sm text-slate-900 transition-colors hover:text-teal-600"
              onClick={() => setIsDetailPageOpen(true)}
            >
              {review.project.title}
            </span>
            {isHighValueProject ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                <Gem className="h-3 w-3" />
                High Value Project
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-gray-500">Budget: {formatUSD(review.project.totalBudget)}</div>
        </div>

        <div className="mb-3 pl-13">
          <StarRating rating={review.rating} editable={false} />
        </div>

        {review.comment ? (
          <div className="pl-13">
            <div
              ref={commentRef}
              className={`text-sm leading-relaxed text-gray-700 ${
                !isExpanded && showReadMore ? "line-clamp-4" : ""
              }`}
            >
              {review.comment}
            </div>

            {showReadMore ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setIsExpanded((value) => !value)}
                  className="flex items-center gap-1 text-sm text-teal-600 transition-colors hover:text-teal-700"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Read more
                    </>
                  )}
                </button>
              </div>
            ) : null}

            <div className="mt-4 border-t border-gray-200 pt-4">
              <button
                type="button"
                data-testid={`review-details-${review.id}`}
                onClick={() => setIsDetailPageOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-500 bg-white px-4 py-2.5 text-teal-600 transition-colors hover:bg-teal-50"
              >
                <FileText className="h-4 w-4" />
                View Full Review Details
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isDetailPageOpen ? (
        <ReviewDetailPage review={review} onBack={() => setIsDetailPageOpen(false)} />
      ) : null}

      {isHistoryPageOpen ? (
        <ReviewEditHistoryPage review={review} onBack={() => setIsHistoryPageOpen(false)} />
      ) : null}

      {isEditModalOpen ? (
        <EditReviewModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          review={review}
          onSuccess={handleEditSuccess}
        />
      ) : null}

      {isReportModalOpen ? (
        <ReportAbuseModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          review={review}
          onSuccess={() => setIsReportModalOpen(false)}
        />
      ) : null}
    </>
  );
}
