import { format } from "date-fns";
import {
  CalendarPlus,
  Send,
  Trash2,
  MessageSquareWarning,
  XCircle,
  Info,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import type {
  DisputeScheduleProposal,
  SchedulingWorklistItem,
} from "@/features/disputes/types/dispute.types";
import { EvidenceVault } from "@/features/disputes/components/evidence/EvidenceVault";
import { DisputeStatus } from "@/features/staff/types/staff.types";
import { cn } from "@/lib/utils";

type SchedulingActionPanelProps = {
  selectedCase: SchedulingWorklistItem | null;
  proposalStart: string;
  proposalEnd: string;
  proposalNote: string;
  proposalDurationLabel?: string;
  proposalValidationError?: string | null;
  canCreateProposal: boolean;
  proposalLoading: boolean;
  proposalSubmitLoading: boolean;
  proposalDeleteId: string | null;
  scheduleProposals: DisputeScheduleProposal[];
  infoResponseDraft: string;
  infoEvidenceIds: string[];
  submittingInfo: boolean;
  canceling: boolean;
  onProposalStartChange: (value: string) => void;
  onProposalEndChange: (value: string) => void;
  onProposalNoteChange: (value: string) => void;
  onInfoResponseChange: (value: string) => void;
  onInfoEvidenceIdsChange: (evidenceIds: string[]) => void;
  onCreateProposal: () => void;
  onSubmitProposals: () => void;
  onDeleteProposal: (proposalId: string) => void;
  onProvideInfo: () => void;
  onCancelDispute: () => void;
};

const statusConfig: Record<
  string,
  { icon: React.ReactNode; hint: string; color: string }
> = {
  TRIAGE_PENDING: {
    icon: <Clock className="h-4 w-4 text-amber-500" />,
    hint: "Staff triage is in progress. You will be notified when the case is accepted.",
    color: "border-amber-200 bg-amber-50/60",
  },
  PREVIEW: {
    icon: <FileText className="h-4 w-4 text-blue-500" />,
    hint: "Staff is reviewing evidence before scheduling mediation.",
    color: "border-blue-200 bg-blue-50/60",
  },
  IN_MEDIATION: {
    icon: <ShieldAlert className="h-4 w-4 text-indigo-500" />,
    hint: "Case is in mediation stage. Propose available slots for the hearing.",
    color: "border-indigo-200 bg-indigo-50/60",
  },
  INFO_REQUESTED: {
    icon: <MessageSquareWarning className="h-4 w-4 text-orange-500" />,
    hint: "Staff requested additional information from the raiser.",
    color: "border-orange-200 bg-orange-50/60",
  },
  PENDING_REVIEW: {
    icon: <Clock className="h-4 w-4 text-cyan-500" />,
    hint: "Case is pending additional internal review by staff.",
    color: "border-cyan-200 bg-cyan-50/60",
  },
};

const proposalStatusBadge = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "SUBMITTED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const resolveDirectionText = (item: SchedulingWorklistItem) => {
  const raiser = item.raiserName || "Unknown";
  const defendant = item.defendantName || "Unknown";

  if (item.perspective === "RAISER") {
    return `You filed this dispute against ${defendant}.`;
  }

  if (item.perspective === "DEFENDANT") {
    return `${raiser} filed this dispute against you.`;
  }

  return `Dispute between ${raiser} and ${defendant}.`;
};

