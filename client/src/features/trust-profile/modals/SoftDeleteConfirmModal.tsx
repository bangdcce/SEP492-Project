/**
 * SoftDeleteConfirmModal Component
 * Confirmation modal for soft deleting a review (Admin only)
 */

import { useState, useEffect } from "react";
import { X, AlertTriangle, Trash2 } from "lucide-react";
import type { AdminReview } from "../types";

interface SoftDeleteConfirmModalProps {
  review: AdminReview;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes?: string) => void;
  isLoading?: boolean;
}

const DELETION_REASONS = [
  {
    value: "INAPPROPRIATE_LANGUAGE",
    label: "Inappropriate Language / Profanity",
  },
  { value: "SPAM", label: "Spam / Promotional Content" },
  { value: "FAKE_REVIEW", label: "Fake / Fraudulent Review" },
  { value: "HARASSMENT", label: "Harassment / Abusive Content" },
  { value: "OFF_TOPIC", label: "Off-topic / Irrelevant" },
  { value: "OTHER", label: "Other (Please specify)" },
] as const;

export function SoftDeleteConfirmModal({
  review,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: SoftDeleteConfirmModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [notes, setNotes] = useState("");

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
    if (!selectedReason) {
      alert("Please select a reason for deletion");
      return;
    }

    if (selectedReason === "OTHER" && !notes.trim()) {
      alert("Please provide details in the notes field");
      return;
    }

    onConfirm(selectedReason, notes.trim() || undefined);
  };

  const handleClose = () => {
    if (isLoading) return;
    setSelectedReason("");
    setNotes("");
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
          {/* Header - Danger Zone */}
          <div className="bg-red-50 border-b border-red-200 px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl text-slate-900">Soft Delete Review</h2>
                  <p className="text-sm text-red-700">
                    This action can be reversed later
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

              {/* Report Info */}
              {review.reportInfo && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-red-600 mb-1">
                    🚩 {review.reportInfo.reportCount} Report(s)
                  </div>
                  {review.reportInfo.flaggedKeywords &&
                    review.reportInfo.flaggedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {review.reportInfo.flaggedKeywords.map(
                          (keyword, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-md"
                            >
                              {keyword}
                            </span>
                          )
                        )}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Deletion Reason */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Reason for Deletion <span className="text-red-600">*</span>
              </label>
              <div className="space-y-2">
                {DELETION_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedReason === reason.value
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deletion-reason"
                      value={reason.value}
                      checked={selectedReason === reason.value}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-4 h-4 text-red-600 focus:ring-red-500"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-slate-900">
                      {reason.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Additional Notes{" "}
                {selectedReason === "OTHER" && (
                  <span className="text-red-600">*</span>
                )}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provide additional context or details..."
                rows={4}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-sm disabled:opacity-50 disabled:bg-gray-50"
              />
              <div className="text-xs text-gray-500 mt-1">
                This will be recorded in the moderation history
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-900">
                  <div className="mb-1">This is a soft delete:</div>
                  <ul className="list-disc list-inside space-y-1 text-yellow-800">
                    <li>Review will be hidden from public view</li>
                    <li>User's trust score will be recalculated</li>
                    <li>Action will be logged in moderation history</li>
                    <li>You can restore this review later if needed</li>
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
              disabled={isLoading || !selectedReason}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isLoading ? "Deleting..." : "Soft Delete Review"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
