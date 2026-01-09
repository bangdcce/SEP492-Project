/**
 * ReviewEditHistoryPage Component
 * Full-page view for displaying review edit history with timeline
 */

import {
  ArrowLeft,
  Clock,
  Edit3,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { Review } from "../types";
import { useReviewHistory } from "../hooks/useReviews";
import { DiffViewer } from "../components/ui/DiffViewer";
import { StarRating } from "../components/ui/StarRating";

interface ReviewEditHistoryPageProps {
  review: Review;
  onBack: () => void;
}

export function ReviewEditHistoryPage({
  review,
  onBack,
}: ReviewEditHistoryPageProps) {
  const { history, isLoading, error } = useReviewHistory({
    reviewId: review.id,
    review,
    autoFetch: true,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(dateString);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      {/* Fixed Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Review</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-teal-600" />
            <h1 className="text-3xl text-slate-900">Edit History</h1>
          </div>
          <p className="text-gray-600">
            Review for{" "}
            <span className="text-slate-900">{review.project.title}</span>
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading edit history...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-900 mb-1">Failed to load edit history</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {!isLoading && !error && history.length > 0 && (
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-gray-300" />

            {/* History Entries */}
            <div className="space-y-8">
              {history.map((entry, index) => {
                const isLatest = index === 0;
                const previousEntry =
                  index < history.length - 1 ? history[index + 1] : null;

                // Detect changes
                const ratingChanged =
                  previousEntry && entry.rating !== previousEntry.rating;
                const commentChanged =
                  previousEntry && entry.comment !== previousEntry.comment;

                return (
                  <div key={entry.id} className="relative pl-20">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute left-6 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isLatest
                          ? "bg-teal-500 border-teal-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {isLatest ? (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      ) : (
                        <Clock className="w-3 h-3 text-gray-400" />
                      )}
                    </div>

                    {/* Content Card */}
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      {/* Card Header */}
                      <div
                        className={`px-6 py-4 border-b ${
                          isLatest
                            ? "bg-teal-50 border-teal-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            {entry.editedBy.avatarUrl ? (
                              <img
                                src={entry.editedBy.avatarUrl}
                                alt={entry.editedBy.fullName}
                                className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-gray-200">
                                <span className="text-slate-900">
                                  {entry.editedBy.fullName
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Editor Info */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-900">
                                  {entry.editedBy.fullName}
                                </span>
                                {isLatest && (
                                  <span className="px-2 py-0.5 bg-teal-500 text-white text-xs rounded-md">
                                    Current
                                  </span>
                                )}
                                {index === history.length - 1 && (
                                  <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded-md">
                                    Original
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                Version {entry.version} •{" "}
                                {getTimeSince(entry.editedAt)}
                              </div>
                            </div>
                          </div>

                          {/* Change Badge */}
                          {(ratingChanged || commentChanged) && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-white rounded-full border border-gray-200">
                              <Edit3 className="w-3 h-3 text-teal-600" />
                              <span className="text-xs text-teal-600">
                                {ratingChanged && commentChanged
                                  ? "Rating & Comment changed"
                                  : ratingChanged
                                  ? "Rating changed"
                                  : "Comment changed"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 space-y-4">
                        {/* Rating Section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-600">
                              Rating
                            </label>
                            {ratingChanged && previousEntry && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">
                                  {previousEntry.rating}
                                </span>
                                <ArrowRight className="w-4 h-4 text-teal-600" />
                                <span className="text-teal-600">
                                  {entry.rating}
                                </span>
                              </div>
                            )}
                          </div>
                          <StarRating rating={entry.rating} editable={false} />
                        </div>

                        {/* Comment Section */}
                        {commentChanged && previousEntry ? (
                          <DiffViewer
                            oldText={previousEntry.comment}
                            newText={entry.comment}
                            label="Comment"
                          />
                        ) : (
                          <div>
                            <label className="text-sm text-gray-600 block mb-2">
                              Comment
                            </label>
                            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-200 leading-relaxed">
                              {entry.comment}
                            </div>
                          </div>
                        )}

                        {/* Timestamp */}
                        <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                          {formatDate(entry.editedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No History State */}
        {!isLoading && !error && history.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-slate-900 mb-2">No Edit History</h3>
            <p className="text-gray-600">This review hasn't been edited yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