export const SchedulingActionPanel = ({
  selectedCase,
  proposalStart,
  proposalEnd,
  proposalNote,
  proposalDurationLabel,
  proposalValidationError,
  canCreateProposal,
  proposalLoading,
  proposalSubmitLoading,
  proposalDeleteId,
  scheduleProposals,
  infoResponseDraft,
  infoEvidenceIds,
  submittingInfo,
  canceling,
  onProposalStartChange,
  onProposalEndChange,
  onProposalNoteChange,
  onInfoResponseChange,
  onInfoEvidenceIdsChange,
  onCreateProposal,
  onSubmitProposals,
  onDeleteProposal,
  onProvideInfo,
  onCancelDispute,
}: SchedulingActionPanelProps) => {
  if (!selectedCase) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
        <div className="rounded-full bg-slate-100 p-3">
          <CalendarPlus className="h-6 w-6 text-slate-400" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-slate-700">
          No case selected
        </h3>
        <p className="mt-1 max-w-[260px] text-xs text-slate-500">
          Select a dispute case from the list to propose hearing slots, respond
          to requests, or cancel when eligible.
        </p>
      </div>
    );
  }

  const showProvideInfo = selectedCase.actionType === "PROVIDE_INFO";
  const showProposalComposer = selectedCase.canProposeSlots;
  const showUnavailableReason =
    !selectedCase.canProposeSlots && !showProvideInfo;
  const config = statusConfig[selectedCase.status];

  return (
    <div className="space-y-4">
      {/* Case Header */}
      <div
        className={cn(
          "rounded-2xl border p-4 shadow-sm",
          config?.color || "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {config?.icon || <Info className="h-4 w-4 text-slate-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {selectedCase.projectTitle || "Untitled project"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              {selectedCase.displayCode}
              {selectedCase.counterpartyName
                ? ` vs ${selectedCase.counterpartyName}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {resolveDirectionText(selectedCase)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Assigned staff:{" "}
              <span className="font-medium text-slate-700">
                {selectedCase.assignedStaffName ||
                  selectedCase.assignedStaffEmail ||
                  "Pending assignment"}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
            {selectedCase.status.replaceAll("_", " ")}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
              selectedCase.requiresAction
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-500",
            )}
          >
            {selectedCase.actionType.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {config?.hint || "Follow the required action for this case."}
        </p>
      </div>

      {/* Proposal Composer */}
      {showProposalComposer && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-slate-900">
              Propose Available Slots
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Add one or more preferred time slots. The scheduler will prioritize
            overlapping availability while respecting busy blocks.
          </p>

          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  Start time
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={proposalStart}
                  onChange={(e) => onProposalStartChange(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  End time
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={proposalEnd}
                  onChange={(e) => onProposalEndChange(e.target.value)}
                />
              </div>
            </div>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Optional note (e.g. preferred, backup)"
              value={proposalNote}
              onChange={(e) => onProposalNoteChange(e.target.value)}
            />
            {(proposalDurationLabel || proposalValidationError) && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {proposalDurationLabel && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-medium",
                      proposalValidationError
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                    )}
                  >
                    Duration: {proposalDurationLabel}
                  </span>
                )}
                {proposalValidationError && (
                  <span className="text-red-600">{proposalValidationError}</span>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                disabled={!canCreateProposal || proposalLoading}
                onClick={onCreateProposal}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {proposalLoading ? "Saving..." : "Add slot"}
              </button>
              <button
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={
                  proposalSubmitLoading || scheduleProposals.length === 0
                }
                onClick={onSubmitProposals}
              >
                <Send className="h-3.5 w-3.5" />
                {proposalSubmitLoading ? "Submitting..." : "Submit all"}
              </button>
            </div>
          </div>

          {/* Existing proposals */}
          {scheduleProposals.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Your proposals ({scheduleProposals.length})
              </p>
              {scheduleProposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      <span className="text-sm font-medium text-slate-800">
                        {format(new Date(proposal.startTime), "MMM d, h:mm a")}{" "}
                        - {format(new Date(proposal.endTime), "h:mm a")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          proposalStatusBadge(proposal.status),
                        )}
                      >
                        {proposal.status}
                      </span>
                      {proposal.note && (
                        <span className="truncate text-[11px] text-slate-500">
                          {proposal.note}
                        </span>
                      )}
                    </div>
                  </div>
                  {proposal.status !== "WITHDRAWN" && (
                    <button
                      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      disabled={proposalDeleteId === proposal.id}
                      onClick={() => onDeleteProposal(proposal.id)}
                      title="Remove proposal"
                    >
                      {proposalDeleteId === proposal.id ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Provide Info */}
      {showProvideInfo && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-slate-900">
              Action Required
            </h4>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {selectedCase.infoRequestReason ||
              "Staff has requested additional information from you before proceeding."}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            <span>
              Deadline:{" "}
              {selectedCase.infoRequestDeadline
                ? format(
                    new Date(selectedCase.infoRequestDeadline),
                    "MMM d, yyyy h:mm a",
                  )
                : "Not specified"}
            </span>
          </div>
          <textarea
            rows={4}
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            placeholder="Provide additional context, clarification, or evidence references..."
            value={infoResponseDraft}
            onChange={(e) => onInfoResponseChange(e.target.value)}
          />
          <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-700">Evidence Vault</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Upload new evidence or select existing files to include with this response.
            </p>
            <div className="mt-3">
              <EvidenceVault
                disputeId={selectedCase.disputeId}
                selectable
                selectedEvidenceIds={infoEvidenceIds}
                onSelectionChange={onInfoEvidenceIdsChange}
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
              disabled={submittingInfo}
              onClick={onProvideInfo}
            >
              <Send className="h-3.5 w-3.5" />
              {submittingInfo ? "Submitting..." : "Submit response"}
            </button>
          </div>
        </div>
      )}

      {/* Unavailable reason */}
      {showUnavailableReason && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <div>
            <h4 className="text-sm font-semibold text-slate-700">
              Slot proposals not available
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {selectedCase.notEligibleReasonText ||
                "This dispute is not eligible for slot proposals at the moment."}
            </p>
          </div>
        </div>
      )}

      {/* Cancel option */}
      {selectedCase.canCancel && (
        <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              Cancel this dispute
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            You raised this dispute and it's still in early stages. You can
            cancel it if it was filed by mistake or the issue was resolved
            outside the platform.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
              disabled={canceling}
              onClick={onCancelDispute}
            >
              <XCircle className="h-3.5 w-3.5" />
              {canceling ? "Canceling..." : "Cancel dispute"}
            </button>
          </div>
        </div>
      )}

      {/* Triage waiting state */}
      {selectedCase.status === DisputeStatus.TRIAGE_PENDING && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/30 p-4 shadow-sm">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Awaiting staff triage
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Staff is still triaging this dispute. You can prepare your
              availability in the calendar above and return when the case enters
              preview or mediation.
            </p>
          </div>
        </div>
      )}

      {/* Confirm hearing hint */}
      {selectedCase.actionType === "CONFIRM_HEARING" && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-slate-700">
              Hearing invitation pending
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              You have a pending hearing invitation for this dispute. Check the
              calendar above and click the event to accept, decline, or mark as
              tentative.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
