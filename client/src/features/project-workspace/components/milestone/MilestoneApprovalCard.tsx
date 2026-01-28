import { useState } from "react";
import {
  CheckCircle,
  ExternalLink,
  PartyPopper,
  FileCheck,
  XCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { Milestone, Task } from "../../types";

interface MilestoneApprovalCardProps {
  milestone: Milestone;
  tasks: Task[];
  progress: number;
  onApprove: (milestoneId: string, feedback?: string) => Promise<void>;
  onRaiseDispute?: (milestoneId: string) => void;
}

export function MilestoneApprovalCard({
  milestone,
  tasks,
  progress,
  onApprove,
  onRaiseDispute,
}: MilestoneApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Only show if progress is 100%
  if (progress !== 100) {
    return null;
  }

  // Filter tasks that have proof links
  const tasksWithProof = tasks.filter((t) => t.proofLink && t.status === "DONE");

  const handleApproveClick = () => {
    setShowConfirmModal(true);
    setError(null);
  };

  const handleConfirmApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      await onApprove(milestone.id, feedback || undefined);
      setShowConfirmModal(false);
      setFeedback("");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve milestone";
      setError(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRaiseDispute = () => {
    onRaiseDispute?.(milestone.id);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <>
      {/* Main Approval Card */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-lg">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-500" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-teal-500" />
        </div>

        <div className="relative">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <PartyPopper className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Milestone Ready for Review
                </h3>
                <p className="text-sm text-slate-600">
                  All tasks completed • Review and approve to release funds
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                100% Complete
              </span>
            </div>
          </div>

          {/* Milestone Info */}
          <div className="mb-4 rounded-xl bg-white/80 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Milestone</p>
                <p className="text-lg font-semibold text-slate-900">
                  {milestone.title}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Amount</p>
                <p className="text-xl font-bold text-emerald-600">
                  {formatAmount(milestone.amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Tasks with Proof */}
          {tasksWithProof.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                📋 Submitted Work ({tasksWithProof.length} tasks with proof)
              </p>
              <div className="space-y-2">
                {tasksWithProof.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-3 transition-all hover:bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-5 w-5 text-teal-600" />
                      <div>
                        <p className="font-medium text-slate-800">{task.title}</p>
                        {task.submissionNote && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {task.submissionNote}
                          </p>
                        )}
                      </div>
                    </div>
                    {task.proofLink && (
                      <a
                        href={task.proofLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
                      >
                        View Proof
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleApproveClick}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98]"
            >
              <CheckCircle className="h-5 w-5" />
              Approve & Release Funds
            </button>
            <button
              onClick={handleRaiseDispute}
              className="flex items-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-5 py-3 font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100"
            >
              <ShieldAlert className="h-5 w-5" />
              Raise Dispute
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Confirm Approval
                </h3>
                <p className="text-sm text-slate-600">
                  This action will release funds to the freelancer
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Milestone:</span>
                <span className="font-semibold text-slate-900">
                  {milestone.title}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-600">Amount to Release:</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatAmount(milestone.amount)}
                </span>
              </div>
            </div>

            {/* Optional Feedback */}
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Great work! Everything looks perfect..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setFeedback("");
                  setError(null);
                }}
                disabled={isApproving}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
