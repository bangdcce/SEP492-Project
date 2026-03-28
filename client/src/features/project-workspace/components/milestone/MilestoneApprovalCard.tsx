import { useMemo, useState } from "react";
import {
  CheckCircle,
  ExternalLink,
  FileCheck,
  Loader2,
  Lock,
  type LucideIcon,
  PartyPopper,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Button, Checkbox, Textarea } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/utils/formatters";
import type { Milestone, Task } from "../../types";
import {
  getLatestApprovedSubmission,
  getSubmissionEvidenceUrl,
  getSubmissionPreviewText,
} from "../../utils";

interface MilestoneApprovalCardProps {
  milestone: Milestone;
  tasks: Task[];
  progress: number;
  currentRole?: string;
  isAssignedReviewer?: boolean;
  hasIntermediateReviewer?: boolean;
  assignedReviewerLabel?: string | null;
  onApprove: (milestoneId: string, feedback?: string) => Promise<void>;
  onRequestReview: (milestoneId: string) => Promise<void>;
  onReviewerDecision: (
    milestoneId: string,
    payload: { recommendation: "ACCEPT" | "REJECT"; note: string },
  ) => Promise<void>;
  onRaiseDispute?: (milestoneId: string) => void;
  canApprove?: boolean;
  currency?: string;
}

const STATUS_META: Record<
  string,
  { title: string; subtitle: string; tone: string; icon: LucideIcon }
> = {
  IN_PROGRESS: {
    title: "Milestone Ready to Submit",
    subtitle: "All tasks are done. Submit the milestone to start the review flow.",
    tone: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    icon: PartyPopper,
  },
  PENDING_STAFF_REVIEW: {
    title: "Waiting for Broker Review",
    subtitle: "The assigned broker reviews the milestone before client approval.",
    tone: "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50",
    icon: ShieldCheck,
  },
  PENDING_CLIENT_APPROVAL: {
    title: "Waiting for Client Approval",
    subtitle: "Broker review is complete. The client can now approve and release funds.",
    tone: "border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50",
    icon: UserCheck,
  },
  SUBMITTED: {
    title: "Waiting for Client Approval",
    subtitle: "Milestone has been submitted and is waiting for the next approval step.",
    tone: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    icon: CheckCircle,
  },
};

const STAFF_REVIEW_ATTESTATIONS = [
  {
    key: "deliverablesVerified",
    label: "Deliverables Match The Milestone",
    description: "Reviewed the submitted deliverables, evidence links, and core output against the locked milestone scope.",
  },
  {
    key: "meetsRequirements",
    label: "Ready For Client Acceptance",
    description: "Confirmed the milestone is ready for the client to validate the business outcome and approve release.",
  },
  {
    key: "noMaliciousContent",
    label: "Release Summary Is Accurate",
    description: "Checked the release context, payout split, and broker note so the client has the right approval summary.",
  },
] as const;

type StaffReviewChecklistKey = (typeof STAFF_REVIEW_ATTESTATIONS)[number]["key"];

const createInitialStaffReviewChecks = (): Record<StaffReviewChecklistKey, boolean> => ({
  deliverablesVerified: false,
  meetsRequirements: false,
  noMaliciousContent: false,
});

