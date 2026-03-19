import React, { memo, useMemo } from "react";
import { Link } from "react-router-dom";
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
  HearingParticipantConfirmationSummary,
  HearingParticipantSummary,
  SpeakerRole,
} from "@/features/hearings/types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { resolveProfileViewerBasePath } from "@/features/hearings/utils/hearingRouting";

interface ParticipantListProps {
  participants: HearingParticipantSummary[] | undefined;
  currentSpeakerRole?: SpeakerRole | null;
  confirmationSummary?: HearingParticipantConfirmationSummary | null;
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
  confirmationSummary,
}: ParticipantListProps) {
  if (!participants?.length) return null;

  const currentUser = getStoredJson<{ role?: string }>(STORAGE_KEYS.USER);
  const profileBasePath = resolveProfileViewerBasePath(currentUser?.role);
  const confirmationByUserId = useMemo(
    () =>
      new Map(
        (confirmationSummary?.participants ?? []).map((participant) => [
          participant.userId,
          participant.status,
        ]),
      ),
    [confirmationSummary?.participants],
  );

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
          const responseStatus =
            confirmationByUserId.get(p.userId) || (p.confirmedAt ? "ACCEPTED" : undefined);
          const profileLink = profileBasePath
            ? `${profileBasePath}/discovery/profile/${p.user?.id || p.userId}`
            : null;
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
                  {profileLink ? (
                    <Link
                      to={profileLink}
                      className={cn(
                        "text-sm font-medium truncate hover:underline",
                        p.isOnline ? "text-slate-900" : "text-slate-500",
                      )}
                    >
                      {name}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        p.isOnline ? "text-slate-900" : "text-slate-500",
                      )}
                    >
                      {name}
                    </span>
                  )}
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
                {responseStatus ? (
                  <Badge
                    className={cn(
                      "ml-1 mt-0.5 text-xs px-1.5 py-0 border",
                      responseStatus === "ACCEPTED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : responseStatus === "DECLINED"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : responseStatus === "TENTATIVE"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-100 text-slate-600",
                    )}
                  >
                    {responseStatus === "NO_RESPONSE"
                      ? "Pending reply"
                      : responseStatus.replace(/_/g, " ")}
                  </Badge>
                ) : null}
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
                {!p.confirmedAt && p.invitedAt && (
                  <span className="block text-xs text-slate-400 mt-0.5">
                    Invited {relativeTime(p.invitedAt)}
                  </span>
                )}
                {p.declineReason ? (
                  <span className="block text-xs text-rose-600 mt-0.5 line-clamp-2">
                    Decline reason: {p.declineReason}
                  </span>
                ) : null}
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
