/**
 * CreateReviewModal Component
 * Modal for submitting reviews on completed projects
 */

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { StarRating } from "../components/ui/StarRating";
import { createReview } from "../api";
import type { CreateReviewPayload } from "../types";

interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  targetUser: {
    id: string;
    fullName: string;
  };
  onSuccess: () => void;
}

export function CreateReviewModal({
  isOpen,
  onClose,
  projectId,
  targetUser,
  onSuccess,
}: CreateReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_COMMENT_LENGTH = 1000;
  const remainingChars = MAX_COMMENT_LENGTH - comment.length;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload: CreateReviewPayload = {
        projectId,
        targetUserId: targetUser.id,
        rating,
        comment: comment.trim() || undefined,
      };

      await createReview(payload);

      // Success - close modal and refresh data
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      // Error Handling - Map Vietnamese errors to English
      const errorMessage = err.response?.data?.message || "";

      if (err.response?.status === 400) {
        if (errorMessage.includes("đã đánh giá")) {
          setError("You have already reviewed this user.");
        } else if (errorMessage.includes("chưa hoàn thành")) {
          setError("Project must be completed before submitting a review.");
        } else {
          setError(errorMessage || "Invalid request. Please check your input.");
        }
      } else if (err.response?.status === 403) {
        if (errorMessage.includes("không phải thành viên")) {
          setError("Permission denied. You must be a member of this project.");
        } else {
          setError("You do not have permission to review this user.");
        }
      } else if (err.response?.status === 404) {
        setError("Project or user not found.");
      } else {
        setError(
          errorMessage || "Failed to submit review. Please try again later."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form state
  const resetForm = () => {
    setRating(5);
    setComment("");
    setError(null);
  };

  // Handle modal close
  const handleClose = () => {
    if (!isLoading) {
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
            Rate your experience with{" "}
            <span className="text-teal-600">{targetUser.fullName}</span>
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
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="space-y-2">
            <label className="block text-slate-900">
              Rating <span className="text-red-500">*</span>
            </label>
            <StarRating rating={rating} editable={true} onChange={setRating} />
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="block text-slate-900">
              Comment (Optional)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={6}
              placeholder="Share your experience working with this person..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-slate-900"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Help others by providing detailed feedback
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

          {/* Warning Note */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-yellow-800 text-sm">
                <strong>Important:</strong> Reviews cannot be edited after 72
                hours. Please ensure your feedback is accurate and constructive.
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
            disabled={isLoading}
            className="px-6 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
