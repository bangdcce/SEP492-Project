import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  Gavel,
  Scale,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/shared/components/ui/utils";
import type { VerdictSummary } from "@/features/hearings/types";

interface VerdictAnnouncementProps {
  verdict: VerdictSummary;
  participantRole?: string | null;
  canAppealOverride?: boolean;
  appealDeadlinePassed?: boolean;
  onAppeal?: () => void;
  appealLoading?: boolean;
  onAccept?: () => void;
  acceptLoading?: boolean;
}

const RESULT_DISPLAY: Record<
  string,
  {
    label: string;
    icon: typeof Trophy;
    color: string;
    bg: string;
    border: string;
  }
> = {
  WIN_CLIENT: {
    label: "Ruling in favor of the Client",
    icon: Trophy,
    color: "text-sky-800",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  WIN_FREELANCER: {
    label: "Ruling in favor of the Freelancer",
    icon: Trophy,
    color: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  SPLIT: {
    label: "Split Decision",
    icon: Scale,
    color: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
};

const FAULT_LABELS: Record<string, string> = {
  NON_DELIVERY: "Non-Delivery",
  QUALITY_MISMATCH: "Quality Mismatch",
  DEADLINE_MISSED: "Deadline Missed",
  GHOSTING: "Ghosting",
  SCOPE_CHANGE_CONFLICT: "Scope Change Conflict",
  PAYMENT_ISSUE: "Payment Issue",
  FRAUD: "Fraud",
  MUTUAL_FAULT: "Mutual Fault",
  NO_FAULT: "No Fault Found",
  OTHER: "Other",
};

const PARTY_LABELS: Record<string, string> = {
  raiser: "Dispute Raiser",
  defendant: "Defendant",
  both: "Both Parties",
  none: "Neither Party",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

const formatAppealDeadline = (deadline: string) => {
  const date = new Date(deadline);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return "Expired";

  const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
  const minutes = Math.max(
    0,
    Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  );

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
};

export const VerdictAnnouncement = ({
  verdict,
  participantRole,
  canAppealOverride,
  appealDeadlinePassed,
  onAppeal,
  appealLoading,
  onAccept,
  acceptLoading,
}: VerdictAnnouncementProps) => {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  const display = RESULT_DISPLAY[verdict.result] ?? RESULT_DISPLAY.SPLIT;
  const ResultIcon = display.icon;
  const reasoning = useMemo(
    () => ({
      violatedPolicies: verdict.reasoning?.violatedPolicies ?? [],
      supportingEvidenceIds: verdict.reasoning?.supportingEvidenceIds ?? [],
      policyReferences: verdict.reasoning?.policyReferences ?? [],
      legalReferences: verdict.reasoning?.legalReferences ?? [],
      contractReferences: verdict.reasoning?.contractReferences ?? [],
      evidenceReferences: verdict.reasoning?.evidenceReferences ?? [],
      factualFindings: verdict.reasoning?.factualFindings ?? "",
      legalAnalysis: verdict.reasoning?.legalAnalysis ?? "",
      analysis: verdict.reasoning?.analysis ?? "",
      conclusion: verdict.reasoning?.conclusion ?? "",
      remedyRationale: verdict.reasoning?.remedyRationale ?? "",
      trustPenaltyRationale: verdict.reasoning?.trustPenaltyRationale ?? "",
    }),
    [verdict.reasoning],
  );
  const hasDetailedReasoning = useMemo(() => {
    return (
      reasoning.violatedPolicies.length > 0 ||
      reasoning.policyReferences.length > 0 ||
      reasoning.legalReferences.length > 0 ||
      reasoning.contractReferences.length > 0 ||
      reasoning.evidenceReferences.length > 0 ||
      reasoning.factualFindings.trim().length > 0 ||
      reasoning.legalAnalysis.trim().length > 0 ||
      reasoning.analysis.trim().length > 0 ||
      reasoning.remedyRationale.trim().length > 0 ||
      reasoning.trustPenaltyRationale.trim().length > 0 ||
      reasoning.conclusion.trim().length > 0
    );
  }, [reasoning]);

  const canAppeal = useMemo(() => {
    if (typeof verdict.acceptance?.currentUserCanAppeal === "boolean") {
      return verdict.acceptance.currentUserCanAppeal;
    }
    if (typeof canAppealOverride === "boolean") {
      return canAppealOverride;
    }
    if (appealDeadlinePassed) return false;
    if (verdict.isAppealVerdict) return false;
    if (verdict.isAppealed) return false;
    return participantRole === "RAISER" || participantRole === "DEFENDANT";
  }, [
    canAppealOverride,
    participantRole,
    appealDeadlinePassed,
    verdict.isAppealVerdict,
    verdict.isAppealed,
    verdict.acceptance?.currentUserCanAppeal,
  ]);
  const canAccept = Boolean(verdict.acceptance?.currentUserCanAccept);
  const currentUserAccepted = Boolean(verdict.acceptance?.currentUserAccepted);
  const acceptedCount = verdict.acceptance?.acceptedCount ?? 0;
  const requiredPartyCount = verdict.acceptance?.requiredPartyCount ?? 0;
  const allPartiesAccepted = Boolean(verdict.acceptance?.allPartiesAccepted);

  const totalAmount =
    (verdict.amountToClient ?? 0) + (verdict.amountToFreelancer ?? 0);
  const appealedAtText = verdict.appealedAt
    ? new Date(verdict.appealedAt).toLocaleString()
    : null;
  const appealResolvedAtText = verdict.appealResolvedAt
    ? new Date(verdict.appealResolvedAt).toLocaleString()
    : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 shadow-md",
        display.border,
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-3", display.bg)}>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2",
            display.border,
            display.bg,
          )}
        >
          <Gavel className={cn("h-5 w-5", display.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-base font-bold tracking-tight", display.color)}>
            VERDICT ANNOUNCED
          </h3>
          <p className={cn("text-sm font-medium", display.color)}>
            {display.label}
          </p>
        </div>
        <ResultIcon className={cn("h-6 w-6 shrink-0", display.color)} />
      </div>

      <div className="space-y-4 bg-white p-4">
        {verdict.isAppealVerdict ? (
          <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800">
            <Scale className="h-4 w-4" />
            <span className="font-semibold">Appeal Verdict</span>
            <span className="text-purple-600">
              This verdict overrides the original ruling.
            </span>
          </div>
        ) : null}

        {!verdict.isAppealVerdict && verdict.isAppealed ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Scale className="h-4 w-4" />
            <span className="font-semibold">Appeal Filed</span>
            <span className="text-amber-700">
              {appealedAtText
                ? `Submitted ${appealedAtText}`
                : "The original verdict is under appeal review."}
            </span>
          </div>
        ) : null}

        {!verdict.isAppealVerdict && (acceptedCount > 0 || currentUserAccepted) ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <div className="font-semibold">
                {allPartiesAccepted
                  ? "All dispute parties accepted this verdict"
                  : `${acceptedCount}/${requiredPartyCount || 2} party accepted this verdict`}
              </div>
              <div className="text-emerald-700">
                {allPartiesAccepted
                  ? "Appeal rights are closed and verdict funds can be released to internal wallets."
                  : currentUserAccepted
                    ? "You accepted this verdict. The remaining party may still appeal until the window closes."
                    : "Funds stay pending until the other party accepts or the appeal window expires."}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldAlert className="h-3.5 w-3.5" />
              Fault Type
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {FAULT_LABELS[verdict.faultType] ?? verdict.faultType}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" />
              At-Fault Party
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {PARTY_LABELS[verdict.faultyParty] ?? verdict.faultyParty}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
            <DollarSign className="h-3.5 w-3.5" />
            Financial Resolution
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">To Client</p>
              <p className="text-lg font-bold text-slate-800">
                {formatCurrency(verdict.amountToClient)}
              </p>
              {totalAmount > 0 ? (
                <div className="mt-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-sky-500"
                    style={{
                      width: `${Math.round((verdict.amountToClient / totalAmount) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-slate-500">To Freelancer</p>
              <p className="text-lg font-bold text-slate-800">
                {formatCurrency(verdict.amountToFreelancer)}
              </p>
              {totalAmount > 0 ? (
                <div className="mt-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.round((verdict.amountToFreelancer / totalAmount) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
          {verdict.platformFee != null && verdict.platformFee > 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              Platform fee: {formatCurrency(verdict.platformFee)}
            </p>
          ) : null}
        </div>

        {verdict.warningMessage || verdict.isBanTriggered ? (
          <div className="space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3">
            {verdict.warningMessage ? (
              <div className="flex items-start gap-2 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{verdict.warningMessage}</span>
              </div>
            ) : null}
            {verdict.isBanTriggered ? (
              <div className="flex items-center gap-2 text-xs text-rose-700">
                <Ban className="h-3.5 w-3.5" />
                <span>
                  Account restriction applied
                  {verdict.banDurationDays ? ` (${verdict.banDurationDays} days)` : ""}
                </span>
              </div>
            ) : null}
            {verdict.trustScorePenalty != null && verdict.trustScorePenalty > 0 ? (
              <p className="text-xs text-rose-600">
                Trust score penalty: -{verdict.trustScorePenalty}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setReasoningExpanded((value) => !value)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Full Reasoning & Analysis
            </span>
            {reasoningExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {reasoningExpanded ? (
            <div className="space-y-4 border-t border-slate-200 bg-slate-50/50 p-4">
              {reasoning.violatedPolicies.length > 0 ? (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Violated Policies
                  </h4>
                  <ul className="space-y-1">
                    {reasoning.violatedPolicies.map((policy, index) => (
                      <li
                        key={`${policy}-${index}`}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                        {policy}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {[
                {
                  title: "Policy References",
                  items: reasoning.policyReferences,
                },
                {
                  title: "Legal References",
                  items: reasoning.legalReferences,
                },
                {
                  title: "Contract References",
                  items: reasoning.contractReferences,
                },
                {
                  title: "Evidence References",
                  items: reasoning.evidenceReferences,
                },
              ].map((section) =>
                section.items.length > 0 ? (
                  <div key={section.title}>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {section.title}
                    </h4>
                    <ul className="space-y-1">
                      {section.items.map((item, index) => (
                        <li
                          key={`${section.title}-${index}`}
                          className="flex items-start gap-2 text-sm text-slate-700"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}

              {hasDetailedReasoning ? (
                <>
                  {reasoning.factualFindings.trim().length > 0 ? (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Factual Findings
                      </h4>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {reasoning.factualFindings}
                      </p>
                    </div>
                  ) : null}

                  {reasoning.legalAnalysis.trim().length > 0 ? (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Legal Analysis
                      </h4>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {reasoning.legalAnalysis}
                      </p>
                    </div>
                  ) : null}

                  {reasoning.analysis.trim().length > 0 ? (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Platform Analysis
                      </h4>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {reasoning.analysis}
                      </p>
                    </div>
                  ) : null}

                  {reasoning.remedyRationale.trim().length > 0 ? (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Remedy Rationale
                      </h4>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {reasoning.remedyRationale}
                      </p>
                    </div>
                  ) : null}

                  {reasoning.trustPenaltyRationale.trim().length > 0 ? (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Trust / Penalty Rationale
                      </h4>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                        {reasoning.trustPenaltyRationale}
                      </p>
                    </div>
                  ) : null}

                  {reasoning.conclusion.trim().length > 0 ? (
                    <div className="rounded-lg border border-slate-300 bg-white p-3">
                      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Conclusion
                      </h4>
                      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-800">
                        {reasoning.conclusion}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  Detailed reasoning is unavailable for this verdict record.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
          <span>
            Issued by <span className="font-medium text-slate-700">
              {verdict.adjudicator?.fullName ?? "Staff"}
            </span>
            {verdict.tier === 2 ? (
              <span className="ml-1 text-purple-600">(Tier 2 Admin)</span>
            ) : null}
          </span>
          <span>{new Date(verdict.issuedAt).toLocaleString()}</span>
        </div>

        {!verdict.isAppealVerdict && verdict.appealDeadline ? (
          <div className="mt-1 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Appeal deadline:{" "}
                  <span className="font-medium text-slate-700">
                    {formatAppealDeadline(verdict.appealDeadline)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canAccept && onAccept ? (
                  <button
                    type="button"
                    onClick={onAccept}
                    disabled={acceptLoading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {acceptLoading ? "Submitting..." : "Accept Verdict"}
                  </button>
                ) : null}
                {canAppeal && onAppeal ? (
                  <button
                    type="button"
                    onClick={onAppeal}
                    disabled={appealLoading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    {appealLoading ? "Submitting..." : "Appeal Verdict"}
                  </button>
                ) : null}
              </div>
            </div>
            {verdict.isAppealed && !verdict.isAppealVerdict ? (
              <p className="mt-1 text-xs text-amber-700">
                Appeal is pending Tier 2 review
                {appealedAtText ? ` since ${appealedAtText}.` : "."}
              </p>
            ) : null}
            {currentUserAccepted ? (
              <p className="mt-1 text-xs text-emerald-700">
                You accepted this verdict and waived your own appeal rights.
              </p>
            ) : null}
            {!canAppeal && !appealDeadlinePassed ? (
              <p className="mt-1 text-xs text-slate-400">
                {currentUserAccepted
                  ? "You already accepted this verdict."
                  : allPartiesAccepted
                    ? "Both parties already accepted this verdict."
                    : verdict.isAppealed
                  ? "An appeal has already been filed for this verdict."
                  : "Only the eligible losing dispute party may appeal. Witnesses and winning/refunded parties cannot appeal."}
              </p>
            ) : null}
            {appealDeadlinePassed ? (
              <p className="mt-1 text-xs text-slate-400">
                The appeal window has closed.
              </p>
            ) : null}
            {verdict.appealResolution && verdict.appealResolvedAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Appeal resolution recorded {appealResolvedAtText}: {verdict.appealResolution}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
