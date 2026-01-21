import { useState } from "react";
import { format } from "date-fns";
import {
  X,
  CalendarDays,
  Layers,
  Clock,
  Edit3,
  User,
  FileText,
  AlertCircle,
  Link2,
  CheckCircle2,
  Send,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../types";
import { MOCK_SPEC_FEATURES } from "./CreateTaskModal";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TaskDetailModalProps = {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onSubmitTask?: (
    taskId: string,
    data: { submissionNote?: string; proofLink: string }
  ) => Promise<void>;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { bg: string; text: string; label: string }
  > = {
    TODO: { bg: "bg-slate-100", text: "text-slate-700", label: "To Do" },
    IN_PROGRESS: {
      bg: "bg-sky-100",
      text: "text-sky-700",
      label: "In Progress",
    },
    DONE: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Done" },
  };

  const config = statusConfig[status] ?? statusConfig.TODO;

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold",
        config.bg,
        config.text
      )}
    >
      {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO ROW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className={cn("text-sm text-slate-900", valueClassName)}>{value}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TaskDetailModal - View task details with option to submit work
 * Freelancers can submit proof of work to mark task as done
 */
export function TaskDetailModal({
  isOpen,
  task,
  onClose,
  onEdit,
  onSubmitTask,
}: TaskDetailModalProps) {
  // Submission form state
  const [submissionNote, setSubmissionNote] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  // Find linked spec feature
  const linkedFeature = task.specFeatureId
    ? MOCK_SPEC_FEATURES.find((f) => f.id === task.specFeatureId)
    : null;

  // Format dates
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Not set";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return "Invalid date";
    }
  };

  const handleEdit = () => {
    if (onEdit && task) {
      onEdit(task);
    }
  };

  const handleSubmitWork = async () => {
    if (!proofLink.trim()) {
      setSubmitError("Please provide a proof link (GitHub PR, Loom video, etc.)");
      return;
    }

    if (!onSubmitTask) {
      console.error("onSubmitTask callback not provided");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onSubmitTask(task.id, {
        submissionNote: submissionNote.trim() || undefined,
        proofLink: proofLink.trim(),
      });
      // Reset form on success
      setSubmissionNote("");
      setProofLink("");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit task";
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTaskDone = task.status === "DONE";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* HEADER                                                             */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-slate-50 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-teal-600" />
                <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
                  Task Details
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight truncate">
                {task.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* BODY                                                               */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 space-y-1 max-h-[60vh] overflow-y-auto">
          {/* Status Badge */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Status
            </span>
            <StatusBadge status={task.status} />
          </div>

          {/* Description */}
          <InfoRow
            icon={FileText}
            label="Description"
            value={
              task.description ? (
                <span className="text-gray-700 leading-relaxed">
                  {task.description}
                </span>
              ) : (
                <span className="text-gray-400 italic">No description provided</span>
              )
            }
          />

          {/* Start Date */}
          <InfoRow
            icon={CalendarDays}
            label="Start Date"
            value={formatDate(task.startDate)}
            valueClassName={!task.startDate ? "text-gray-400 italic" : ""}
          />

          {/* Due Date */}
          <InfoRow
            icon={Clock}
            label="Due Date"
            value={formatDate(task.dueDate)}
            valueClassName={!task.dueDate ? "text-gray-400 italic" : ""}
          />

          {/* Assignee */}
          <InfoRow
            icon={User}
            label="Assigned To"
            value={
              task.assignee?.fullName ? (
                <div className="flex items-center gap-2">
                  {task.assignee.avatarUrl ? (
                    <img
                      src={task.assignee.avatarUrl}
                      alt={task.assignee.fullName}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-teal-700">
                        {task.assignee.fullName.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span>{task.assignee.fullName}</span>
                </div>
              ) : (
                <span className="text-gray-400 italic">Unassigned</span>
              )
            }
          />

          {/* Related Spec Feature - Anti-Scope Creep */}
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50">
                <Layers className="h-4 w-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-2">
                  Linked Feature
                  <span className="text-teal-600 text-[10px] font-normal normal-case">
                    (Anti-Scope Creep)
                  </span>
                </p>
                {linkedFeature ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-teal-50 text-teal-700 border border-teal-200">
                      {linkedFeature.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({linkedFeature.category})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Not linked to any spec feature
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Milestone Info (if available) */}
          {task.milestoneId && (
            <InfoRow
              icon={Layers}
              label="Milestone"
              value={
                <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {task.milestoneId.slice(0, 8)}...
                </span>
              }
            />
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* PROOF OF WORK (if task is DONE)                                   */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {isTaskDone && task.proofLink && (
            <div className="py-3 mt-2 bg-emerald-50 rounded-lg border border-emerald-200 px-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  Work Submitted
                </span>
                {task.submittedAt && (
                  <span className="text-xs text-emerald-600">
                    on {formatDate(task.submittedAt)}
                  </span>
                )}
              </div>
              {task.submissionNote && (
                <p className="text-sm text-gray-700 mb-2">
                  {task.submissionNote}
                </p>
              )}
              <a
                href={task.proofLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-800 font-medium"
              >
                <Link2 className="h-4 w-4" />
                View Proof
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SUBMIT WORK SECTION (only if NOT done)                            */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {!isTaskDone && onSubmitTask && (
            <div className="py-4 mt-2 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200 px-4">
              <div className="flex items-center gap-2 mb-3">
                <Send className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-bold text-teal-800">
                  Submit Your Work
                </span>
              </div>

              <p className="text-xs text-gray-600 mb-4">
                Provide proof of completion (GitHub PR, Loom video, etc.) to mark
                this task as done. This evidence is critical for dispute
                resolution.
              </p>

              {/* Completion Note */}
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Completion Note{" "}
                  <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Describe what you've completed..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Proof Link */}
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Proof Link <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link2 className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={proofLink}
                    onChange={(e) => {
                      setProofLink(e.target.value);
                      setSubmitError(null);
                    }}
                    placeholder="https://github.com/user/repo/pull/123"
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent",
                      submitError ? "border-red-300" : "border-gray-300"
                    )}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  GitHub PR, Loom video, Figma file, or any relevant link
                </p>
              </div>

              {/* Error Message */}
              {submitError && (
                <div className="mb-3 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmitWork}
                disabled={isSubmitting || !proofLink.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Done & Submit
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* FOOTER                                                             */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <Edit3 className="h-4 w-4" />
              Edit Task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskDetailModal;
