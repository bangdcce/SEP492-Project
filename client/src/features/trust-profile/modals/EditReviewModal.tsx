/**
 * EditReviewModal Component
 * Modal for editing existing reviews (available for 72 hours after creation)
 */

import { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import { StarRating } from "../components/ui/StarRating";
import { updateReview } from "../api";
import type { Review } from "../types";

interface EditReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: Review;
  onSuccess: () => void;
}

export function EditReviewModal({
  isOpen,
  onClose,
  review,
  onSuccess,
}: EditReviewModalProps) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const MAX_COMMENT_LENGTH = 1000;
  const remainingChars = MAX_COMMENT_LENGTH - comment.length;

  // Check if editable (within 72 hours)
  const isEditableTime = () => {
    const createdAt = new Date(review.createdAt);
    const now = new Date();
    const hoursSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 72;
  };

  const editable = isEditableTime();

  // Track changes
  useEffect(() => {
    const changed =
      rating !== review.rating || comment.trim() !== review.comment.trim();
    setHasChanges(changed);
  }, [rating, comment, review]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasChanges) {
      setError("No changes detected. Please modify the review before saving.");
      return;
    }

    if (!editable) {
      setError("This review can no longer be edited (72-hour limit exceeded).");
      return;
    }

    setIsLoading(true);

    try {
      await updateReview(review.id, {
        rating,
        comment: comment.trim(),
      });

      // Success - close modal and refresh data
      onSuccess();
      onClose();
      resetForm();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string }; status?: number };
      };
      const errorMessage = error.response?.data?.message || "";

      if (error.response?.status === 400) {
        setError(errorMessage || "Invalid request. Please check your input.");
      } else if (error.response?.status === 403) {
        setError(
          "You do not have permission to edit this review or the 72-hour window has expired."
        );
      } else if (error.response?.status === 404) {
        setError("Review not found.");
      } else {
        setError(
          errorMessage || "Failed to update review. Please try again later."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form state
  const resetForm = () => {
    setRating(review.rating);
    setComment(review.comment);
    setError(null);
    setHasChanges(false);
  };

  // Handle modal close
  const handleClose = () => {
    if (!isLoading) {
      if (hasChanges) {
        const confirmed = confirm(
          "You have unsaved changes. Are you sure you want to close?"
        );
        if (!confirmed) return;
      }
      onClose();
      resetForm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with glass morphism */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl text-slate-900">
            Edit Review for{" "}
            <span className="text-teal-600">{review.project.title}</span>
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]"
        >
          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Time Warning */}
          {!editable && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700">
                  <strong>Edit Time Expired:</strong> This review was created
                  more than 72 hours ago and can no longer be edited.
                </p>
              </div>
            </div>
          )}

          {/* Success Info for editable reviews */}
          {editable && !error && (
            <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-teal-800 text-sm">
                  You can edit this review. Changes will be saved immediately.
                </p>
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="space-y-2">
            <label className="block text-slate-900">
              Rating <span className="text-red-500">*</span>
            </label>
            <StarRating
              rating={rating}
              editable={editable}
              onChange={setRating}
            />
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="block text-slate-900">
              Comment
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={6}
              disabled={!editable}
              placeholder="Share your experience working with this person..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-slate-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {hasChanges ? (
                  <span className="text-teal-600">● Unsaved changes</span>
                ) : (
                  "No changes yet"
                )}
              </span>
              <span
                className={`${
                  remainingChars < 100 ? "text-red-600" : "text-gray-500"
                }`}
              >
                {remainingChars} characters remaining
              </span>
            </div>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-blue-800 text-sm">
                <strong>Edit History:</strong> Your review was originally posted
                on{" "}
                {new Date(review.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
                {review.updatedAt !== review.createdAt && (
                  <span>
                    {" "}
                    Last edited on{" "}
                    {new Date(review.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </span>
                )}
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading || !hasChanges || !editable}
            className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
