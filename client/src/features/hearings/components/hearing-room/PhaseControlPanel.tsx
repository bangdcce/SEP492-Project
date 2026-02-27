import React, { memo, useCallback, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Circle,
  Lock,
  Loader2,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/components/ui/utils";
import { panelTitleClass, sectionCardClass } from "./constants";
import type { HearingPhaseGateStatus } from "@/features/hearings/types";

/* Phase metadata: label, description, and mapped speaker role */
const PHASE_META: Record<
  string,
  { label: string; short: string; description: string; speakerHint: string }
> = {
  PRESENTATION: {
    label: "Presentation",
    short: "PRES",
    description: "Raiser presents claims and evidence",
    speakerHint: "Raiser speaks",
  },
  EVIDENCE_SUBMISSION: {
    label: "Evidence Submission",
    short: "EVID",
    description: "Both parties submit / supplement evidence",
    speakerHint: "All parties may speak",
  },
  CROSS_EXAMINATION: {
    label: "Cross-Examination",
    short: "CROSS",
    description: "Defendant responds to claims",
    speakerHint: "Defendant speaks",
  },
  INTERROGATION: {
    label: "Interrogation",
    short: "INTG",
    description: "Staff/Admin questions both parties",
    speakerHint: "Moderator speaks",
  },
  DELIBERATION: {
    label: "Deliberation",
    short: "DLBR",
    description: "Read-only review period",
    speakerHint: "All muted",
  },
};

interface PhaseControlPanelProps {
  phaseSequence: string[];
  currentPhase: string;
  currentStep: number;
  gate: HearingPhaseGateStatus | null | undefined;
  canModerate: boolean;
  hearingStatus?: string | null;
  onTransitionPhase: (phase: string) => Promise<void>;
}

export const PhaseControlPanel = memo(function PhaseControlPanel({
  phaseSequence,
  currentPhase,
  currentStep,
  gate,
  canModerate,
  hearingStatus,
  onTransitionPhase,
}: PhaseControlPanelProps) {
  const [transitioning, setTransitioning] = useState(false);

  const isLive = hearingStatus === "IN_PROGRESS";
  const nextIdx = currentStep; // currentStep is 0-based already done, so this is the next index
  const nextPhase =
    nextIdx < phaseSequence.length ? phaseSequence[nextIdx] : null;
  const prevIdx = currentStep - 2; // Previous phase index
  const prevPhase = prevIdx >= 0 ? phaseSequence[prevIdx] : null;
  const canAdvance =
    isLive && canModerate && nextPhase && gate?.canTransition !== false;
  const canGoBack = isLive && canModerate && prevPhase;

  const handleAdvance = useCallback(async () => {
    if (!nextPhase || transitioning) return;
    setTransitioning(true);
    try {
      await onTransitionPhase(nextPhase);
    } finally {
      setTransitioning(false);
    }
  }, [nextPhase, transitioning, onTransitionPhase]);

  const handleGoBack = useCallback(async () => {
    if (!prevPhase || transitioning) return;
    setTransitioning(true);
    try {
      await onTransitionPhase(prevPhase);
    } finally {
      setTransitioning(false);
    }
  }, [prevPhase, transitioning, onTransitionPhase]);

  if (!phaseSequence.length) return null;

  return (
    <div className={cn(sectionCardClass, "p-3 space-y-2")}>
      <p className={panelTitleClass}>Hearing Phases</p>

      {/* Phase stepper */}
      <div className="flex items-center gap-0.5 flex-wrap">
        {phaseSequence.map((phase, idx) => {
          const meta = PHASE_META[phase] ?? {
            label: phase,
            short: phase.slice(0, 4),
            description: "",
            speakerHint: "",
          };
          const isCurrent = idx === currentStep - 1;
          const isDone = idx < currentStep - 1;
          const isFuture = idx >= currentStep;

          return (
            <React.Fragment key={phase}>
              {idx > 0 && (
                <ArrowRight
                  className={cn(
                    "h-3 w-3 shrink-0",
                    isDone ? "text-emerald-500" : "text-slate-300",
                  )}
                />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-colors",
                      isCurrent &&
                        "border-amber-400 bg-amber-50 text-amber-800 ring-1 ring-amber-200",
                      isDone &&
                        "border-emerald-200 bg-emerald-50 text-emerald-700",
                      isFuture &&
                        !isCurrent &&
                        "border-slate-200 bg-slate-50 text-slate-400",
                    )}
                  >
                    {isDone ? (
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                    ) : isCurrent ? (
                      <Circle className="h-3 w-3 text-amber-500 fill-amber-500" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-300" />
                    )}
                    {meta.short}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-xs text-slate-400">{meta.description}</p>
                  <p className="text-xs text-slate-400">{meta.speakerHint}</p>
                </TooltipContent>
              </Tooltip>
            </React.Fragment>
          );
        })}
      </div>

      {/* Current phase info */}
      <div className="text-xs text-slate-600">
        Current:{" "}
        <Badge className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
          {PHASE_META[currentPhase]?.label ?? currentPhase}
        </Badge>
      </div>

      {/* Gate status */}
      {gate && !gate.canTransition && gate.reason && (
        <div className="flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-2">
          <Lock className="h-3 w-3 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Cannot advance</p>
            <p>{gate.reason}</p>
            {gate.missingParticipants?.length > 0 && (
              <p className="text-slate-500 mt-0.5">
                Missing:{" "}
                {gate.missingParticipants.map((p) => p.displayName).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Phase transition buttons */}
      {canModerate && isLive && (
        <div className="flex gap-2">
          {/* Go Back button */}
          {prevPhase && (
            <button
              onClick={handleGoBack}
              disabled={!canGoBack || transitioning}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                canGoBack
                  ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              )}
            >
              {transitioning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowLeft className="h-3.5 w-3.5" />
              )}
              {PHASE_META[prevPhase]?.short ?? prevPhase}
            </button>
          )}

          {/* Advance button */}
          {nextPhase && (
            <button
              onClick={handleAdvance}
              disabled={!canAdvance || transitioning}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                canAdvance
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              )}
            >
              {transitioning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              {transitioning
                ? "…"
                : `Next: ${PHASE_META[nextPhase]?.short ?? nextPhase}`}
            </button>
          )}
        </div>
      )}

      {/* All phases done */}
      {!nextPhase && currentStep >= phaseSequence.length && (
        <p className="text-xs text-emerald-600 font-medium">
          All phases completed
        </p>
      )}
    </div>
  );
});
