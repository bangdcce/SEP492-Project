/**
 * RoleGuideBanner — Context-aware guidance banner per role per hearing phase.
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows a courtroom-style banner:
 *   • What the participant's role is in plain language
 *   • What they should do in the current phase
 *   • What actions are available / restricted
 *
 * Phases: PRESENTATION → CROSS_EXAMINATION → INTERROGATION → DELIBERATION
 * Roles:  RAISER | DEFENDANT | WITNESS | MODERATOR | OBSERVER
 */

import { useMemo, useState } from "react";
import {
  Gavel,
  MessageSquare,
  ShieldAlert,
  Eye,
  Users,
  ChevronDown,
  ChevronUp,
  Scale,
  FileText,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/shared/components/ui/utils";
import type { HearingParticipantRole } from "@/features/hearings/types";

/* ─── Types ─── */

interface RoleGuideBannerProps {
  /** Current participant's role in this hearing */
  participantRole?: HearingParticipantRole | string | null;
  /** Current hearing phase */
  currentPhase?: string | null;
  /** Hearing status */
  hearingStatus?: string | null;
  /** Whether user can send messages right now */
  canSendMessage?: boolean;
  /** Whether user can ask questions */
  canAskQuestions?: boolean;
  /** Whether user can moderate */
  canModerate?: boolean;
  /** Blocked reason from speaker control */
  chatBlockedReason?: string | null;
}

/* ─── Phase & Role Guidance Data ─── */

interface PhaseGuidance {
  action: string;
  detail: string;
  tips: string[];
}

const ROLE_META: Record<
  string,
  {
    label: string;
    courtTitle: string;
    icon: typeof Gavel;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  RAISER: {
    label: "Dispute Raiser",
    courtTitle: "Plaintiff",
    icon: Scale,
    color: "text-sky-800",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
  },
  DEFENDANT: {
    label: "Defendant",
    courtTitle: "Defendant",
    icon: ShieldAlert,
    color: "text-rose-800",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  WITNESS: {
    label: "Witness",
    courtTitle: "Witness",
    icon: Users,
    color: "text-amber-800",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  MODERATOR: {
    label: "Moderator",
    courtTitle: "Presiding Officer",
    icon: Gavel,
    color: "text-slate-800",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-300",
  },
  OBSERVER: {
    label: "Observer",
    courtTitle: "Observer",
    icon: Eye,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
};

/** Build guidance text per role + phase */
const getPhaseGuidance = (
  role: string,
  phase: string,
): PhaseGuidance | null => {
  const key = `${role}:${phase}`;
  const map: Record<string, PhaseGuidance> = {
    /* ── PRESENTATION phase ── */
    "RAISER:PRESENTATION": {
      action: "Present your case",
      detail:
        "This is your opportunity to explain what happened, present evidence, and make your opening statement.",
      tips: [
        "Submit an OPENING statement to introduce your claim",
        "Upload and reference evidence using #EVD tags",
        "Be clear and factual — the moderator is reviewing everything",
      ],
    },
    "DEFENDANT:PRESENTATION": {
      action: "Listen & prepare your response",
      detail:
        "The raiser is presenting their case. Listen carefully and take note of claims you'll need to address.",
      tips: [
        "You'll have your turn to respond in the Cross-Examination phase",
        "Note any inaccuracies you want to challenge",
        "You can submit an OPENING statement when ready",
      ],
    },
    "WITNESS:PRESENTATION": {
      action: "Observe the presentation",
      detail:
        "The parties are presenting their cases. You may be asked to provide testimony later.",
      tips: [
        "Stay attentive — you may be asked questions about what you know",
        "You can submit a statement if you have relevant information",
      ],
    },
    "MODERATOR:PRESENTATION": {
      action: "Oversee the presentation phase",
      detail:
        "Ensure the raiser presents their case fully. Manage speaker control to maintain order.",
      tips: [
        "Use Speaker Control to give the raiser the floor",
        "Check the Phase Gate to see if all required statements are submitted",
        "Transition to Cross-Examination when ready",
      ],
    },
    "OBSERVER:PRESENTATION": {
      action: "Observe proceedings",
      detail:
        "You are observing this hearing. You cannot send messages or submit statements.",
      tips: ["Follow the timeline to track all events"],
    },

    /* ── CROSS_EXAMINATION phase ── */
    "RAISER:CROSS_EXAMINATION": {
      action: "Respond to defendant's arguments",
      detail:
        "The defendant is responding to your claims. You may submit rebuttals to challenge their response.",
      tips: [
        "Submit a REBUTTAL statement to counter the defendant's points",
        "Reference specific evidence to strengthen your position",
        "Stay factual — personal attacks weaken your case",
      ],
    },
    "DEFENDANT:CROSS_EXAMINATION": {
      action: "Present your defense",
      detail:
        "This is your turn to respond to the claims, present your side of the story, and provide counter-evidence.",
      tips: [
        "Submit an EVIDENCE statement with your supporting documents",
        "Address each claim the raiser made specifically",
        "Upload your own evidence if you haven't already",
      ],
    },
    "WITNESS:CROSS_EXAMINATION": {
      action: "Provide testimony if asked",
      detail:
        "You may be asked questions by the moderator or parties. Answer honestly and based on your direct knowledge.",
      tips: [
        "Check the Questions panel for any questions directed at you",
        "Submit an ANSWER statement when responding to a question",
      ],
    },
    "MODERATOR:CROSS_EXAMINATION": {
      action: "Manage cross-examination",
      detail:
        "Ensure both parties have fair opportunity. Ask clarifying questions if needed.",
      tips: [
        "Give the defendant the floor via Speaker Control",
        "Ask questions to clarify disputed facts",
        "Move to Interrogation when both sides have been heard",
      ],
    },
    "OBSERVER:CROSS_EXAMINATION": {
      action: "Observe proceedings",
      detail:
        "The parties are exchanging arguments. You are observing this phase.",
      tips: ["Both sides are presenting their views"],
    },

    /* ── INTERROGATION phase ── */
    "RAISER:INTERROGATION": {
      action: "Answer moderator questions",
      detail:
        "The moderator may ask you direct questions. Check the Questions panel and respond promptly.",
      tips: [
        "Look for questions directed to you in the Questions panel",
        "Use the ANSWER statement type when responding",
        "Be precise — your answers are being reviewed for the verdict",
      ],
    },
    "DEFENDANT:INTERROGATION": {
      action: "Answer moderator questions",
      detail:
        "The moderator may ask you direct questions. Check the Questions panel and respond promptly.",
      tips: [
        "Look for questions directed to you in the Questions panel",
        "Use the ANSWER statement type when responding",
        "Be precise — your answers are being reviewed for the verdict",
      ],
    },
    "WITNESS:INTERROGATION": {
      action: "Answer if called upon",
      detail:
        "The moderator is questioning parties. You may also be asked to provide testimony.",
      tips: [
        "Check the Questions panel for questions directed at you",
        "Answer based only on what you directly witnessed",
      ],
    },
    "MODERATOR:INTERROGATION": {
      action: "Ask clarifying questions",
      detail:
        "This is your opportunity to ask direct questions to any participant to establish facts.",
      tips: [
        "Use the Ask Question button to direct questions to specific participants",
        "Focus on disputed facts and inconsistencies",
        "Prepare for the Deliberation phase",
      ],
    },
    "OBSERVER:INTERROGATION": {
      action: "Observe questioning",
      detail:
        "The moderator is asking questions to establish facts for the verdict.",
      tips: ["The interrogation helps clarify disputed facts"],
    },

    /* ── DELIBERATION phase ── */
    "RAISER:DELIBERATION": {
      action: "Await the verdict",
      detail:
        "The hearing is now in deliberation. The moderator is reviewing all evidence and statements to reach a verdict.",
      tips: [
        "You may submit a CLOSING statement as your final summary",
        "No new evidence can be submitted during deliberation",
        "The verdict will be announced in this room",
      ],
    },
    "DEFENDANT:DELIBERATION": {
      action: "Await the verdict",
      detail:
        "The hearing is now in deliberation. The moderator is reviewing all evidence and statements to reach a verdict.",
      tips: [
        "You may submit a CLOSING statement as your final summary",
        "No new evidence can be submitted during deliberation",
        "The verdict will be announced in this room",
      ],
    },
    "WITNESS:DELIBERATION": {
      action: "Await the verdict",
      detail: "The hearing is in deliberation. Thank you for your testimony.",
      tips: ["The verdict will be announced once deliberation concludes"],
    },
    "MODERATOR:DELIBERATION": {
      action: "Review & issue verdict",
      detail:
        "Review all evidence, statements, and transcripts. When ready, issue the verdict from the Dispute Detail page.",
      tips: [
        "Review the Dossier for case overview",
        "Check all evidence and statements in the Control panel",
        "End the hearing session before issuing the verdict",
      ],
    },
    "OBSERVER:DELIBERATION": {
      action: "Await the verdict",
      detail:
        "The hearing is in deliberation. The verdict will be announced shortly.",
      tips: ["Final verdict will be visible in the timeline"],
    },
  };

  return map[key] ?? null;
};

/* ─── Hearing Status Guidance ─── */

const getStatusGuidance = (
  role: string,
  status: string,
): { message: string; variant: "info" | "warning" | "muted" } | null => {
  if (status === "PAUSED") {
    return {
      message:
        role === "MODERATOR"
          ? "Hearing is paused. Resume when ready to continue."
          : "Hearing is paused by the moderator. Please wait.",
      variant: "warning",
    };
  }
  if (status === "COMPLETED" || status === "CANCELED") {
    return {
      message:
        "This hearing has ended. You are viewing the transcript in read-only mode.",
      variant: "muted",
    };
  }
  if (status === "SCHEDULED") {
    return {
      message:
        role === "MODERATOR"
          ? "Hearing is scheduled. Start the session when all participants are ready."
          : "Hearing has not started yet. Please wait for the moderator to begin.",
      variant: "info",
    };
  }
  return null;
};

/* ─── Component ─── */

export const RoleGuideBanner = ({
  participantRole,
  currentPhase,
  hearingStatus,
  canSendMessage,
  canAskQuestions: _canAskQuestions,
  canModerate: _canModerate,
  chatBlockedReason,
}: RoleGuideBannerProps) => {
  const [expanded, setExpanded] = useState(false);

  const role = participantRole ?? "OBSERVER";
  const meta = ROLE_META[role] ?? ROLE_META.OBSERVER;
  const Icon = meta.icon;

  // Status-level guidance (overrides phase guidance)
  const statusGuidance = useMemo(
    () => (hearingStatus ? getStatusGuidance(role, hearingStatus) : null),
    [role, hearingStatus],
  );

  // Phase-level guidance
  const phaseGuidance = useMemo(
    () =>
      currentPhase && hearingStatus === "IN_PROGRESS"
        ? getPhaseGuidance(role, currentPhase)
        : null,
    [role, currentPhase, hearingStatus],
  );

  // Speaker restriction warning
  const speakerWarning = useMemo(() => {
    if (canSendMessage || !chatBlockedReason) return null;
    if (role === "OBSERVER") return null;
    return chatBlockedReason;
  }, [canSendMessage, chatBlockedReason, role]);

  if (!statusGuidance && !phaseGuidance && !speakerWarning) return null;

  // Choose what to display
  const showStatus = Boolean(statusGuidance);
  const showPhase = Boolean(phaseGuidance) && !showStatus;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 mb-3 transition-all",
        meta.bgColor,
        meta.borderColor,
      )}
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                meta.color,
              )}
            >
              {meta.courtTitle}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">{meta.label}</span>
          </div>

          {/* Main guidance line */}
          {showStatus && statusGuidance && (
            <p
              className={cn(
                "text-sm mt-0.5",
                statusGuidance.variant === "warning"
                  ? "text-amber-700"
                  : statusGuidance.variant === "muted"
                    ? "text-slate-500"
                    : "text-slate-700",
              )}
            >
              {statusGuidance.message}
            </p>
          )}
          {showPhase && phaseGuidance && (
            <p className={cn("text-sm font-medium mt-0.5", meta.color)}>
              {phaseGuidance.action}
            </p>
          )}
        </div>

        {/* Expand/collapse if we have tips */}
        {showPhase && phaseGuidance && phaseGuidance.tips.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              meta.color,
              "hover:bg-black/5",
            )}
          >
            {expanded ? "Less" : "Guide"}
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* ── Speaker restriction alert ── */}
      {speakerWarning && (
        <div className="mt-2 flex items-center gap-1.5 rounded bg-amber-100 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{speakerWarning}</span>
        </div>
      )}

      {/* ── Expanded detail + tips ── */}
      {expanded && showPhase && phaseGuidance && (
        <div className="mt-2.5 space-y-2 border-t border-black/5 pt-2.5">
          <p className="text-xs text-slate-600">{phaseGuidance.detail}</p>
          {phaseGuidance.tips.length > 0 && (
            <ul className="space-y-1">
              {phaseGuidance.tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-xs text-slate-600"
                >
                  <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
