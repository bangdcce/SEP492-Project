import React, { memo } from "react";
import { Users, Mic, MicOff, Clock } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/components/ui/utils";
import {
  roleBadgeClass,
  avatarBgClass,
  getInitials,
  roleLabel,
  panelTitleClass,
  relativeTime,
} from "./constants";
import type {
  HearingParticipantSummary,
  SpeakerRole,
} from "@/features/hearings/types";

interface ParticipantListProps {
  participants: HearingParticipantSummary[] | undefined;
  currentSpeakerRole?: SpeakerRole | null;
}

/** Determine if a participant can speak given the current floor mode */
const canSpeak = (
  participantRole: string,
  speakerRole?: SpeakerRole | null,
): boolean => {
  if (!speakerRole || speakerRole === "MUTED_ALL") return false;
  if (speakerRole === "ALL") return true;
  if (speakerRole === "MODERATOR_ONLY") return participantRole === "MODERATOR";
  if (speakerRole === "RAISER_ONLY")
    return participantRole === "RAISER" || participantRole === "MODERATOR";
  if (speakerRole === "DEFENDANT_ONLY")
    return participantRole === "DEFENDANT" || participantRole === "MODERATOR";
  return false;
};

export const ParticipantList = memo(function ParticipantList({
  participants,
  currentSpeakerRole,
}: ParticipantListProps) {
  if (!participants?.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-500" />
        <p className={panelTitleClass}>Participants</p>
        <span className="ml-auto text-xs text-slate-400">
          {participants.length}
        </span>
      </div>

      <div className="space-y-1">
        {participants.map((p) => {
          const name = p.user?.fullName || p.user?.email || p.userId;
          const speaking = canSpeak(p.role, currentSpeakerRole);
          return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                p.isOnline
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50/50",
              )}
            >
              {/* Avatar with online dot */}
              <div className="relative shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      avatarBgClass(p.role),
                    )}
                  >
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                {/* Online status dot */}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                    p.isOnline ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
                {p.isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
                )}
              </div>

              {/* Name + role */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-medium truncate",
                      p.isOnline ? "text-slate-900" : "text-slate-500",
                    )}
                  >
                    {name}
                  </span>
                  {p.isRequired && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-rose-500 text-xs font-bold">
                          *
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Required participant</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Badge
                  className={cn(
                    roleBadgeClass(p.role),
                    "text-xs px-1.5 py-0 mt-0.5",
                  )}
                >
                  {roleLabel(p.role)}
                </Badge>
                {/* Online duration or last seen */}
                {p.isOnline &&
                  p.totalOnlineMinutes != null &&
                  p.totalOnlineMinutes > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-emerald-600 mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {p.totalOnlineMinutes}m online
                    </span>
                  )}
                {!p.isOnline && p.leftAt && (
                  <span className="text-xs text-slate-400 mt-0.5">
                    Left {relativeTime(p.leftAt)}
                  </span>
                )}
              </div>

              {/* Speaking indicator */}
              {p.isOnline && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0">
                      {speaking ? (
                        <Mic className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <MicOff className="h-4 w-4 text-slate-300" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {speaking
                      ? "Can speak (floor is open)"
                      : "Muted by floor mode"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
