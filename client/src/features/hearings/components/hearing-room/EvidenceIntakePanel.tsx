import { memo, useState } from "react";
import { DoorOpen, DoorClosed, AlertCircle } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/components/ui/utils";
import { sectionCardClass, panelTitleClass } from "./constants";

interface EvidenceIntakePanelProps {
  isOpen: boolean;
  reason?: string | null;
  canManageIntake: boolean;
  blockedReason?: string | null;
  intakeUpdating: boolean;
  onOpenIntake: (reason: string) => Promise<void>;
  onCloseIntake: () => Promise<void>;
}

export const EvidenceIntakePanel = memo(function EvidenceIntakePanel({
  isOpen,
  reason,
  canManageIntake,
  blockedReason,
  intakeUpdating,
  onOpenIntake,
  onCloseIntake,
}: EvidenceIntakePanelProps) {
  const [intakeReason, setIntakeReason] = useState("");

  const handleOpen = async () => {
    if (!intakeReason.trim()) return;
    await onOpenIntake(intakeReason.trim());
    setIntakeReason("");
  };

  return (
    <div className={sectionCardClass}>
      <div className="flex items-center justify-between">
        <p className={cn(panelTitleClass, "text-xs")}>Evidence intake</p>
        <Badge
          className={cn(
            "text-xs",
            isOpen
              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
              : "border-slate-300 bg-slate-100 text-slate-600",
          )}
        >
          {isOpen ? (
            <span className="inline-flex items-center gap-1">
              <DoorOpen className="h-3 w-3" /> OPEN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <DoorClosed className="h-3 w-3" /> CLOSED
            </span>
          )}
        </Badge>
      </div>

      {reason && (
        <p className="text-xs text-slate-500 mt-1">Reason: {reason}</p>
      )}

      {canManageIntake ? (
        isOpen ? (
          <button
            onClick={() => void onCloseIntake()}
            disabled={intakeUpdating}
            className="mt-2 h-8 w-full rounded-lg bg-slate-800 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {intakeUpdating ? "Closing..." : "Close intake"}
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            <Textarea
              value={intakeReason}
              onChange={(e) => setIntakeReason(e.target.value)}
              rows={2}
              placeholder="Reason to re-open evidence intake..."
              className="text-xs resize-none"
            />
            <button
              onClick={() => void handleOpen()}
              disabled={intakeUpdating || !intakeReason.trim()}
              className="h-8 w-full rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {intakeUpdating ? "Opening..." : "Open intake"}
            </button>
          </div>
        )
      ) : (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
          <AlertCircle className="h-3 w-3" />
          {blockedReason || "Not allowed"}
        </p>
      )}
    </div>
  );
});