export function MilestoneApprovalCard({
  milestone,
  tasks,
  progress,
  currentRole,
  isAssignedReviewer = false,
  hasIntermediateReviewer = false,
  assignedReviewerLabel,
  onApprove,
  onRequestReview,
  onReviewerDecision,
  onRaiseDispute,
  canApprove = false,
  currency,
}: MilestoneApprovalCardProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRequestingReview, setIsRequestingReview] = useState(false);
  const [isSubmittingStaffReview, setIsSubmittingStaffReview] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showStaffReviewPanel, setShowStaffReviewPanel] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [staffReviewChecks, setStaffReviewChecks] = useState<
    Record<StaffReviewChecklistKey, boolean>
  >(() => createInitialStaffReviewChecks());
  const [error, setError] = useState<string | null>(null);

  const role = currentRole?.toUpperCase();
  const milestoneStatus = milestone.status?.toUpperCase() || "IN_PROGRESS";
  const statusMeta = STATUS_META[milestoneStatus] ?? STATUS_META.IN_PROGRESS;
  const HeaderIcon = statusMeta.icon;
  const formattedAmount = formatCurrency(milestone.amount, currency ?? "USD");

  const submittedWork = useMemo(
    () =>
      tasks
        .map((task) => {
          const latestApprovedSubmission = getLatestApprovedSubmission(task);
          if (!latestApprovedSubmission) {
            return null;
          }

          return {
            task,
            latestApprovedSubmission,
            evidenceUrl: getSubmissionEvidenceUrl(latestApprovedSubmission),
            preview: getSubmissionPreviewText(latestApprovedSubmission),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [tasks],
  );

  if (progress !== 100) {
    return null;
  }

  const canFreelancerRequestReview =
    role === "FREELANCER" &&
    ["PENDING", "IN_PROGRESS", "REVISIONS_REQUIRED"].includes(milestoneStatus);
  const canAssignedReviewerReview =
    isAssignedReviewer && milestoneStatus === "PENDING_STAFF_REVIEW";
  const canClientApproveNow =
    canApprove &&
    role === "CLIENT" &&
    (milestoneStatus === "PENDING_CLIENT_APPROVAL" ||
      (milestoneStatus === "SUBMITTED" && !hasIntermediateReviewer));

  const waitingMessage = canAssignedReviewerReview
    ? "You are the assigned broker reviewer for this milestone."
    : milestoneStatus === "PENDING_STAFF_REVIEW"
      ? `Waiting for ${assignedReviewerLabel || "the assigned broker"} to review this milestone.`
      : milestoneStatus === "PENDING_CLIENT_APPROVAL"
        ? "Waiting for the client to approve and release funds."
        : milestoneStatus === "SUBMITTED"
          ? hasIntermediateReviewer
            ? `Submitted. ${assignedReviewerLabel || "The broker"} needs to review this milestone before client approval.`
            : "Waiting for the client to approve this milestone."
          : "Complete the next action to move this milestone forward.";
  const completedStaffReviewChecks = STAFF_REVIEW_ATTESTATIONS.filter(
    (item) => staffReviewChecks[item.key],
  ).length;
  const isStaffReviewReady =
    staffNote.trim().length > 0 &&
    completedStaffReviewChecks === STAFF_REVIEW_ATTESTATIONS.length;

  const handleApproveClick = () => {
    setShowApproveModal(true);
    setError(null);
  };

  const handleCloseApproveModal = () => {
    setShowApproveModal(false);
    setFeedback("");
    setError(null);
  };

  const handleConfirmApprove = async () => {
    setIsApproving(true);
    setError(null);

    try {
      await onApprove(milestone.id, feedback || undefined);
      setShowApproveModal(false);
      setFeedback("");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve milestone";
      setError(errorMessage);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRequestReview = async () => {
    setIsRequestingReview(true);
    setError(null);

    try {
      await onRequestReview(milestone.id);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to request milestone review";
      setError(errorMessage);
    } finally {
      setIsRequestingReview(false);
    }
  };

  const handleStaffReview = async (recommendation: "ACCEPT" | "REJECT") => {
    const note = staffNote.trim();
    if (!isStaffReviewReady || !note) {
      setError("Complete the broker review checklist and add a note before submitting.");
      return;
    }

    setIsSubmittingStaffReview(true);
    setError(null);

    try {
      await onReviewerDecision(milestone.id, { recommendation, note });
      setShowStaffReviewPanel(false);
      setStaffNote("");
      setStaffReviewChecks(createInitialStaffReviewChecks());
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to submit broker review";
      setError(errorMessage);
    } finally {
      setIsSubmittingStaffReview(false);
    }
  };

  const handleCancelStaffReview = () => {
    setShowStaffReviewPanel(false);
    setStaffNote("");
    setStaffReviewChecks(createInitialStaffReviewChecks());
    setError(null);
  };

  return (
    <>
      <div className={`relative overflow-hidden rounded-2xl border-2 p-6 shadow-lg ${statusMeta.tone}`}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-500" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-teal-500" />
        </div>

        <div className="relative">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80">
                <HeaderIcon className="h-6 w-6 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{statusMeta.title}</h3>
                <p className="text-sm text-slate-600">{statusMeta.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">100% Complete</span>
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-white/80 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Milestone</p>
                <p className="text-lg font-semibold text-slate-900">{milestone.title}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Amount</p>
                <p className="text-xl font-bold text-emerald-600">{formattedAmount}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{waitingMessage}</p>
          </div>

          {milestone.staffReviewNote && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <p className="font-semibold">
                {milestone.staffRecommendation === "REJECT"
                  ? "Broker requested changes:"
                  : "Broker review approved:"}
              </p>
              <p className="mt-1">{milestone.staffReviewNote}</p>
            </div>
          )}

          {submittedWork.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                Submitted Work ({submittedWork.length} approved submissions)
              </p>
              <div className="space-y-2">
                {submittedWork.map(
                  ({ task, latestApprovedSubmission, evidenceUrl, preview }) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-3 transition-all hover:bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <FileCheck className="h-5 w-5 text-teal-600" />
                        <div>
                          <p className="font-medium text-slate-800">{task.title}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Version {latestApprovedSubmission.version}
                          </p>
                          {preview && (
                            <p className="line-clamp-1 text-xs text-slate-500">{preview}</p>
                          )}
                        </div>
                      </div>
                      {evidenceUrl && (
                        <a
                          href={evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
                        >
                          View Evidence
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {canFreelancerRequestReview && (
              <button
                onClick={handleRequestReview}
                disabled={isRequestingReview}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
              >
                {isRequestingReview ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Request milestone review
                  </>
                )}
              </button>
            )}

            {canAssignedReviewerReview && (
              <button
                onClick={() => {
                  setShowStaffReviewPanel((current) => !current);
                  setError(null);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-sky-700"
              >
                <ShieldCheck className="h-5 w-5" />
                Broker Review
              </button>
            )}

            {canClientApproveNow && (
              <button
                onClick={handleApproveClick}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-teal-600"
              >
                <CheckCircle className="h-5 w-5" />
                Approve & Release Funds
              </button>
            )}

            {!canFreelancerRequestReview &&
              !canAssignedReviewerReview &&
              !canClientApproveNow && (
              <div className="flex-1 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600">
                {waitingMessage}
              </div>
              )}

            <button
              onClick={() => onRaiseDispute?.(milestone.id)}
              className="flex items-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-5 py-3 font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100"
            >
              <ShieldAlert className="h-5 w-5" />
              Raise Dispute
            </button>
          </div>

          {canAssignedReviewerReview && showStaffReviewPanel && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  Broker Review Summary
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                  Confirm whether this milestone is ready for client approval, or send
                  it back with a specific note describing what still needs to change.
                </p>
              </div>

              <div className="space-y-6 p-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Review checklist
                      </p>
                      <p className="text-xs text-slate-500">
                        Complete every confirmation before sending your recommendation.
                      </p>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {completedStaffReviewChecks}/{STAFF_REVIEW_ATTESTATIONS.length} completed
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {STAFF_REVIEW_ATTESTATIONS.map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50/60"
                      >
                        <Checkbox
                          checked={staffReviewChecks[item.key]}
                          onCheckedChange={(checked) => {
                            setStaffReviewChecks((current) => ({
                              ...current,
                              [item.key]: checked === true,
                            }));
                            setError(null);
                          }}
                          className="mt-0.5 border-slate-300 data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-900">
                      Broker note
                    </label>
                    <span className="text-xs font-medium text-slate-500">
                      Required
                    </span>
                  </div>
                  <Textarea
                    value={staffNote}
                    onChange={(event) => {
                      setStaffNote(event.target.value);
                      if (error) {
                        setError(null);
                      }
                    }}
                    placeholder="Summarize what you reviewed and what the client should know before approving..."
                    rows={7}
                    className="min-h-[168px] rounded-2xl border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus-visible:border-teal-600 focus-visible:ring-teal-600/15"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Call out the deliverables checked, any concerns, and why you are accepting or rejecting the milestone.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                  <p className="leading-6">
                    The client will use this note during final approval and fund release. Keep it factual and specific.
                  </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-xs leading-5 text-slate-500">
                    {isStaffReviewReady
                      ? "Review is complete. You can now submit your recommendation."
                      : "Complete every checklist item and add a broker note before submitting."}
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelStaffReview}
                      disabled={isSubmittingStaffReview}
                      className="min-w-[130px] rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleStaffReview("REJECT")}
                      disabled={!isStaffReviewReady || isSubmittingStaffReview}
                      variant="outline"
                      className="min-w-[220px] rounded-xl border-rose-200 bg-white px-5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    >
                      {isSubmittingStaffReview ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Send Back for Changes
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleStaffReview("ACCEPT")}
                      disabled={!isStaffReviewReady || isSubmittingStaffReview}
                      variant="outline"
                      className="min-w-[240px] rounded-xl border-emerald-200 bg-white px-5 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      {isSubmittingStaffReview ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      Accept & Forward to Client
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <Lock className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  Authorize Payment Release
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  You are about to release escrowed funds to the freelancer for
                  this completed milestone.
                </p>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Milestone
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {milestone.title}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Amount to Release
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {formattedAmount}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-600">
                This authorization will finalize the client-side approval step
                and instruct the system to release the escrow allocation tied to
                this milestone.
              </div>
              {milestone.escrow ? (
                <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Freelancer
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {formatCurrency(milestone.escrow.developerShare, currency ?? "USD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Broker
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {formatCurrency(milestone.escrow.brokerShare, currency ?? "USD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Platform fee
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {formatCurrency(milestone.escrow.platformFee, currency ?? "USD")}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Feedback (optional)
              </label>
              <Textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Add a payment note or approval summary for the project record..."
                rows={4}
                className="min-h-[120px] rounded-2xl border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-400 focus-visible:ring-slate-300/40"
              />
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCloseApproveModal}
                disabled={isApproving}
                className="justify-start rounded-xl px-3 text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="h-11 rounded-xl bg-slate-900 px-5 text-white hover:bg-slate-800 sm:min-w-[260px]"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    {`Authorize Release of ${formattedAmount}`}
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium tracking-wide text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Secured by InterDev Escrow Services
            </div>
          </div>
        </div>
      )}
    </>
  );
}
