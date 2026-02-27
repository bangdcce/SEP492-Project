import React, { memo } from "react";
import {
  Gavel,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  X,
  Clock,
  Wifi,
  WifiOff,
  UserPlus,
  CalendarClock,
} from "lucide-react";
import { ExportTranscriptButton } from "./ExportTranscriptButton";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/components/ui/utils";
import {
  hearingStatusBadgeClass,
  roleBadgeClass,
  roleLabel,
} from "./constants";
import type { HearingWorkspaceSummary } from "@/features/hearings/types";

interface HearingHeaderProps {
  workspace: HearingWorkspaceSummary | null;
  countdown: string;
  statusLabel: string;
  currentParticipantRole?: string | null;
  canModerate: boolean;
  dossierCollapsed: boolean;
  /** realtime connection alive? */
  isConnected?: boolean;
  /** 0 E00 elapsed time as percentage of total duration */
  elapsedPercent?: number;

  pauseUpdating: boolean;
  resumeUpdating: boolean;
  ending: boolean;

  onRefresh: () => void;
  onToggleDossier: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onExtend?: () => void;
  onStart?: () => void;
  onInviteSupport?: () => void;
  onReschedule?: () => void;
}

export const HearingHeader = memo(function HearingHeader({
  workspace,
  countdown,
  statusLabel,
  currentParticipantRole,
  canModerate,
  dossierCollapsed,
  isConnected = true,
  elapsedPercent = 0,
  pauseUpdating,
  resumeUpdating,
  ending,
  onRefresh,
  onToggleDossier,
  onPause,
  onResume,
  onEnd,
  onExtend,
  onStart,
  onInviteSupport,
  onReschedule,
}: HearingHeaderProps) {
  const hearing = workspace?.hearing;
  const projectTitle = workspace?.dossier?.project?.title || "Untitled project";
  const phase = workspace?.phase;
  const progressPercent = phase?.progressPercent ?? 0;

  return (
    <div className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900 px-5 py-3 shadow-lg">
      {/* Row 1: Status badges + Title */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                hearingStatusBadgeClass(hearing?.status),
                "text-xs font-bold uppercase tracking-wider",
              )}
            >
              {statusLabel === "LIVE" && (
                <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
              )}
              {statusLabel}
            </Badge>
            <Badge className="border-slate-600 bg-slate-700 text-sm font-mono text-amber-300">
              {countdown}
            </Badge>
            {hearing?.tier && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      hearing.tier === "TIER_2"
                        ? "border-amber-400 bg-amber-900/60 text-amber-200"
                        : "border-slate-500 bg-slate-700 text-slate-300",
                    )}
                  >
                    {hearing.tier === "TIER_2" ? "⭁ETier 2" : "Tier 1"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {hearing.tier === "TIER_2"
                    ? "Escalated hearing  Eformal proceedings with extended rights"
                    : "Standard hearing  Einitial dispute resolution"}
                </TooltipContent>
              </Tooltip>
            )}
            {currentParticipantRole && (
              <Badge
                className={cn(
                  roleBadgeClass(currentParticipantRole),
                  "text-xs",
                )}
              >
                You: {roleLabel(currentParticipantRole)}
              </Badge>
            )}
            {/* Connection indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center">
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-rose-400 animate-pulse" />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isConnected
                  ? "Realtime connected"
                  : "Connection lost  Ereconnecting…"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Title line */}
          <div className="flex items-center gap-2 text-sm">
            <Gavel className="h-4 w-4 text-amber-400" />
            <span className="font-semibold text-white">{projectTitle}</span>
            <span className="text-slate-400">
               EHearing #{hearing?.hearingNumber ?? "N/A"}
            </span>
          </div>

          {/* Phase progress */}
          {phase && progressPercent > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                Phase: {phase.currentStep ?? 0}/{phase.totalSteps ?? 0}
              </span>
              <Progress
                value={progressPercent}
                className="h-1.5 w-28 bg-slate-700 *:data-[slot=progress-indicator]:bg-amber-400"
              />
              <span className="text-xs text-amber-300">{progressPercent}%</span>
            </div>
          )}

          {/* Time progress bar  Eelapsed / total duration */}
          {(statusLabel === "LIVE" || statusLabel === "PAUSED") && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">
                Time:
              </span>
              <Progress
                value={Math.min(elapsedPercent, 100)}
                className={cn(
                  "h-2 flex-1 max-w-48 bg-slate-700",
                  elapsedPercent > 100
                    ? "*:data-[slot=progress-indicator]:bg-rose-500"
                    : elapsedPercent > 80
                      ? "*:data-[slot=progress-indicator]:bg-amber-400"
                      : "*:data-[slot=progress-indicator]:bg-emerald-400",
                )}
              />
              <span
                className={cn(
                  "text-xs font-mono",
                  elapsedPercent > 100
                    ? "text-rose-400"
                    : elapsedPercent > 80
                      ? "text-amber-300"
                      : "text-emerald-300",
                )}
              >
                {elapsedPercent > 100
                  ? "Overtime"
                  : `${elapsedPercent}% elapsed`}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons  Egrouped */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Utility group */}
          <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRefresh}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  aria-label="Refresh workspace"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Reload hearing workspace</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleDossier}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  aria-label={
                    dossierCollapsed ? "Show dossier" : "Hide dossier"
                  }
                >
                  {dossierCollapsed ? (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {dossierCollapsed ? "Dossier" : "Hide"}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {dossierCollapsed ? "Show dossier panel" : "Hide dossier panel"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Moderation group */}
          {canModerate && (
            <div className="flex items-center gap-1.5">
              {hearing?.status === "SCHEDULED" && onStart && (
                <button
                  onClick={onStart}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                  aria-label="Start hearing session"
                >
                  <Play className="h-3.5 w-3.5" />
                  Start Session
                </button>
              )}
              {hearing?.status === "IN_PROGRESS" && (
                <button
                  onClick={onPause}
                  disabled={pauseUpdating}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  aria-label="Pause hearing"
                >
                  <Pause className="h-3.5 w-3.5" />
                  {pauseUpdating ? "Pausing…" : "Pause"}
                </button>
              )}
              {hearing?.status === "PAUSED" && (
                <button
                  onClick={onResume}
                  disabled={resumeUpdating}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  aria-label="Resume hearing"
                >
                  <Play className="h-3.5 w-3.5" />
                  {resumeUpdating ? "Resuming…" : "Resume"}
                </button>
              )}
              {/* Extend Duration */}
              {["IN_PROGRESS", "PAUSED"].includes(hearing?.status || "") &&
                onExtend && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onExtend}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        aria-label="Extend hearing duration"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Extend</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Extend hearing duration</TooltipContent>
                  </Tooltip>
                )}
              {["IN_PROGRESS", "PAUSED"].includes(hearing?.status || "") && (
                <button
                  onClick={onEnd}
                  disabled={ending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
                  aria-label="End hearing"
                >
                  <X className="h-3.5 w-3.5" />
                  {ending ? "Ending…" : "End"}
                </button>
              )}
              {onInviteSupport && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onInviteSupport}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      aria-label="Invite support staff"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Invite</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Invite support staff to the hearing
                  </TooltipContent>
                </Tooltip>
              )}
              {onReschedule && hearing?.status === "SCHEDULED" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onReschedule}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      aria-label="Reschedule hearing"
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Reschedule</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Reschedule this hearing</TooltipContent>
                </Tooltip>
              )}
              <ExportTranscriptButton
                hearing={hearing}
                messages={workspace?.messages ?? []}
                statements={workspace?.statements ?? []}
                questions={workspace?.questions ?? []}
              />
            </div>
          )}

          {/* Export transcript  Eavailable to all participants */}
          {!canModerate && (
            <ExportTranscriptButton
              hearing={hearing}
              messages={workspace?.messages ?? []}
              statements={workspace?.statements ?? []}
              questions={workspace?.questions ?? []}
            />
          )}
        </div>
      </div>
    </div>
  );
});
