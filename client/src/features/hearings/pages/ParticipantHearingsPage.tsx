import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "react-big-calendar";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getEvents } from "@/features/calendar/api";
import { EventStatus, EventType, type CalendarEvent } from "@/features/calendar/types";
import { localizer } from "@/features/project-workspace/components/calendar";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { resolveRoleBasePath } from "../utils/hearingRouting";

type HearingCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: EventStatus;
  type: EventType;
  referenceId?: string;
  referenceType?: string;
  externalMeetingLink?: string;
  metadata?: Record<string, unknown>;
};

type CalendarViewType = "month" | "week" | "day" | "agenda";

const STATUS_STYLES: Record<EventStatus, { bg: string; border: string; text: string }> = {
  [EventStatus.DRAFT]: { bg: "#f8fafc", border: "#cbd5f5", text: "#475569" },
  [EventStatus.SCHEDULED]: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
  [EventStatus.PENDING_CONFIRMATION]: { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" },
  [EventStatus.RESCHEDULING]: { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" },
  [EventStatus.IN_PROGRESS]: { bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  [EventStatus.COMPLETED]: { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569" },
  [EventStatus.CANCELLED]: { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b" },
};

const statusLabelMap: Record<EventStatus, string> = {
  [EventStatus.DRAFT]: "Draft",
  [EventStatus.SCHEDULED]: "Scheduled",
  [EventStatus.PENDING_CONFIRMATION]: "Pending confirmation",
  [EventStatus.RESCHEDULING]: "Rescheduling",
  [EventStatus.IN_PROGRESS]: "In progress",
  [EventStatus.COMPLETED]: "Completed",
  [EventStatus.CANCELLED]: "Cancelled",
};

const isActiveStatus = (status: EventStatus) =>
  ![EventStatus.CANCELLED, EventStatus.COMPLETED].includes(status);

const getHearingId = (event: HearingCalendarEvent) => {
  if (event.referenceType === "DisputeHearing" && event.referenceId) {
    return event.referenceId;
  }
  const metadata = event.metadata;
  if (metadata && typeof metadata === "object" && "hearingId" in metadata) {
    const value = metadata.hearingId;
    if (typeof value === "string") return value;
  }
  return undefined;
};

const resolveRange = (baseDate: Date, view: CalendarViewType) => {
  if (view === "month" || view === "agenda") {
    const start = startOfWeek(startOfMonth(baseDate));
    const end = addDays(endOfWeek(endOfMonth(baseDate)), 1);
    return { start, end };
  }
  if (view === "week") {
    const start = startOfWeek(baseDate);
    const end = addDays(endOfWeek(baseDate), 1);
    return { start, end };
  }
  const start = startOfDay(baseDate);
  const end = addDays(start, 1);
  return { start, end };
};

export const ParticipantHearingsPage = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<HearingCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<HearingCalendarEvent | null>(
    null,
  );
  const notifiedRef = useRef<Set<string>>(new Set());

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string; role?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const userId = currentUser?.id;
  const roleBasePath = useMemo(
    () => resolveRoleBasePath(currentUser?.role),
    [currentUser?.role],
  );

  const fetchEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      return;
    }
    try {
      setLoading(true);
      const { start, end } = resolveRange(date, view);
      const response = await getEvents({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        type: EventType.DISPUTE_HEARING,
        participantId: userId,
      });
      const items = response?.items ?? [];
      const mapped = items
        .map((event: CalendarEvent): HearingCalendarEvent | null => {
          const startTime = new Date(event.startTime);
          const endTime = new Date(event.endTime);
          if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
            return null;
          }
          return {
            id: event.id,
            title: event.title || "Dispute Hearing",
            start: startTime,
            end: endTime,
            status: event.status,
            type: event.type,
            referenceId: event.referenceId,
            referenceType: event.referenceType,
            externalMeetingLink: event.externalMeetingLink,
            metadata: (event.metadata as Record<string, unknown>) || undefined,
          };
        })
        .filter((event): event is HearingCalendarEvent => Boolean(event));
      setEvents(mapped);
    } catch (error) {
      console.error("Failed to load hearing schedule:", error);
      toast.error("Could not load hearing schedule");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [date, userId, view]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!events.length) return;
    const notify = () => {
      const now = new Date();
      events.forEach((event) => {
        if (!isActiveStatus(event.status)) return;
        const minutesUntil = (event.start.getTime() - now.getTime()) / 60000;
        if (minutesUntil > 10 || minutesUntil < -5) return;
        const key = `${event.id}:${event.start.toISOString()}`;
        if (notifiedRef.current.has(key)) return;
        const label =
          minutesUntil <= 0
            ? "Your hearing is starting now."
            : `Your hearing starts in ${Math.ceil(minutesUntil)} minutes.`;
        toast.info(label);
        notifiedRef.current.add(key);
      });
    };
    notify();
    const interval = window.setInterval(notify, 60_000);
    return () => window.clearInterval(interval);
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((event) => event.end.getTime() >= now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 4);
  }, [events]);

  const handleSelectEvent = useCallback((event: HearingCalendarEvent) => {
    setSelectedEvent(event);
    setDetailOpen(true);
  }, []);

  const eventPropGetter = useCallback((event: HearingCalendarEvent) => {
    const style = STATUS_STYLES[event.status] ?? STATUS_STYLES[EventStatus.SCHEDULED];
    return {
      style: {
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
        borderRadius: "8px",
        borderWidth: "2px",
        borderStyle: "solid",
        fontWeight: 600,
        padding: "4px 8px",
        cursor: "pointer",
      },
    };
  }, []);

  if (!userId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Please sign in to view your hearing schedule.
      </div>
    );
  }

  const selectedHearingId = selectedEvent ? getHearingId(selectedEvent) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-teal-600" />
            Hearing Schedule
          </h1>
          <p className="text-sm text-slate-600">
            Auto-scheduled hearings for your active disputes.
          </p>
        </div>
        {loading && (
          <div className="text-xs text-slate-500">Refreshing calendar...</div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-slate-50 text-sm text-slate-600">
            Click a time slot to view details and join the hearing room.
          </div>
          <div className="px-4 pb-4">
            <div className="h-[600px] interdev-calendar">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: "100%" }}
                views={["month", "week", "day", "agenda"]}
                date={date}
                view={view}
                onNavigate={setDate}
                onView={(nextView) => setView(nextView as CalendarViewType)}
                eventPropGetter={eventPropGetter}
                onSelectEvent={handleSelectEvent}
                toolbar
                popup
                showMultiDayTimes
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Video className="h-4 w-4 text-teal-600" />
              Upcoming hearings
            </h3>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {upcomingEvents.length === 0 && (
                <p className="text-sm text-slate-500">No upcoming hearings yet.</p>
              )}
              {upcomingEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                >
                  <div className="font-medium text-slate-900">{event.title}</div>
                  <div className="text-xs text-slate-500">
                    {format(event.start, "MMM d, h:mm a")} •{" "}
                    {statusLabelMap[event.status]}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-teal-700">
            You will receive a toast notification 10 minutes before a hearing starts.
          </div>
        </div>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedEvent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title ?? "Hearing details"}</DialogTitle>
            <DialogDescription>
              {selectedEvent
                ? format(selectedEvent.start, "MMM d, yyyy • h:mm a")
                : "Hearing schedule"}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Status
                </p>
                <p className="font-medium text-slate-900">
                  {statusLabelMap[selectedEvent.status]}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Time
                </p>
                <p className="font-medium text-slate-900">
                  {format(selectedEvent.start, "h:mm a")} -{" "}
                  {format(selectedEvent.end, "h:mm a")}
                </p>
              </div>
              {selectedEvent.externalMeetingLink && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Meeting link
                  </p>
                  <a
                    href={selectedEvent.externalMeetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Open meeting link
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setDetailOpen(false)}
            >
              Close
            </button>
            {selectedHearingId && selectedEvent && isActiveStatus(selectedEvent.status) && (
              <button
                className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                onClick={() => {
                  setDetailOpen(false);
                  navigate(`${roleBasePath}/hearings/${selectedHearingId}`);
                }}
              >
                Join hearing room
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .interdev-calendar .rbc-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .interdev-calendar .rbc-toolbar-label {
          font-weight: 600;
          color: #0f172a;
        }
        .interdev-calendar .rbc-header {
          padding: 10px 8px;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .interdev-calendar .rbc-time-view,
        .interdev-calendar .rbc-month-view {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .interdev-calendar .rbc-today {
          background-color: #f0fdfa !important;
        }
        .interdev-calendar .rbc-event-content {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};
