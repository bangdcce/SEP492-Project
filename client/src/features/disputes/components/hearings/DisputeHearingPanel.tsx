import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  endHearing,
  dispatchHearingReminders,
  getHearingsByDispute,
  rescheduleHearing,
  scheduleHearing,
  startHearing,
} from "@/features/hearings/api";
import {
  completeDisputePreview,
  getDisputeDetail,
  getDisputeAutoScheduleOptions,
  triggerDisputeAutoSchedule,
} from "@/features/disputes/api";
import type {
  DisputeHearingSummary,
  HearingParticipantConfirmationSummary,
  HearingStatus,
  SpeakerRole,
} from "@/features/hearings/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { STORAGE_KEYS } from "@/constants";
import { DisputeStatus, UserRole } from "@/features/staff/types/staff.types";
import { getStoredJson } from "@/shared/utils/storage";
import {
  getApiErrorDetails,
  isSchemaNotReadyErrorCode,
} from "@/shared/utils/apiError";

interface DisputeHearingPanelProps {
  disputeId: string;
  refreshToken?: number;
}

export const DisputeHearingPanel = ({
  disputeId,
  refreshToken,
}: DisputeHearingPanelProps) => {
  const [hearings, setHearings] = useState<DisputeHearingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [agenda, setAgenda] = useState("");
  const [requiredDocs, setRequiredDocs] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleHearingTarget, setRescheduleHearingTarget] =
    useState<DisputeHearingSummary | null>(null);
  const [rescheduleDuration, setRescheduleDuration] = useState(60);
  const [rescheduleAgenda, setRescheduleAgenda] = useState("");
  const [rescheduleDocs, setRescheduleDocs] = useState("");

  const [endOpen, setEndOpen] = useState(false);
  const [endHearingTarget, setEndHearingTarget] =
    useState<DisputeHearingSummary | null>(null);
  const [endSummary, setEndSummary] = useState("");
  const [endFindings, setEndFindings] = useState("");
  const [endPendingActions, setEndPendingActions] = useState("");
  const [testActionLoading, setTestActionLoading] = useState<string | null>(null);
  const [testScheduleHint, setTestScheduleHint] = useState<string>("");
  const [schemaErrorMessage, setSchemaErrorMessage] = useState<string | null>(
    null,
  );
  const schemaToastShownRef = useRef(false);
  const navigate = useNavigate();

  const loadHearings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHearingsByDispute(disputeId);
      setHearings(data ?? []);
      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
    } catch (error) {
      const details = getApiErrorDetails(error, "Could not load hearings.");
      console.error("Failed to load hearings:", error);
      if (isSchemaNotReadyErrorCode(details.code)) {
        setSchemaErrorMessage(details.message);
        if (!schemaToastShownRef.current) {
          toast.error(details.message);
          schemaToastShownRef.current = true;
        }
        return;
      }
      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
      toast.error(details.code ? `[${details.code}] ${details.message}` : details.message);
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    loadHearings();
  }, [loadHearings, refreshToken]);

  const currentUser = useMemo(() => {
    return getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER);
  }, []);
  const currentUserRole = currentUser?.role ?? null;

  const canManageSchedule = currentUserRole === UserRole.ADMIN;
  const canModerate =
    currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;
  const isDisputeTestToolsEnabled = useMemo(() => {
    const raw = (import.meta.env.VITE_DISPUTE_TEST_TOOLS || "").toLowerCase();
    return import.meta.env.DEV || raw === "true" || raw === "1";
  }, []);
  const canUseTestTools = isDisputeTestToolsEnabled && canModerate;

  const toIsoString = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString();
  };

  const handleSchedule = async () => {
    if (!scheduleAt) {
      toast.error("Select a hearing time.");
      return;
    }

    try {
      setScheduleLoading(true);
      const result = await scheduleHearing({
        disputeId,
        scheduledAt: toIsoString(scheduleAt),
        estimatedDurationMinutes: duration,
        agenda: agenda.trim() || undefined,
        requiredDocuments: requiredDocs
          ? requiredDocs.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
        externalMeetingLink: undefined,
        isEmergency,
      });
      if (result.manualRequired) {
        toast.error(
          result.reason || "No feasible slot found. Manual scheduling is required.",
        );
      } else {
        toast.success("Hearing scheduled.");
      }
      setScheduleAt("");
      setAgenda("");
      setRequiredDocs("");
      setIsEmergency(false);
      await loadHearings();
    } catch (error) {
      console.error("Failed to schedule hearing:", error);
      toast.error("Could not schedule hearing.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const hearingTimeRange = (hearing: DisputeHearingSummary) => {
    const start = new Date(hearing.scheduledAt);
    const duration = hearing.estimatedDurationMinutes ?? 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return { start, end };
  };

  const handleOpenRoom = (hearingId: string) => {
    navigate(`/staff/hearings/${hearingId}`);
  };

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Invalid";
    return format(parsed, "MMM d, yyyy h:mm a");
  };

  const formatScheduledRange = (hearing: DisputeHearingSummary) => {
    const { start, end } = hearingTimeRange(hearing);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Invalid schedule";
    }
    return `${format(start, "MMM d, yyyy h:mm a")} - ${format(end, "h:mm a")}`;
  };

  const speakerLabel = (role?: SpeakerRole | null) => {
    switch (role) {
      case "ALL":
        return "All participants";
      case "MODERATOR_ONLY":
        return "Moderator only";
      case "RAISER_ONLY":
        return "Raiser only";
      case "DEFENDANT_ONLY":
        return "Defendant only";
      case "MUTED_ALL":
        return "Muted";
      default:
        return "Not set";
    }
  };

  const confirmationSummaryLabel = (
    summary?: HearingParticipantConfirmationSummary,
  ) => {
    if (!summary) return "No confirmation data";
    if (summary.allRequiredAccepted) {
      return "All required participants confirmed";
    }
    return `${summary.requiredAccepted}/${summary.requiredParticipants} required confirmed`;
  };

  const handleStart = async (hearing: DisputeHearingSummary) => {
    if (hearing.status !== "SCHEDULED") return;

    try {
      setActionLoadingId(hearing.id);
      await startHearing(hearing.id);
      toast.success("Hearing started.");
      await loadHearings();
    } catch (error) {
      console.error("Failed to start hearing:", error);
      toast.error("Could not start hearing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRescheduleOpen = (hearing: DisputeHearingSummary) => {
    setRescheduleHearingTarget(hearing);
    setRescheduleAt("");
    setRescheduleDuration(hearing.estimatedDurationMinutes ?? 60);
    setRescheduleAgenda(hearing.agenda ?? "");
    setRescheduleDocs(hearing.requiredDocuments?.join(", ") ?? "");
    setRescheduleOpen(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleHearingTarget) return;
    if (!rescheduleAt) {
      toast.error("Select a new time.");
      return;
    }

    try {
      setActionLoadingId(rescheduleHearingTarget.id);
      const result = await rescheduleHearing(rescheduleHearingTarget.id, {
        hearingId: rescheduleHearingTarget.id,
        scheduledAt: toIsoString(rescheduleAt),
        estimatedDurationMinutes: rescheduleDuration,
        agenda: rescheduleAgenda.trim() || undefined,
        requiredDocuments: rescheduleDocs
          ? rescheduleDocs.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
        externalMeetingLink: undefined,
      });
      if (result.manualRequired) {
        toast.error(
          result.reason || "No feasible slot found. Manual scheduling is required.",
        );
      } else {
        toast.success("Hearing rescheduled.");
      }
      setRescheduleOpen(false);
      await loadHearings();
    } catch (error) {
      console.error("Failed to reschedule hearing:", error);
      toast.error("Could not reschedule hearing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEndOpen = (hearing: DisputeHearingSummary) => {
    setEndHearingTarget(hearing);
    setEndSummary("");
    setEndFindings("");
    setEndPendingActions("");
    setEndOpen(true);
  };

  const handleEndSubmit = async () => {
    if (!endHearingTarget) return;
    const summary = endSummary.trim();
    const findings = endFindings.trim();
    if (!summary || !findings) {
      toast.error("Summary and findings are required to end hearing.");
      return;
    }

    try {
      setActionLoadingId(endHearingTarget.id);
      await endHearing(endHearingTarget.id, {
        hearingId: endHearingTarget.id,
        summary,
        findings,
        pendingActions: endPendingActions
          ? endPendingActions.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      });
      toast.success("Hearing ended.");
      setEndOpen(false);
      await loadHearings();
    } catch (error) {
      console.error("Failed to end hearing:", error);
      toast.error("Could not end hearing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusBadge = (status: HearingStatus) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "SCHEDULED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "RESCHEDULED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "CANCELED":
        return "bg-red-50 text-red-700 border-red-200";
      case "COMPLETED":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const sortedHearings = useMemo(() => {
    return [...hearings].sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }, [hearings]);

  const handleRunAutoScheduleTest = useCallback(async () => {
    try {
      setTestActionLoading("autoschedule");
      setTestScheduleHint("");
      const result = await triggerDisputeAutoSchedule(disputeId, {
        minNoticeMinutes: 5,
        lookaheadDays: 2,
        forceNearTermMinutes: 5,
        bypassReason: "UI test quick auto-schedule",
      });
      if (result.manualRequired) {
        toast.warning(result.reason || "No slot found. Manual scheduling required.");
      } else {
        toast.success("Auto-schedule test completed.");
      }
      const selectedSlot = result.selectedSlot;
      if (selectedSlot?.start && selectedSlot?.end) {
        setTestScheduleHint(
          `Selected ${format(new Date(selectedSlot.start), "MMM d, h:mm a")} - ${format(
            new Date(selectedSlot.end),
            "h:mm a",
          )}`,
        );
      }
      await loadHearings();
    } catch (error) {
      console.error("Auto-schedule test failed:", error);
      toast.error("Auto-schedule test failed.");
    } finally {
      setTestActionLoading(null);
    }
  }, [disputeId, loadHearings]);

  const handleLoadScheduleOptionsTest = useCallback(async () => {
    try {
      setTestActionLoading("options");
      const result = await getDisputeAutoScheduleOptions(disputeId, 3);
      if (result.manualRequired) {
        setTestScheduleHint(result.reason || "No schedule options available.");
        toast.warning(result.reason || "No schedule options available.");
      } else {
        const firstSlot = result.slots?.[0];
        setTestScheduleHint(
          firstSlot
            ? `Top slot ${format(new Date(firstSlot.start), "MMM d, h:mm a")} - ${format(
                new Date(firstSlot.end),
                "h:mm a",
              )}`
            : "Slots loaded.",
        );
        toast.success(`Loaded ${result.slots?.length ?? 0} schedule option(s).`);
      }
    } catch (error) {
      console.error("Failed to load schedule options:", error);
      toast.error("Could not load schedule options.");
    } finally {
      setTestActionLoading(null);
    }
  }, [disputeId]);

  const handleCompletePreviewTest = useCallback(async () => {
    try {
      setTestActionLoading("preview");
      const dispute = await getDisputeDetail(disputeId, { preferCache: false });
      if (
        ![DisputeStatus.PREVIEW, DisputeStatus.PENDING_REVIEW].includes(
          dispute.status,
        )
      ) {
        toast.warning(
          `Preview completion is only allowed from PREVIEW/PENDING_REVIEW. Current status: ${dispute.status}.`,
        );
        return;
      }

      if (
        currentUserRole === UserRole.STAFF &&
        dispute.assignedStaffId &&
        dispute.assignedStaffId !== currentUser?.id
      ) {
        toast.error(
          "This dispute is assigned to another staff member. Re-open the case list to refresh ownership.",
        );
        return;
      }

      const result = await completeDisputePreview(
        disputeId,
        "Test mode: complete preview and trigger auto-schedule",
      );
      const scheduleResult =
        (result as { scheduleResult?: { manualRequired?: boolean; reason?: string } })
          ?.scheduleResult || null;
      if (scheduleResult?.manualRequired) {
        toast.warning(scheduleResult.reason || "Preview completed. Manual scheduling required.");
      } else {
        toast.success("Preview completed and scheduling triggered.");
      }
      await loadHearings();
    } catch (error) {
      console.error("Preview completion test failed:", error);
      const details = getApiErrorDetails(
        error,
        "Could not complete preview in test mode.",
      );
      toast.error(
        details.code ? `[${details.code}] ${details.message}` : details.message,
      );
    } finally {
      setTestActionLoading(null);
    }
  }, [currentUser?.id, currentUserRole, disputeId, loadHearings]);

  const handleDispatchRemindersTest = useCallback(async () => {
    try {
      setTestActionLoading("reminders");
      const result = await dispatchHearingReminders();
      toast.success(
        `Reminder dispatch done. Sent ${result.dispatched ?? 0}, skipped ${result.skipped ?? 0}.`,
      );
    } catch (error) {
      console.error("Reminder dispatch test failed:", error);
      toast.error("Could not dispatch reminders.");
    } finally {
      setTestActionLoading(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {schemaErrorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Server schema is not ready</p>
          <p className="mt-1 text-xs text-amber-800">{schemaErrorMessage}</p>
        </div>
      )}

      {canUseTestTools && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            Dispute Flow Test Tools
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            Dev/Test only shortcuts to validate scheduling, reminders, and preview flow quickly.
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            Scheduling bypass requires backend `DISPUTE_TEST_MODE=true` (non-production).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="px-3 py-1.5 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={handleRunAutoScheduleTest}
              disabled={Boolean(testActionLoading)}
            >
              {testActionLoading === "autoschedule"
                ? "Running..."
                : "Force auto-schedule (5m)"}
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={handleLoadScheduleOptionsTest}
              disabled={Boolean(testActionLoading)}
            >
              {testActionLoading === "options"
                ? "Loading..."
                : "Load top schedule options"}
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={handleCompletePreviewTest}
              disabled={Boolean(testActionLoading)}
            >
              {testActionLoading === "preview"
                ? "Running..."
                : "Complete preview + schedule"}
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
              onClick={handleDispatchRemindersTest}
              disabled={Boolean(testActionLoading)}
            >
              {testActionLoading === "reminders"
                ? "Dispatching..."
                : "Dispatch reminders now"}
            </button>
          </div>
          {testScheduleHint ? (
            <p className="mt-2 text-xs text-slate-700">{testScheduleHint}</p>
          ) : null}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            Scheduled Hearings
          </h3>
        </div>
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading hearings...
            </div>
          ) : sortedHearings.length === 0 ? (
            <p className="text-sm text-gray-500">No hearings scheduled yet.</p>
          ) : (
            sortedHearings.map((hearing) => {
              const durationMinutes = hearing.estimatedDurationMinutes ?? 60;
              const canStart = canModerate && hearing.status === "SCHEDULED";
              const canEnd = canModerate && hearing.status === "IN_PROGRESS";
              const canReschedule =
                canManageSchedule && hearing.status === "SCHEDULED";

              return (
                <div
                  key={hearing.id}
                  className="border border-gray-100 rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Hearing #{hearing.hearingNumber ?? "-"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {formatScheduledRange(hearing)} ({durationMinutes}m)
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>Started: {formatTimestamp(hearing.startedAt)}</div>
                        <div>Ended: {formatTimestamp(hearing.endedAt)}</div>
                        <div>
                          Speaker: {speakerLabel(hearing.currentSpeakerRole)}
                        </div>
                        <div>
                          Chat: {hearing.isChatRoomActive ? "Active" : "Inactive"}
                        </div>
                        <div className="sm:col-span-2">
                          Confirmation:{" "}
                          {confirmationSummaryLabel(
                            hearing.participantConfirmationSummary,
                          )}
                        </div>
                      </div>

                      {hearing.agenda ? (
                        <p className="text-xs text-gray-600">
                          <span className="font-semibold">Agenda:</span>{" "}
                          {hearing.agenda}
                        </p>
                      ) : null}

                      {hearing.requiredDocuments &&
                      hearing.requiredDocuments.length > 0 ? (
                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          {hearing.requiredDocuments.map((doc) => (
                            <span
                              key={`${hearing.id}-${doc}`}
                              className="px-2 py-1 rounded-full bg-white border border-gray-200"
                            >
                              {doc}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {hearing.externalMeetingLink ? (
                        <a
                          href={hearing.externalMeetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Open meeting link
                        </a>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs border ${statusBadge(
                          hearing.status,
                        )}`}
                      >
                        {hearing.status.replace("_", " ")}
                      </span>
                      <div className="flex items-center gap-2">
                        {canModerate ? (
                          <button
                            onClick={() => handleOpenRoom(hearing.id)}
                            className="px-2 py-1 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800"
                          >
                            Open room
                          </button>
                        ) : null}
                        {canModerate ? (
                          <button
                            onClick={() => handleStart(hearing)}
                            disabled={!canStart || actionLoadingId === hearing.id}
                            className="px-2 py-1 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
                          >
                            {actionLoadingId === hearing.id && canStart ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            Start
                          </button>
                        ) : null}
                        {canReschedule ? (
                          <button
                            onClick={() => handleRescheduleOpen(hearing)}
                            className="px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-white flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Reschedule
                          </button>
                        ) : null}
                        {canModerate ? (
                          <button
                            onClick={() => handleEndOpen(hearing)}
                            disabled={!canEnd || actionLoadingId === hearing.id}
                            className="px-2 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50"
                          >
                            <StopCircle className="w-3 h-3" />
                            End
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Schedule New Hearing
        </h3>
        {canManageSchedule ? (
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Scheduled time
              </label>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Agenda</label>
              <textarea
                rows={3}
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                placeholder="Outline the hearing agenda"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Required documents (comma-separated)
              </label>
              <input
                value={requiredDocs}
                onChange={(event) => setRequiredDocs(event.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                placeholder="Contract, screenshots, invoices"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={(event) => setIsEmergency(event.target.checked)}
              />
              Emergency hearing (bypass 24h rule)
            </label>
            <div className="flex justify-end">
              <button
                onClick={handleSchedule}
                disabled={scheduleLoading}
                className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {scheduleLoading ? "Scheduling..." : "Schedule hearing"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
            Hearing scheduling is handled by the system after parties confirm availability.
          </div>
        )}
      </div>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule hearing</DialogTitle>
            <DialogDescription>
              Pick a new time and update the hearing details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <input
              type="datetime-local"
              value={rescheduleAt}
              onChange={(event) => setRescheduleAt(event.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="number"
                min={15}
                max={240}
                value={rescheduleDuration}
                onChange={(event) => setRescheduleDuration(Number(event.target.value))}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                placeholder="Duration minutes"
              />
            </div>
            <textarea
              rows={3}
              value={rescheduleAgenda}
              onChange={(event) => setRescheduleAgenda(event.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              placeholder="Agenda"
            />
            <input
              value={rescheduleDocs}
              onChange={(event) => setRescheduleDocs(event.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              placeholder="Required documents"
            />
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setRescheduleOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={handleRescheduleSubmit}
              disabled={actionLoadingId === rescheduleHearingTarget?.id}
            >
              {actionLoadingId === rescheduleHearingTarget?.id
                ? "Saving..."
                : "Reschedule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>End hearing</DialogTitle>
            <DialogDescription>Capture the hearing outcome.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <textarea
              rows={2}
              value={endSummary}
              onChange={(event) => setEndSummary(event.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              placeholder="Summary"
            />
            <textarea
              rows={2}
              value={endFindings}
              onChange={(event) => setEndFindings(event.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              placeholder="Findings"
            />
            <input
              value={endPendingActions}
              onChange={(event) => setEndPendingActions(event.target.value)}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm"
              placeholder="Pending actions (comma-separated)"
            />
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setEndOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              onClick={handleEndSubmit}
              disabled={actionLoadingId === endHearingTarget?.id}
            >
              {actionLoadingId === endHearingTarget?.id
                ? "Ending..."
                : "End hearing"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
