import {
  Gem,
  MoreVertical,
  Flag,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Pencil,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Review } from "../../types";
import { StarRating } from "../ui/StarRating";
import { ReviewDetailPage } from "../../pages/ReviewDetailPage";
import { EditReviewModal } from "../../modals/EditReviewModal";
import { ReportAbuseModal } from "../../modals/ReportAbuseModal";

interface ReviewItemProps {
  review: Review;
  /** Whether this review belongs to the current logged-in user */
  isOwnReview?: boolean;
  /** Callback when review is updated */
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  // Check if comment needs truncation
  useEffect(() => {
    if (commentRef.current) {
      const lineHeight = parseInt(
        window.getComputedStyle(commentRef.current).lineHeight
      );
      const height = commentRef.current.scrollHeight;
      const lines = Math.round(height / lineHeight);

      setShowReadMore(lines > 4);
    }
  }, [review.comment]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  // Format VND currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // Check if review was edited
  const isEdited = review.updatedAt !== review.createdAt;

  // Check if high value project
  const isHighValueProject = review.weight >= 1.5;

  // Check if review is still editable (within 72 hours)
  const isEditableTime = () => {
    const createdAt = new Date(review.createdAt);
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 72;
  };

  const canEdit = isOwnReview && isEditableTime();

  // Handle menu actions
  const handleEditReview = () => {
    setIsEditModalOpen(true);
    setShowMenu(false);
  };

  const handleReportAbuse = () => {
    setIsReportModalOpen(true);
    setShowMenu(false);
  };

  const handleViewHistory = () => {
    // Navigate to detail page which shows history
    setIsDetailPageOpen(true);
    setShowMenu(false);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    if (onReviewUpdated) {
      onReviewUpdated();
    }
  };

  return (
    <>
      <div
        className={`bg-white border rounded-lg p-4 shadow-sm relative hover:shadow-md transition-shadow ${
          isOwnReview ? "border-teal-300 bg-teal-50/30" : "border-gray-200"
        }`}
      >
        {/* Own Review Badge */}
        {isOwnReview && (
          <div className="absolute -top-2 left-4 px-2 py-0.5 bg-teal-500 text-white text-xs rounded-md">
            Your Review
          </div>
        )}

        {/* Header: Reviewer Info */}
        <div
          className={`flex items-start gap-3 mb-4 ${isOwnReview ? "mt-2" : ""}`}
        >
          {/* Avatar */}
          <div
            className="shrink-0 cursor-pointer"
            onClick={() => setIsDetailPageOpen(true)}
          >
            {review.reviewer.avatarUrl ? (
              <img
                src={review.reviewer.avatarUrl}
                alt={review.reviewer.fullName}
                className="w-10 h-10 rounded-lg object-cover border border-gray-200 hover:border-teal-500 transition-colors "
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-gray-200 hover:border-teal-500 transition-colors">
                <span className="text-slate-900">
                  {review.reviewer.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          {/* Reviewer Name & Date */}
          <div className="flex-1 min-w-0">
            <div
              className="text-slate-900 mb-1 cursor-pointer hover:text-teal-600 transition-colors"
              onClick={() => setIsDetailPageOpen(true)}
            >
              {review.reviewer.fullName}
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {formatDate(review.createdAt)}
              {isEdited && (
                <span className="italic text-xs text-gray-400">(edited)</span>
              )}
            </div>

            {/* 3-Dot Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-gray-500" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-8 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    {/* Edit option - only show for own review within 72h */}
                    {canEdit && (
                      <button
                        onClick={handleEditReview}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Pencil className="w-4 h-4 text-teal-500" />
                        Edit Review
                      </button>
                    )}
                    {/* Show "Edit expired" message for own review past 72h */}
                    {isOwnReview && !isEditableTime() && (
                      <div className="px-4 py-2 text-sm text-gray-400 flex items-center gap-2">
                        <Pencil className="w-4 h-4" />
                        Edit expired (72h limit)
                      </div>
                    )}
                    {/* Report - only for other people's reviews */}
                    {!isOwnReview && (
                      <button
                        onClick={handleReportAbuse}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Flag className="w-4 h-4 text-red-500" />
                        Report Abuse
                      </button>
                    )}
                    <button
                      onClick={handleViewHistory}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4 text-gray-500" />
                      View Edit History
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Project Info */}
          <div className="mb-3 pl-13">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Project:</span>
              <span
                className="text-sm text-slate-900 hover:text-teal-600 cursor-pointer transition-colors"
                onClick={() => setIsDetailPageOpen(true)}
              >
                {review.project.title}
              </span>
              {isHighValueProject && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-md border border-indigo-200">
                  <Gem className="w-3 h-3" />
                  High Value Project
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Budget: {formatVND(review.project.totalBudget)}
            </div>
          </div>

          {/* Rating */}
          <div className="mb-3 pl-13">
            <StarRating rating={review.rating} editable={false} />
          </div>
          {/* Comment with Truncation */}

          {review.comment && (
            <div className="pl-13">
              <div
                ref={commentRef}
                className={`text-gray-700 text-sm leading-relaxed ${
                  !isExpanded && showReadMore ? "line-clamp-4" : ""
                }`}
              >
                {review.comment}
              </div>

              {/* Read More Button (Inline) */}
              {showReadMore && (
                <div className="mt-2">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Read more
                      </>
                    )}
                  </button>
                </div>
              )}
              {/* View Full Details Button (Separated with top border & full width) */}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setIsDetailPageOpen(true)}
                  className="w-full py-2.5 px-4 bg-white border border-teal-500 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Full Review Details
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Review Detail Page */}
        {isDetailPageOpen && (
          <ReviewDetailPage
            review={review}
            onBack={() => setIsDetailPageOpen(false)}
          />
        )}

        {/* Edit Review Modal - only for own review */}
        {isEditModalOpen && (
          <EditReviewModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            review={review}
            onSuccess={handleEditSuccess}
          />
        )}

        {/* Report Abuse Modal - only for other's reviews */}
        {isReportModalOpen && (
          <ReportAbuseModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            review={review}
            onSuccess={() => setIsReportModalOpen(false)}
          />
        )}
      </div>
    </>
  );
}
