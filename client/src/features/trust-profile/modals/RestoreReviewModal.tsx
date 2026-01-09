/**
 * RestoreReviewModal Component
 * Confirmation modal for restoring a soft-deleted review (Admin only)
 */

import { useState, useEffect } from "react";
import { X, RotateCcw, CheckCircle2 } from "lucide-react";
import type { AdminReview } from "../types";

interface RestoreReviewModalProps {
  review: AdminReview;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function RestoreReviewModal({
  review,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: RestoreReviewModalProps) {
  const [reason, setReason] = useState("");

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert("Please provide a reason for restoration");
      return;
    }

    onConfirm(reason.trim());
  };

  const handleClose = () => {
    if (isLoading) return;
    setReason("");
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-100"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-101 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="bg-teal-50 border-b border-teal-200 px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl text-slate-900">Restore Review</h2>
                  <p className="text-sm text-teal-700">
                    Make this review visible again
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="text-gray-500 hover:text-slate-900 transition-colors disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Review Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                {review.reviewer.avatarUrl ? (
                  <img
                    src={review.reviewer.avatarUrl}
                    alt={review.reviewer.fullName}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <span className="text-slate-900">
                      {review.reviewer.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-slate-900 mb-1">
                    {review.reviewer.fullName}
                  </div>
                  <div className="text-sm text-gray-600">
                    Project:{" "}
                    <span className="text-slate-900">
                      {review.project.title}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-900">{review.rating}</span>
                  <span className="text-yellow-500">★</span>
                </div>
              </div>
              <div className="text-sm text-gray-700 bg-white rounded p-3 border border-gray-200">
                {review.comment}
              </div>

              {/* Deletion Info */}
              {review.moderationHistory &&
                review.moderationHistory.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">
                      Previously deleted by:
                    </div>
                    <div className="text-sm text-slate-900">
                      {review.moderationHistory[0].performedBy.fullName}
                    </div>
                    {review.moderationHistory[0].reason && (
                      <div className="text-xs text-gray-600 mt-1">
                        Reason:{" "}
                        <span className="text-slate-900">
                          {review.moderationHistory[0].reason}
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Restoration Reason */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Reason for Restoration <span className="text-red-600">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., False positive, user appeal approved, content was acceptable..."
                rows={4}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm disabled:opacity-50 disabled:bg-gray-50"
              />
              <div className="text-xs text-gray-500 mt-1">
                This will be recorded in the moderation history
              </div>
            </div>

            {/* Info */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="text-sm text-teal-900">
                  <div className="mb-1">Restoring this review will:</div>
                  <ul className="list-disc list-inside space-y-1 text-teal-800">
                    <li>Make the review visible to the public again</li>
                    <li>Re-include it in trust score calculations</li>
                    <li>Log the restoration action in moderation history</li>
                    <li>Notify the review author (optional)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || !reason.trim()}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {isLoading ? "Restoring..." : "Restore Review"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
