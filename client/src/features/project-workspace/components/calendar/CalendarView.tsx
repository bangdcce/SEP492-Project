import { useCallback, useMemo, useState } from "react";
import { Calendar as BigCalendar } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  startOfDay,
  subDays,
  subMonths,
  subWeeks,
  addWeeks,
} from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { AlertTriangle, Flag } from "lucide-react";
import { toast } from "sonner";

import { updateTask } from "../../api";
import type { Task } from "../../types";
import { CalendarToolbar } from "./CalendarToolbar";
import {
  CALENDAR_STATUS_META,
  getEventInlineStyles,
  localizer,
  sortCalendarEvents,
  tasksToCalendarEvents,
  type CalendarEvent,
  type CalendarViewType,
} from "./index";

type CalendarViewProps = {
  tasks: Task[];
  selectedMilestoneLabel?: string | null;
  canRescheduleTasks?: boolean;
  onViewTaskDetails?: (taskId: string) => void;
  onTaskUpdated?: (task: Task) => void;
};

const DragAndDropCalendar = withDragAndDrop<CalendarEvent, object>(BigCalendar);
const HIGH_PRIORITY_LEVELS = new Set(["HIGH", "URGENT"]);

function CalendarLegend() {
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(CALENDAR_STATUS_META).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-2 text-xs text-slate-600">
              <span
                className="h-3 w-3 rounded-full border"
                style={{ backgroundColor: meta.surface, borderColor: meta.border }}
              />
              <span>{meta.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]" />
            <span>High priority glow</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span>Overdue alert pulse</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function stripRichText(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTaskDateSummary(task: Task) {
  const hasStartDate = Boolean(task.startDate);
  const hasDueDate = Boolean(task.dueDate);

  if (hasStartDate && hasDueDate) {
    return `${format(new Date(task.startDate as string), "MMM d")} -> ${format(
      new Date(task.dueDate as string),
      "MMM d",
    )}`;
  }

  if (hasDueDate) {
    return `Due ${format(new Date(task.dueDate as string), "MMM d")}`;
  }

  if (hasStartDate) {
    return `Starts ${format(new Date(task.startDate as string), "MMM d")}`;
  }

  return "No schedule";
}

function CalendarEventChip({ event }: { event: CalendarEvent }) {
  const priorityLabel = event.resource.priority ?? "MEDIUM";

  return (
    <div className="flex h-full min-w-0 items-center gap-2">
      {HIGH_PRIORITY_LEVELS.has(priorityLabel) ? (
        <Flag className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      ) : null}
      <span className="truncate">{event.title}</span>
    </div>
  );
}

function buildRescheduledTaskPatch(task: Task, nextStart: Date, nextEnd: Date) {
  const normalizedStart = startOfDay(nextStart);
  const normalizedExclusiveEnd = startOfDay(nextEnd);
  const normalizedDue =
    normalizedExclusiveEnd.getTime() > normalizedStart.getTime()
      ? addDays(normalizedExclusiveEnd, -1)
      : normalizedStart;

  const patch: Pick<Task, "startDate" | "dueDate"> = {};

  if (task.startDate) {
    patch.startDate = format(normalizedStart, "yyyy-MM-dd");
  }

  if (task.dueDate) {
    patch.dueDate = format(normalizedDue, "yyyy-MM-dd");
  }

  if (!task.startDate && !task.dueDate) {
    patch.dueDate = format(normalizedStart, "yyyy-MM-dd");
  }

  return patch;
}

export function CalendarView({
  tasks,
  selectedMilestoneLabel,
  canRescheduleTasks = false,
  onViewTaskDetails,
  onTaskUpdated,
}: CalendarViewProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null);

  const visibleEvents = useMemo(
    () => sortCalendarEvents(tasksToCalendarEvents(tasks)),
    [tasks],
  );

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onViewTaskDetails?.(event.resource.id);
    },
    [onViewTaskDetails],
  );

  const handleEventDrop = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalendarEvent>) => {
      if (!canRescheduleTasks) {
        return;
      }

      const nextStart = new Date(start);
      const nextEnd = new Date(end);
      const patch = buildRescheduledTaskPatch(event.resource, nextStart, nextEnd);

      setReschedulingTaskId(event.resource.id);
      try {
        const updatedTask = await updateTask(event.resource.id, patch);
        onTaskUpdated?.(updatedTask);
        toast.success(`Rescheduled "${updatedTask.title}"`);
      } catch (error) {
        console.error("Failed to reschedule task from calendar", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to reschedule task",
        );
      } finally {
        setReschedulingTaskId(null);
      }
    },
    [canRescheduleTasks, onTaskUpdated],
  );

  const canDragEvent = useCallback(
    (event: CalendarEvent) =>
      canRescheduleTasks &&
      !reschedulingTaskId &&
      Boolean(event.resource?.id) &&
      event.resource.status?.toUpperCase() !== "DONE",
    [canRescheduleTasks, reschedulingTaskId],
  );

  const handleNavigate = useCallback(
    (action: "PREV" | "NEXT" | "TODAY") => {
      if (action === "TODAY") {
        setDate(new Date());
        return;
      }

      const direction = action === "NEXT" ? 1 : -1;

      setDate((currentDate) => {
        if (view === "month") {
          return direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
        }

        if (view === "week") {
          return direction > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
        }

        return direction > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1);
      });
    },
    [view],
  );

  const handleViewChange = useCallback((nextView: CalendarViewType) => {
    setView(nextView);
  }, []);

  const dayPropGetter = useCallback((day: Date) => {
    if (!isSameDay(day, new Date())) {
      return {};
    }

    return {
      className: "interdev-calendar-today-cell",
      style: {
        background:
          "linear-gradient(180deg, rgba(20, 184, 166, 0.14) 0%, rgba(236, 254, 255, 0.95) 100%)",
        boxShadow: "inset 0 0 0 2px rgba(20, 184, 166, 0.18)",
      },
    };
  }, []);

  const emptyStateLabel = selectedMilestoneLabel
    ? `No scheduled tasks were found for milestone "${selectedMilestoneLabel}".`
    : "No tasks with start or due dates were found.";

  const tooltipAccessor = useCallback((event: CalendarEvent) => {
    const task = event.resource;
    const descriptionPreview = stripRichText(task.description);
    const assigneeName = task.assignee?.fullName ?? "Unassigned";
    const statusLabel = CALENDAR_STATUS_META[event.statusTone].label;

    return [
      `Task: ${task.title}`,
      `Assignee: ${assigneeName}`,
      `Status: ${statusLabel}`,
      `Priority: ${task.priority ?? "MEDIUM"}`,
      getTaskDateSummary(task),
      descriptionPreview ? `Preview: ${descriptionPreview}` : "Preview: No description yet",
    ].join("\n");
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4">
        <CalendarToolbar
          date={date}
          view={view}
          taskCount={visibleEvents.length}
          selectedMilestoneLabel={selectedMilestoneLabel}
          onNavigate={handleNavigate}
          onViewChange={handleViewChange}
        />

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-700">
            Today is {format(new Date(), "MMMM d, yyyy")}
          </span>
          {canRescheduleTasks ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
              Drag any task to reschedule it instantly
            </span>
          ) : null}
          {reschedulingTaskId ? (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600">
              Updating schedule...
            </span>
          ) : null}
          <span>Hover for quick preview, click to open full detail.</span>
        </div>
      </div>

      <div className="px-4 pb-4">
        {visibleEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-base font-semibold text-slate-800">{emptyStateLabel}</p>
            <p className="mt-2 text-sm text-slate-500">
              Add task start dates or deadlines inside the selected milestone to populate the calendar.
            </p>
          </div>
        ) : (
          <div className="h-[560px] interdev-calendar">
            <DragAndDropCalendar
              localizer={localizer}
              events={visibleEvents}
              startAccessor="start"
              endAccessor="end"
              allDayAccessor="allDay"
              selectable
              resizable={false}
              style={{ height: "100%" }}
              eventPropGetter={getEventInlineStyles}
              onSelectEvent={handleSelectEvent}
              onEventDrop={handleEventDrop}
              draggableAccessor={canDragEvent}
              components={{ event: CalendarEventChip }}
              views={["month", "week", "day", "agenda"]}
              date={date}
              view={view}
              onNavigate={setDate}
              onView={(nextView) => setView(nextView as CalendarViewType)}
              toolbar={false}
              popup
              showMultiDayTimes
              dayPropGetter={dayPropGetter}
              tooltipAccessor={tooltipAccessor}
            />
          </div>
        )}
      </div>

      <CalendarLegend />

      <style>{`
        .interdev-calendar .rbc-header {
          padding: 12px 8px;
          border-bottom: 1px solid #e2e8f0;
          background-color: #f8fafc;
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .interdev-calendar .rbc-month-view,
        .interdev-calendar .rbc-time-view {
          overflow: hidden;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        }

        .interdev-calendar .rbc-day-bg {
          border-left: 1px solid #f1f5f9;
        }

        .interdev-calendar .rbc-day-bg:first-child {
          border-left: none;
        }

        .interdev-calendar .rbc-off-range-bg {
          background-color: #fafafa;
        }

        .interdev-calendar .rbc-today {
          background-color: transparent !important;
        }

        .interdev-calendar .interdev-calendar-today-cell {
          background:
            linear-gradient(180deg, rgba(20, 184, 166, 0.14) 0%, rgba(236, 254, 255, 0.95) 100%) !important;
          box-shadow: inset 0 0 0 2px rgba(20, 184, 166, 0.18);
        }

        .interdev-calendar .rbc-date-cell {
          padding: 4px 8px;
          text-align: right;
          font-size: 0.875rem;
          color: #475569;
        }

        .interdev-calendar .rbc-date-cell.rbc-now {
          color: #0f766e;
          font-weight: 800;
        }

        .interdev-calendar .rbc-event {
          min-height: 26px;
          cursor: grab;
          user-select: none;
          -webkit-user-drag: none;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            opacity 160ms ease;
        }

        .interdev-calendar .rbc-event:active {
          cursor: grabbing;
        }

        .interdev-calendar .rbc-event:hover {
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
        }

        .interdev-calendar .rbc-addons-dnd-is-dragging .rbc-event {
          pointer-events: none;
        }

        .interdev-calendar .rbc-addons-dnd-drag-preview {
          opacity: 0.96;
          box-shadow: 0 18px 32px rgba(15, 23, 42, 0.18);
        }

        .interdev-calendar .interdev-task-event-priority-high {
          box-shadow:
            0 0 0 1px rgba(245, 158, 11, 0.18),
            0 0 0 5px rgba(251, 191, 36, 0.12),
            0 12px 24px rgba(245, 158, 11, 0.16) !important;
        }

        .interdev-calendar .interdev-task-event-priority-urgent {
          box-shadow:
            0 0 0 1px rgba(239, 68, 68, 0.22),
            0 0 0 5px rgba(248, 113, 113, 0.14),
            0 14px 28px rgba(239, 68, 68, 0.2) !important;
        }

        @media (prefers-reduced-motion: no-preference) {
          .interdev-calendar .interdev-task-event-overdue {
            animation: interdev-calendar-overdue-pulse 1.8s ease-in-out infinite;
          }
        }

        .interdev-calendar .rbc-event-content {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          pointer-events: none;
        }

        .interdev-calendar .rbc-show-more {
          color: #0f766e;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .interdev-calendar .rbc-agenda-view table {
          border-collapse: separate;
          border-spacing: 0;
        }

        .interdev-calendar .rbc-agenda-view .rbc-agenda-date-cell,
        .interdev-calendar .rbc-agenda-view .rbc-agenda-time-cell {
          padding: 10px 12px;
          color: #475569;
          font-size: 0.875rem;
          white-space: nowrap;
        }

        .interdev-calendar .rbc-agenda-view .rbc-agenda-event-cell {
          padding: 10px 12px;
        }

        .interdev-calendar .rbc-time-header {
          border-bottom: 1px solid #e2e8f0;
        }

        .interdev-calendar .rbc-time-content {
          border-top: none;
        }

        .interdev-calendar .rbc-current-time-indicator {
          height: 2px;
          background-color: #0f766e;
        }

        @keyframes interdev-calendar-overdue-pulse {
          0%,
          100% {
            box-shadow:
              0 0 0 1px rgba(239, 68, 68, 0.24),
              0 10px 18px rgba(239, 68, 68, 0.18);
            transform: translateX(0);
          }

          50% {
            box-shadow:
              0 0 0 1px rgba(239, 68, 68, 0.3),
              0 0 0 6px rgba(248, 113, 113, 0.14),
              0 12px 22px rgba(239, 68, 68, 0.22);
            transform: translateX(1px);
          }
        }
      `}</style>
    </div>
  );
}

export default CalendarView;
