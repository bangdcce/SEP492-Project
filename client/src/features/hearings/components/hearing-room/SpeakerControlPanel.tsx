import React, { memo, useState } from "react";
import {
  Mic,
  MicOff,
  Gavel,
  User,
  Shield,
  Eye,
  Scale,
  Volume2,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/shared/components/ui/utils";
import { speakerLabel, speakerDescription, panelTitleClass } from "./constants";
import type { SpeakerRole } from "@/features/hearings/types";

interface SpeakerControlPanelProps {
  currentSpeakerRole?: SpeakerRole | null;
  hearingStatus?: string;
  canModerate: boolean;
  updating: boolean;
  onUpdateSpeakerControl: (role: SpeakerRole) => void;
}

const speakerIcons: Record<SpeakerRole, React.ReactNode> = {
  ALL: <Mic className="h-4 w-4" />,
  MODERATOR_ONLY: <Gavel className="h-4 w-4" />,
  RAISER_ONLY: <User className="h-4 w-4" />,
  DEFENDANT_ONLY: <Shield className="h-4 w-4" />,
  WITNESS_ONLY: <Scale className="h-4 w-4" />,
  OBSERVER_ONLY: <Eye className="h-4 w-4" />,
  MUTED_ALL: <MicOff className="h-4 w-4" />,
};

const ROLES: SpeakerRole[] = [
  "ALL",
  "MODERATOR_ONLY",
  "RAISER_ONLY",
  "DEFENDANT_ONLY",
  "WITNESS_ONLY",
  "OBSERVER_ONLY",
  "MUTED_ALL",
];

export const SpeakerControlPanel = memo(function SpeakerControlPanel({
  currentSpeakerRole,
  hearingStatus,
  canModerate,
  updating,
  onUpdateSpeakerControl,
}: SpeakerControlPanelProps) {
  const [confirmMute, setConfirmMute] = useState(false);

  const handleSelect = (role: SpeakerRole) => {
    // Muting all requires confirmation
    if (role === "MUTED_ALL") {
      setConfirmMute(true);
      return;
    }
    onUpdateSpeakerControl(role);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-slate-500" />
        <p className={panelTitleClass}>Speaker control</p>
      </div>

      {canModerate ? (
        <div className="space-y-1">
          {ROLES.map((role) => {
            const isActive = currentSpeakerRole === role;
            return (
              <Tooltip key={role}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSelect(role)}
                    disabled={updating || hearingStatus !== "IN_PROGRESS"}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-sm text-left transition-all",
                      isActive
                        ? "border-slate-800 bg-slate-800 text-white shadow-sm"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                    aria-label={speakerLabel(role)}
                  >
                    <span
                      className={cn(
                        "shrink-0",
                        isActive ? "text-amber-300" : "text-slate-400",
                      )}
                    >
                      {speakerIcons[role]}
                    </span>
                    <span className="flex-1 font-medium">
                      {speakerLabel(role)}
                    </span>
                    {isActive && (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-50">
                  {speakerDescription(role)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Only the moderator or admin can control the floor.
        </p>
      )}

      {/* Mute confirmation dialog */}
      <AlertDialog open={confirmMute} onOpenChange={setConfirmMute}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Mute all participants?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent <strong>all participants</strong> from sending
              messages. Only the moderator can change the floor mode back. Are
              you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onUpdateSpeakerControl("MUTED_ALL");
                setConfirmMute(false);
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Mute all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
