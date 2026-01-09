/**
 * ReportAbuseModal Component
 * Modal for reporting review violations
 */

import { useState } from "react";
import { X, AlertCircle, Flag, CheckCircle } from "lucide-react";
import { createReport } from "../api";
import type { Review, ReportReason } from "../types";

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
    description: "Nội dung quảng cáo, link không liên quan",
  },
  {
    value: "HARASSMENT",
    label: "Quấy rối / Lăng mạ",
    description: "Ngôn ngữ xúc phạm, đe dọa, phân biệt đối xử",
  },
  {
    value: "DOXING",
    label: "Lộ thông tin cá nhân",
    description: "Tiết lộ SĐT, địa chỉ, thông tin riêng tư",
  },
  {
    value: "FAKE_REVIEW",
    label: "Đánh giá giả",
    description: "Review không dựa trên làm việc thực tế",
  },
  {
    value: "OTHER",
    label: "Khác",
    description: "Lý do khác (mô tả bên dưới)",
  },
];

export function ReportAbuseModal({
  isOpen,
  onClose,
  review,
  onSuccess,
}: ReportAbuseModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null
  );
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const MAX_DESCRIPTION_LENGTH = 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedReason) {
      setError("Vui lòng chọn lý do report");
      return;
    }

    if (selectedReason === "OTHER" && !description.trim()) {
      setError("Vui lòng mô tả lý do report");
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

      // Auto close after 2 seconds
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string }; status?: number };
      };
      const errorMessage = error.response?.data?.message || "";

      if (error.response?.status === 400) {
        if (errorMessage.includes("đã report")) {
          setError("Bạn đã report review này rồi");
        } else if (errorMessage.includes("chính mình")) {
          setError("Bạn không thể report review của chính mình");
        } else {
          setError(errorMessage || "Yêu cầu không hợp lệ");
        }
      } else if (error.response?.status === 404) {
        setError("Review không tồn tại");
      } else {
        setError("Đã xảy ra lỗi. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedReason(null);
      setDescription("");
      setError(null);
      setIsSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center gap-3">
            <Flag className="w-6 h-6 text-red-600" />
            <h2 className="text-xl text-slate-900">Report Review</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        {isSuccess ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-teal-500 mx-auto mb-4" />
            <h3 className="text-xl text-slate-900 mb-2">Report đã được gửi</h3>
            <p className="text-gray-600">
              Cảm ơn bạn đã báo cáo. Đội ngũ Admin sẽ xem xét trong thời gian
              sớm nhất.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]"
          >
            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Review Preview */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Review từ:</div>
              <div className="font-medium text-slate-900">
                {review.reviewer.fullName}
              </div>
              <div className="text-sm text-gray-600 mt-2 line-clamp-2">
                {review.comment}
              </div>
            </div>

            {/* Reason Selection */}
            <div className="space-y-3">
              <label className="block text-slate-900 font-medium">
                Lý do report <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedReason === reason.value
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
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
                      <div className="font-medium text-slate-900">
                        {reason.label}
                      </div>
                      <div className="text-sm text-gray-500">
                        {reason.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block text-slate-900 font-medium"
              >
                Mô tả chi tiết{" "}
                {selectedReason === "OTHER" && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={4}
                placeholder="Cung cấp thêm thông tin để Admin xem xét..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-slate-900"
              />
              <div className="text-right text-sm text-gray-500">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </div>
            </div>
          </form>
        )}

        {/* Footer */}
        {!isSuccess && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading || !selectedReason}
              className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  Gửi Report
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
