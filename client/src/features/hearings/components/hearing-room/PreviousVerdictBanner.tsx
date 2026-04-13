/**
 * PreviousVerdictBanner — TIER_2 hearing reference panel
 * ───────────────────────────────────────────────────────
 * Compact, collapsible display of the Tier 1 verdict that is under appeal.
 * Shown at the top of TIER_2 hearings so the Admin moderator
 * and parties can reference the original ruling while deliberating.
 */

import { useState } from "react";
import {
  Gavel,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Scale,
} from "lucide-react";
import type { VerdictSummary } from "@/features/hearings/types";

interface PreviousVerdictBannerProps {
  verdict: VerdictSummary;
}

const RESULT_LABEL: Record<string, string> = {
  WIN_CLIENT: "Ruled in favour of Raiser",
  WIN_FREELANCER: "Ruled in favour of Defendant",
  SPLIT: "Split / Partial award",
};

const FAULT_LABEL: Record<string, string> = {
  raiser: "Raiser at fault",
  defendant: "Defendant at fault",
  both: "Both parties at fault",
  none: "No fault determined",
};

export function PreviousVerdictBanner({ verdict }: PreviousVerdictBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const resultText = RESULT_LABEL[verdict.result] || verdict.result;
  const faultText = FAULT_LABEL[verdict.faultyParty] || verdict.faultyParty;
  const issuedDate = new Date(verdict.issuedAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-amber-300/50 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/40">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex-1">
          Previous Verdict (Tier 1 — Under Appeal)
        </span>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {resultText}
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-amber-200/60 dark:border-amber-800/40 pt-2">
          {/* Key facts row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1">
              <Gavel className="h-3 w-3 text-amber-600" />
              <span className="text-muted-foreground">Result:</span>
              <span className="font-medium">{resultText}</span>
            </div>
            <div className="flex items-center gap-1">
              <Scale className="h-3 w-3 text-amber-600" />
              <span className="text-muted-foreground">Fault:</span>
              <span className="font-medium">{faultText}</span>
            </div>
            {verdict.faultType && (
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <span className="font-medium">
                  {verdict.faultType.replace(/_/g, " ")}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Issued:</span>{" "}
              <span className="font-medium">{issuedDate}</span>
            </div>
            {verdict.adjudicator?.fullName && (
              <div>
                <span className="text-muted-foreground">By:</span>{" "}
                <span className="font-medium">
                  {verdict.adjudicator.fullName}
                </span>
              </div>
            )}
          </div>

          {/* Money distribution */}
          {(verdict.amountToClient > 0 || verdict.amountToFreelancer > 0) && (
            <div className="flex gap-3 text-xs">
              <span className="text-muted-foreground">Distribution:</span>
              <span>
                Client:{" "}
                <strong>
                  {Number(verdict.amountToClient).toLocaleString()} ₫
                </strong>
              </span>
              <span>
                Freelancer:{" "}
                <strong>
                  {Number(verdict.amountToFreelancer).toLocaleString()} ₫
                </strong>
              </span>
            </div>
          )}

          {/* Reasoning summary */}
          {verdict.reasoning && (
            <div className="space-y-1 text-xs">
              {verdict.reasoning.conclusion && (
                <div>
                  <span className="text-muted-foreground font-medium">
                    Conclusion:
                  </span>{" "}
                  <span className="text-foreground/80">
                    {verdict.reasoning.conclusion}
                  </span>
                </div>
              )}
              {verdict.reasoning.factualFindings && (
                <div>
                  <span className="text-muted-foreground font-medium">
                    Findings:
                  </span>{" "}
                  <span className="text-foreground/80">
                    {verdict.reasoning.factualFindings}
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] italic text-amber-600/80 dark:text-amber-400/60">
            This verdict is being reviewed in appeal. A new ruling may be issued
            during this Tier 2 hearing.
          </p>
        </div>
      )}
    </div>
  );
}
