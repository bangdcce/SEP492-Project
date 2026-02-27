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

/* ─── Status icon mapping ─── */

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

/* ─── Props ─── */

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
    allRequiredAccepted,
    participants,
  } = summary;

  return (
    <div className={cn(sectionCardClass, "space-y-3")}>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Confirmation Status
      </h4>

      {/* Summary bar */}
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

      {/* Progress bar */}
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

      {/* Status label */}
      <div
        className={cn(
          "rounded-md px-2.5 py-1.5 text-xs font-medium text-center",
          allRequiredAccepted
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-amber-50 text-amber-700 border border-amber-200",
        )}
      >
        {allRequiredAccepted
          ? "All required participants confirmed"
          : "Awaiting required confirmations"}
      </div>

      {/* Individual participants */}
      {participants.length > 0 && (
        <div className="space-y-1">
          {participants.map((p) => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.PENDING;
            const Icon = cfg.icon;
            return (
              <Tooltip key={p.userId}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-slate-50 transition-colors">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                    <span className="truncate text-slate-700">
                      {p.userId.slice(0, 8)}…
                    </span>
                    <span className="ml-auto text-slate-400 capitalize">
                      {p.role.toLowerCase()}
                    </span>
                    {p.isRequired && (
                      <span className="shrink-0 rounded bg-slate-200 px-1 py-0.5 text-xs font-medium text-slate-600">
                        REQ
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {cfg.label}
                  {p.respondedAt
                    ? ` · ${new Date(p.respondedAt).toLocaleString()}`
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
