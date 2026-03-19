import React, { memo } from "react";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/shared/components/ui/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import { sectionCardClass } from "./constants";
import type { HearingParticipantConfirmationSummary as ConfSummary } from "@/features/hearings/types";

const STATUS_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
  }
> = {
  ACCEPTED: { icon: CheckCircle, color: "text-emerald-600", label: "Accepted" },
  DECLINED: { icon: XCircle, color: "text-rose-600", label: "Declined" },
  TENTATIVE: {
    icon: AlertTriangle,
    color: "text-amber-600",
    label: "Tentative",
  },
  PENDING: { icon: Clock, color: "text-slate-400", label: "Pending" },
  NO_RESPONSE: { icon: Clock, color: "text-slate-300", label: "No response" },
};

interface ConfirmationSummaryProps {
  summary: ConfSummary | null | undefined;
}

export const ConfirmationSummary = memo(function ConfirmationSummary({
  summary,
}: ConfirmationSummaryProps) {
  if (!summary) return null;

  const {
    totalParticipants,
    accepted,
    declined,
    tentative,
    pending,
    confirmationSatisfied,
    hasModeratorAccepted,
    primaryPartyAcceptedCount,
    primaryPartyPendingCount,
    participants,
  } = summary;

  return (
    <div className={cn(sectionCardClass, "space-y-3")}>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Confirmation Status
      </h4>

      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5" />
          {accepted}
        </span>
        <span className="inline-flex items-center gap-1 text-rose-600">
          <XCircle className="h-3.5 w-3.5" />
          {declined}
        </span>
        <span className="inline-flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {tentative}
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {pending}
        </span>
        <span className="ml-auto text-slate-400">
          {accepted}/{totalParticipants}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full">
          {accepted > 0 && (
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(accepted / totalParticipants) * 100}%` }}
            />
          )}
          {tentative > 0 && (
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${(tentative / totalParticipants) * 100}%` }}
            />
          )}
          {declined > 0 && (
            <div
              className="bg-rose-400 transition-all"
              style={{ width: `${(declined / totalParticipants) * 100}%` }}
            />
          )}
        </div>
      </div>

      <div
        className={cn(
          "rounded-md border px-2.5 py-1.5 text-center text-xs font-medium",
          confirmationSatisfied
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700",
        )}
      >
        {confirmationSatisfied
          ? "Moderator and at least one primary side confirmed"
          : `Waiting for moderator + primary party confirmation (${primaryPartyAcceptedCount} accepted, ${primaryPartyPendingCount} pending)`}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
          Moderator: {hasModeratorAccepted ? "confirmed" : "pending"}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
          Primary sides: {primaryPartyAcceptedCount} accepted
        </div>
      </div>

      {participants.length > 0 && (
        <div className="space-y-1">
          {participants.map((participant) => {
            const cfg = STATUS_CONFIG[participant.status] ?? STATUS_CONFIG.PENDING;
            const Icon = cfg.icon;
            return (
              <Tooltip key={participant.userId}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-slate-50">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                    <span className="truncate text-slate-700">
                      {participant.caseRole ? `${participant.caseRole} ÅE ` : ""}
                      {participant.userId.slice(0, 8)}...
                    </span>
                    <span className="ml-auto text-slate-400 capitalize">
                      {participant.role.toLowerCase()}
                    </span>
                    {participant.isRequired && (
                      <span className="shrink-0 rounded bg-slate-200 px-1 py-0.5 text-xs font-medium text-slate-600">
                        REQ
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {cfg.label}
                  {participant.respondedAt
                    ? ` ÅE ${new Date(participant.respondedAt).toLocaleString()}`
                    : ""}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
});
