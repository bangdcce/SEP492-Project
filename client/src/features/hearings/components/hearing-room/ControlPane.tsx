import { memo, useRef, useState, type ChangeEvent } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { cn } from "@/shared/components/ui/utils";
import { Upload } from "lucide-react";
import { cardClass } from "./constants";
import { ParticipantList } from "./ParticipantList";
import { PhaseControlPanel } from "./PhaseControlPanel";
import { SpeakerControlPanel } from "./SpeakerControlPanel";
import { EvidenceIntakePanel } from "./EvidenceIntakePanel";
import { AttendanceStats } from "./AttendanceStats";
import { AttendanceDetailView } from "./AttendanceDetailView";
import { ConfirmationSummary } from "./ConfirmationSummary";
import { EvidenceGallery } from "./EvidenceGallery";
import type {
  HearingAttendanceSummary,
  HearingParticipantConfirmationSummary,
  HearingParticipantSummary,
  HearingPhaseGateStatus,
  SpeakerRole,
} from "@/features/hearings/types";
import type { DisputeEvidence } from "@/features/disputes/types/dispute.types";

type ControlTab = "participants" | "evidence";

interface ControlPaneProps {
  participants: HearingParticipantSummary[];
  evidence: DisputeEvidence[];
  currentSpeakerRole: SpeakerRole | null | undefined;
  hearingStatus: string | null | undefined;
  canModerate: boolean;
  speakerUpdating: boolean;
  onUpdateSpeakerControl: (role: SpeakerRole) => Promise<void>;

  /* evidence intake */
  evidenceIntakeOpen: boolean;
  evidenceIntakeReason?: string | null;
  canManageIntake: boolean;
  intakeBlockedReason?: string | null;
  intakeUpdating: boolean;
  onOpenIntake: (reason: string) => Promise<void>;
  onCloseIntake: () => Promise<void>;

  /* attendance */
  attendance: HearingAttendanceSummary | null | undefined;

  /* evidence gallery */
  previewEvidenceId: string | null;
  onSelectEvidence: (id: string) => void;

  /* standalone evidence upload */
  canUploadEvidence: boolean;
  evidenceUploading: boolean;
  onUploadFile: (event: ChangeEvent<HTMLInputElement>) => void;

  /* phase control */
  phaseSequence?: string[];
  currentPhase?: string;
  currentStep?: number;
  phaseGate?: HearingPhaseGateStatus | null;
  onTransitionPhase?: (phase: string) => Promise<void>;

  /* confirmation summary */
  confirmationSummary?: HearingParticipantConfirmationSummary | null;

  /* dispute context */
  disputeId?: string;
}

export const ControlPane = memo(function ControlPane(props: ControlPaneProps) {
  const [tab, setTab] = useState<ControlTab>("participants");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn(cardClass, "p-4")}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as ControlTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>

        <TabsContent
          value="participants"
          className="mt-3 space-y-3 max-h-[70vh] overflow-y-auto pr-1"
        >
          <ParticipantList
            participants={props.participants}
            currentSpeakerRole={props.currentSpeakerRole}
            confirmationSummary={props.confirmationSummary}
          />

          {/* Phase control  Evisible to all, editable by moderators */}
          {props.phaseSequence &&
            props.phaseSequence.length > 0 &&
            props.onTransitionPhase && (
              <PhaseControlPanel
                phaseSequence={props.phaseSequence}
                currentPhase={props.currentPhase ?? props.phaseSequence[0]}
                currentStep={props.currentStep ?? 0}
                gate={props.phaseGate}
                canModerate={props.canModerate}
                hearingStatus={props.hearingStatus}
                onTransitionPhase={props.onTransitionPhase}
              />
            )}

          {/* Speaker & intake  Emoderators control, others view status */}
          <SpeakerControlPanel
            currentSpeakerRole={props.currentSpeakerRole}
            hearingStatus={props.hearingStatus ?? undefined}
            canModerate={props.canModerate}
            updating={props.speakerUpdating}
            onUpdateSpeakerControl={props.onUpdateSpeakerControl}
          />

          <EvidenceIntakePanel
            isOpen={props.evidenceIntakeOpen}
            reason={props.evidenceIntakeReason}
            canManageIntake={props.canManageIntake}
            blockedReason={props.intakeBlockedReason}
            intakeUpdating={props.intakeUpdating}
            onOpenIntake={props.onOpenIntake}
            onCloseIntake={props.onCloseIntake}
          />

          <AttendanceStats attendance={props.attendance} />

          <AttendanceDetailView attendance={props.attendance} />

          <ConfirmationSummary summary={props.confirmationSummary} />

          {/* View-only notice for non-moderators */}
          {!props.canModerate && (
            <p className="text-center text-xs text-slate-400 italic pt-2">
              Moderator controls are read-only for your role.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="evidence"
          className="mt-3 max-h-[70vh] overflow-y-auto pr-1 space-y-3"
        >
          {/* Upload button */}
          {props.canUploadEvidence && (
            <div>
              <button
                disabled={props.evidenceUploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {props.evidenceUploading ? "Uploading…" : "Upload Evidence"}
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={props.onUploadFile}
              />
            </div>
          )}

          <p className="text-xs text-slate-400 mb-2">
            Click to preview in centre stage.
          </p>
          <EvidenceGallery
            evidence={props.evidence}
            previewEvidenceId={props.previewEvidenceId}
            onSelectEvidence={props.onSelectEvidence}
            disputeId={props.disputeId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});
