/**
 * VerdictAnnouncement  EPublic verdict display in the hearing room
 * ─────────────────────────────────────────────────────────────────
 * Courtroom-style transparent verdict with:
 *   • Result (WIN_CLIENT / WIN_FREELANCER / SPLIT)
 *   • Fault type + faulty party
 *   • Full reasoning (violated policies, factual findings, legal analysis, conclusion)
 *   • Money distribution
 *   • Appeal info + button
 */

import { useMemo, useState } from "react";
import {
  Gavel,
  Scale,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  ShieldAlert,
  Trophy,
  Users,
  Ban,
} from "lucide-react";
import { cn } from "@/shared/components/ui/utils";
import type { VerdictSummary } from "@/features/hearings/types";

/* ─── Types ─── */

interface VerdictAnnouncementProps {
  verdict: VerdictSummary;
  /** The current user's hearing role  Eused for appeal eligibility */
  participantRole?: string | null;
  /** Whether the appeal deadline has passed */
  appealDeadlinePassed?: boolean;
  /** Called when user clicks "Appeal Verdict" */
  onAppeal?: () => void;
  /** Whether appeal is in progress */
  appealLoading?: boolean;
}

/* ─── Helpers ─── */

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
  raiser: "Dispute Raiser (Plaintiff)",
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

const formatDeadline = (deadline: string) => {
  const date = new Date(deadline);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
  const minutes = Math.max(
    0,
    Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  );

  if (diff <= 0) return "Expired";
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  return `${hours}h ${minutes}m remaining`;
};

/* ─── Component ─── */

export const VerdictAnnouncement = ({
  verdict,
  participantRole,
  appealDeadlinePassed,
  onAppeal,
  appealLoading,
}: VerdictAnnouncementProps) => {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  const display = RESULT_DISPLAY[verdict.result] ?? RESULT_DISPLAY.SPLIT;
  const ResultIcon = display.icon;

  const canAppeal = useMemo(() => {
    if (appealDeadlinePassed) return false;
    if (verdict.isAppealVerdict) return false; // can't re-appeal
    // Only raiser/defendant can appeal
    return participantRole === "RAISER" || participantRole === "DEFENDANT";
  }, [participantRole, appealDeadlinePassed, verdict.isAppealVerdict]);

  const totalAmount =
    (verdict.amountToClient ?? 0) + (verdict.amountToFreelancer ?? 0);

  return (
    <div
      className={cn(
        "rounded-xl border-2 shadow-md overflow-hidden",
        display.border,
      )}
    >
      {/* ── Header banner ── */}
      <div className={cn("px-4 py-3 flex items-center gap-3", display.bg)}>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2",
            display.border,
            display.bg,
          )}
        >
          <Gavel className={cn("h-5 w-5", display.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={cn("text-base font-bold tracking-tight", display.color)}
          >
            VERDICT ANNOUNCED
          </h3>
          <p className={cn("text-sm font-medium", display.color)}>
            {display.label}
          </p>
        </div>
        <ResultIcon className={cn("h-6 w-6 shrink-0", display.color)} />
      </div>

      {/* ── Verdict body ── */}
      <div className="bg-white p-4 space-y-4">
        {/* Appeal verdict badge */}
        {verdict.isAppealVerdict && (
          <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800">
            <Scale className="h-4 w-4" />
            <span className="font-semibold">Appeal Verdict</span>
            <span className="text-purple-600">
               EThis overrides the original ruling
            </span>
          </div>
        )}

        {/* Fault + Party */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Fault Type
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {FAULT_LABELS[verdict.faultType] ?? verdict.faultType}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Users className="h-3.5 w-3.5" />
              At-Fault Party
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {PARTY_LABELS[verdict.faultyParty] ?? verdict.faultyParty}
            </p>
          </div>
        </div>

        {/* Money distribution */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
            <DollarSign className="h-3.5 w-3.5" />
            Financial Resolution
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">To Client</p>
              <p className="text-lg font-bold text-slate-800">
                {formatCurrency(verdict.amountToClient)}
              </p>
              {totalAmount > 0 && (
                <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round((verdict.amountToClient / totalAmount) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">To Freelancer</p>
              <p className="text-lg font-bold text-slate-800">
                {formatCurrency(verdict.amountToFreelancer)}
              </p>
              {totalAmount > 0 && (
                <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round((verdict.amountToFreelancer / totalAmount) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          {verdict.platformFee != null && verdict.platformFee > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Platform fee: {formatCurrency(verdict.platformFee)}
            </p>
          )}
        </div>

        {/* Warning / Ban */}
        {(verdict.warningMessage || verdict.isBanTriggered) && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-1">
            {verdict.warningMessage && (
              <div className="flex items-start gap-2 text-sm text-rose-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{verdict.warningMessage}</span>
              </div>
            )}
            {verdict.isBanTriggered && (
              <div className="flex items-center gap-2 text-xs text-rose-700">
                <Ban className="h-3.5 w-3.5" />
                <span>
                  Account restriction applied
                  {verdict.banDurationDays
                    ? ` (${verdict.banDurationDays} days)`
                    : ""}
                </span>
              </div>
            )}
            {verdict.trustScorePenalty != null &&
              verdict.trustScorePenalty > 0 && (
                <p className="text-xs text-rose-600">
                  Trust score penalty: −{verdict.trustScorePenalty}
                </p>
              )}
          </div>
        )}

        {/* Reasoning (collapsible) */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setReasoningExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
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

          {reasoningExpanded && (
            <div className="border-t border-slate-200 p-4 space-y-4 bg-slate-50/50">
              {/* Violated policies */}
              {verdict.reasoning.violatedPolicies.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Violated Policies
                  </h4>
                  <ul className="space-y-1">
                    {verdict.reasoning.violatedPolicies.map((policy, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                        {policy}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Factual findings */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Factual Findings
                </h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {verdict.reasoning.factualFindings}
                </p>
              </div>

              {/* Legal analysis */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Legal Analysis
                </h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {verdict.reasoning.legalAnalysis}
                </p>
              </div>

              {/* Conclusion */}
              <div className="rounded-lg border border-slate-300 bg-white p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Conclusion
                </h4>
                <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {verdict.reasoning.conclusion}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Adjudicator + timestamp */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Issued by{" "}
            <span className="font-medium text-slate-700">
              {verdict.adjudicator?.fullName ?? "Staff"}
            </span>
            {verdict.tier === 2 && (
              <span className="ml-1 text-purple-600">(Tier 2  EAdmin)</span>
            )}
          </span>
          <span>{new Date(verdict.issuedAt).toLocaleString()}</span>
        </div>

        {/* Appeal section */}
        {!verdict.isAppealVerdict && verdict.appealDeadline && (
          <div className="border-t border-slate-200 pt-3 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Appeal deadline:{" "}
                  <span className="font-medium text-slate-700">
                    {formatDeadline(verdict.appealDeadline)}
                  </span>
                </span>
              </div>
              {canAppeal && onAppeal && (
                <button
                  type="button"
                  onClick={onAppeal}
                  disabled={appealLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <Scale className="h-3.5 w-3.5" />
                  {appealLoading ? "Submitting…" : "Appeal Verdict"}
                </button>
              )}
            </div>
            {!canAppeal && !appealDeadlinePassed && (
              <p className="mt-1 text-xs text-slate-400">
                Only dispute parties (raiser/defendant) may file an appeal.
              </p>
            )}
            {appealDeadlinePassed && (
              <p className="mt-1 text-xs text-slate-400">
                The appeal window has closed.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
