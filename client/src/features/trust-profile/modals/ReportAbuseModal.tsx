import { useState } from "react";
import { AlertCircle, CheckCircle, Flag, X } from "lucide-react";
import { createReport } from "../api";
import type { ReportReason, Review } from "../types";

interface ReportAbuseModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: Review;
  onSuccess?: () => void;
}

const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  description: string;
}[] = [
  {
    value: "SPAM",
    label: "Spam",
    description: "Advertising, repetitive content, or unrelated links.",
  },
  {
    value: "HARASSMENT",
    label: "Harassment",
    description: "Abusive language, threats, or discriminatory remarks.",
  },
  {
    value: "DOXING",
    label: "Privacy leak",
    description: "Sharing personal data such as phone numbers or addresses.",
  },
  {
    value: "FAKE_REVIEW",
    label: "Fake review",
    description: "Feedback that does not reflect a real working relationship.",
  },
  {
    value: "OTHER",
    label: "Other",
    description: "Anything else that still requires moderator review.",
  },
];

export function ReportAbuseModal({
  isOpen,
  onClose,
  review,
  onSuccess,
}: ReportAbuseModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const MAX_DESCRIPTION_LENGTH = 500;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedReason) {
      setError("Please choose a report reason.");
      return;
    }

    if (selectedReason === "OTHER" && !description.trim()) {
      setError("Please add details for the report.");
      return;
    }

    setIsLoading(true);

    try {
      await createReport({
        reviewId: review.id,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (rawError: unknown) {
      const errorResponse = rawError as {
        response?: { data?: { message?: string }; status?: number };
      };
      const message = errorResponse.response?.data?.message || "";
      const normalizedMessage = message.toLowerCase();

      if (errorResponse.response?.status === 400) {
        if (
          normalizedMessage.includes("đã report") ||
          normalizedMessage.includes("already reported")
        ) {
          setError("You have already reported this review.");
        } else if (
          normalizedMessage.includes("chính mình") ||
          normalizedMessage.includes("cannot report your own review")
        ) {
          setError("You cannot report your own review.");
        } else {
          setError(message || "Invalid report request.");
        }
      } else if (errorResponse.response?.status === 404) {
        setError("The selected review could not be found.");
      } else {
        setError(message || "Failed to submit the report. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    setSelectedReason(null);
    setDescription("");
    setError(null);
    setIsSuccess(false);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="report-review-modal"
    >
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-200 bg-red-50 p-6">
          <div className="flex items-center gap-3">
            <Flag className="h-6 w-6 text-red-600" />
            <h2 className="text-xl text-slate-900">Report Review</h2>
          </div>
          <button
            type="button"
            data-testid="close-report-review"
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-teal-500" />
            <h3 className="mb-2 text-xl text-slate-900">Report submitted</h3>
            <p className="text-gray-600">
              Moderators have received your report and will review it shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="max-h-[calc(90vh-180px)] space-y-6 overflow-y-auto p-6"
          >
            {error ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <p className="text-red-700">{error}</p>
              </div>
            ) : null}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-1 text-sm text-gray-500">Review author</div>
              <div className="font-medium text-slate-900">{review.reviewer.fullName}</div>
              <div className="mt-2 line-clamp-2 text-sm text-gray-600">{review.comment}</div>
            </div>

            <div className="space-y-3">
              <label className="block font-medium text-slate-900">
                Report reason <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedReason === reason.value
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    data-testid={`report-reason-${reason.value.toLowerCase()}`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.value}
                      checked={selectedReason === reason.value}
                      onChange={() => setSelectedReason(reason.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-slate-900">{reason.label}</div>
                      <div className="text-sm text-gray-500">{reason.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="report-description" className="block font-medium text-slate-900">
                Additional details {selectedReason === "OTHER" ? <span className="text-red-500">*</span> : null}
              </label>
              <textarea
                id="report-description"
                data-testid="report-review-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={4}
                placeholder="Add the context moderators need to review this report."
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="text-right text-sm text-gray-500">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </div>
            </div>
          </form>
        )}

        {!isSuccess ? (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 p-6">
            <button
              type="button"
              data-testid="cancel-report-review"
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-report-review"
              onClick={handleSubmit}
              disabled={isLoading || !selectedReason}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
