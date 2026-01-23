import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  Link as LinkIcon,
  Loader2,
  Play,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getEvents } from "@/features/calendar/api";
import { EventStatus, EventType, type CalendarEvent } from "@/features/calendar/types";
import {
  endHearing,
  rescheduleHearing,
  scheduleHearing,
  startHearing,
} from "@/features/hearings/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface DisputeHearingPanelProps {
  disputeId: string;
  refreshToken?: number;
}

export const DisputeHearingPanel = ({
  disputeId,
  refreshToken,
}: DisputeHearingPanelProps) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [agenda, setAgenda] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [requiredDocs, setRequiredDocs] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDuration, setRescheduleDuration] = useState(60);
  const [rescheduleAgenda, setRescheduleAgenda] = useState("");
  const [rescheduleLink, setRescheduleLink] = useState("");
  const [rescheduleDocs, setRescheduleDocs] = useState("");

  const [endOpen, setEndOpen] = useState(false);
  const [endEvent, setEndEvent] = useState<CalendarEvent | null>(null);
  const [endSummary, setEndSummary] = useState("");
  const [endFindings, setEndFindings] = useState("");
  const [endPendingActions, setEndPendingActions] = useState("");

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEvents({ type: EventType.DISPUTE_HEARING });
      const items = data.items || [];
      const filtered = items.filter(
        (event) => event.metadata?.disputeId === disputeId,
      );
      setEvents(filtered);
    } catch (error) {
      console.error("Failed to load hearing events:", error);
      toast.error("Could not load hearing events");
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents, refreshToken]);

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
      await scheduleHearing({
        disputeId,
        scheduledAt: toIsoString(scheduleAt),
        estimatedDurationMinutes: duration,
        agenda: agenda.trim() || undefined,
        requiredDocuments: requiredDocs
          ? requiredDocs.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
        externalMeetingLink: meetingLink.trim() || undefined,
        isEmergency,
      });
      toast.success("Hearing scheduled.");
      setScheduleAt("");
      setAgenda("");
      setMeetingLink("");
      setRequiredDocs("");
      setIsEmergency(false);
      await loadEvents();
    } catch (error) {
      console.error("Failed to schedule hearing:", error);
      toast.error("Could not schedule hearing.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const hearingIdForEvent = (event: CalendarEvent) =>
    event.referenceId || (event.metadata?.hearingId as string | undefined);

  const handleStart = async (event: CalendarEvent) => {
    const hearingId = hearingIdForEvent(event);
    if (!hearingId) {
      toast.error("Missing hearing ID.");
      return;
    }

    try {
      setActionLoadingId(event.id);
      await startHearing(hearingId);
      toast.success("Hearing started.");
      await loadEvents();
    } catch (error) {
      console.error("Failed to start hearing:", error);
      toast.error("Could not start hearing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRescheduleOpen = (event: CalendarEvent) => {
    setRescheduleEvent(event);
    setRescheduleAt("");
    setRescheduleDuration(event.durationMinutes || 60);
    setRescheduleAgenda(event.description || "");
    setRescheduleLink(event.externalMeetingLink || "");
    setRescheduleDocs("");
    setRescheduleOpen(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleEvent) return;
    if (!rescheduleAt) {
      toast.error("Select a new time.");
      return;
    }
    const hearingId = hearingIdForEvent(rescheduleEvent);
    if (!hearingId) {
      toast.error("Missing hearing ID.");
      return;
    }

    try {
      setActionLoadingId(rescheduleEvent.id);
      await rescheduleHearing(hearingId, {
        hearingId,
        scheduledAt: toIsoString(rescheduleAt),
        estimatedDurationMinutes: rescheduleDuration,
        agenda: rescheduleAgenda.trim() || undefined,
        requiredDocuments: rescheduleDocs
          ? rescheduleDocs.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
        externalMeetingLink: rescheduleLink.trim() || undefined,
      });
      toast.success("Hearing rescheduled.");
      setRescheduleOpen(false);
      await loadEvents();
    } catch (error) {
      console.error("Failed to reschedule hearing:", error);
      toast.error("Could not reschedule hearing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEndOpen = (event: CalendarEvent) => {
    setEndEvent(event);
    setEndSummary("");
    setEndFindings("");
    setEndPendingActions("");
    setEndOpen(true);
  };

  const handleEndSubmit = async () => {
    if (!endEvent) return;
    const hearingId = hearingIdForEvent(endEvent);
    if (!hearingId) {
      toast.error("Missing hearing ID.");
      return;
    }

    try {
      setActionLoadingId(endEvent.id);
      await endHearing(hearingId, {
        hearingId,
        summary: endSummary.trim() || undefined,
        findings: endFindings.trim() || undefined,
        pendingActions: endPendingActions
          ? endPendingActions.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      });
      toast.success("Hearing ended.");
      setEndOpen(false);
      await loadEvents();
    } catch (error) {
      console.error("Failed to end hearing:", error);
      toast.error("Could not end hearing.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusBadge = (status: EventStatus) => {
    switch (status) {
      case EventStatus.IN_PROGRESS:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case EventStatus.PENDING_CONFIRMATION:
        return "bg-amber-50 text-amber-700 border-amber-200";
      case EventStatus.CANCELLED:
        return "bg-red-50 text-red-700 border-red-200";
      case EventStatus.COMPLETED:
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
  }, [events]);

  return (
    <div className="space-y-6">
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
          ) : sortedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">No hearings scheduled yet.</p>
          ) : (
            sortedEvents.map((event) => (
              <div
                key={event.id}
                className="border border-gray-100 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {format(new Date(event.startTime), "MMM d, yyyy h:mm a")} -{" "}
                      {format(new Date(event.endTime), "h:mm a")}
                    </p>
                    {event.externalMeetingLink && (
                      <a
                        href={event.externalMeetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-600 mt-2"
                      >
                        <LinkIcon className="w-3 h-3" />
                        Join meeting
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs border ${statusBadge(
                        event.status,
                      )}`}
                    >
                      {event.status.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStart(event)}
                        disabled={actionLoadingId === event.id}
                        className="px-2 py-1 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
                      >
                        {actionLoadingId === event.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        Start
                      </button>
                      <button
                        onClick={() => handleRescheduleOpen(event)}
                        className="px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-white flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reschedule
                      </button>
                      <button
                        onClick={() => handleEndOpen(event)}
                        className="px-2 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                      >
                        <StopCircle className="w-3 h-3" />
                        End
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Schedule New Hearing
        </h3>
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Meeting link
              </label>
              <input
                value={meetingLink}
                onChange={(event) => setMeetingLink(event.target.value)}
                placeholder="https://meet..."
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
              <input
                value={rescheduleLink}
                onChange={(event) => setRescheduleLink(event.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                placeholder="Meeting link"
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
              disabled={actionLoadingId === rescheduleEvent?.id}
            >
              {actionLoadingId === rescheduleEvent?.id ? "Saving..." : "Reschedule"}
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
              disabled={actionLoadingId === endEvent?.id}
            >
              {actionLoadingId === endEvent?.id ? "Ending..." : "End hearing"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
