import { dateFnsLocalizer } from "react-big-calendar";
import { addDays, endOfDay, format, getDay, parse, startOfDay, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import type { Task } from "../../types";

const locales = {
  "en-US": enUS,
};

export const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export type CalendarViewType = "month" | "week" | "work_week" | "day" | "agenda";
export type CalendarStatusTone = "PLANNED" | "ACTIVE" | "DONE" | "OVERDUE";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  status: string;
  statusTone: CalendarStatusTone;
  resource: Task;
}

type CalendarStatusMeta = {
  label: string;
  surface: string;
  border: string;
  text: string;
};

export const CALENDAR_STATUS_META: Record<CalendarStatusTone, CalendarStatusMeta> = {
  DONE: {
    label: "Done",
    surface: "#dcfce7",
    border: "#34d399",
    text: "#166534",
  },
  ACTIVE: {
    label: "In progress",
    surface: "#dbeafe",
    border: "#60a5fa",
    text: "#1d4ed8",
  },
  OVERDUE: {
    label: "Overdue",
    surface: "#fee2e2",
    border: "#f87171",
    text: "#b91c1c",
  },
  PLANNED: {
    label: "Planned",
    surface: "#f1f5f9",
    border: "#cbd5e1",
    text: "#475569",
  },
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DONE_STATUSES = new Set(["DONE"]);
const ACTIVE_STATUSES = new Set([
  "IN_PROGRESS",
  "IN_REVIEW",
  "SUBMITTED",
  "LOCKED",
  "REVISIONS_REQUIRED",
  "PENDING_STAFF_REVIEW",
  "PENDING_CLIENT_APPROVAL",
]);

function parseWorkspaceDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(normalizedValue)) {
    const [year, month, day] = normalizedValue.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsedValue = new Date(normalizedValue);
  return Number.isNaN(parsedValue.getTime()) ? null : parsedValue;
}

function buildAllDayRange(startValue?: string | null, endValue?: string | null) {
  const rawStart = parseWorkspaceDate(startValue ?? endValue ?? null);
  const rawEnd = parseWorkspaceDate(endValue ?? startValue ?? null);

  if (!rawStart || !rawEnd) {
    return null;
  }

  const start = rawStart.getTime() <= rawEnd.getTime() ? rawStart : rawEnd;
  const end = rawStart.getTime() <= rawEnd.getTime() ? rawEnd : rawStart;

  return {
    start: startOfDay(start),
    end: addDays(startOfDay(end), 1),
  };
}

function resolveStatusTone(task: Task): CalendarStatusTone {
  const normalizedStatus = task.status?.toUpperCase() ?? "";

  if (DONE_STATUSES.has(normalizedStatus)) {
    return "DONE";
  }

  const dueDate = parseWorkspaceDate(task.dueDate ?? task.startDate);
  if (dueDate && endOfDay(dueDate).getTime() < Date.now()) {
    return "OVERDUE";
  }

  if (ACTIVE_STATUSES.has(normalizedStatus)) {
    return "ACTIVE";
  }

  return "PLANNED";
}

export function getEventInlineStyles(event: CalendarEvent) {
  const tone = CALENDAR_STATUS_META[event.statusTone];
  const priority = event.resource.priority ?? "MEDIUM";
  const eventClassName = [
    "interdev-task-event",
    priority === "HIGH" ? "interdev-task-event-priority-high" : "",
    priority === "URGENT" ? "interdev-task-event-priority-urgent" : "",
    event.statusTone === "OVERDUE" ? "interdev-task-event-overdue" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    className: eventClassName,
    style: {
      backgroundColor: tone.surface,
      color: tone.text,
      border: `1.5px solid ${tone.border}`,
      borderLeftWidth: 4,
      borderRadius: "8px",
      boxShadow:
        priority === "URGENT"
          ? "0 0 0 1px rgba(239, 68, 68, 0.2), 0 12px 24px rgba(239, 68, 68, 0.18)"
          : priority === "HIGH"
            ? "0 0 0 1px rgba(245, 158, 11, 0.18), 0 10px 18px rgba(245, 158, 11, 0.14)"
            : "0 2px 4px rgba(15, 23, 42, 0.06)",
      fontWeight: 600,
      fontSize: "0.8rem",
      padding: "2px 8px",
      opacity: event.statusTone === "PLANNED" ? 0.94 : 1,
    },
  };
}

export function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((first, second) => {
    const startDifference = first.start.getTime() - second.start.getTime();
    if (startDifference !== 0) {
      return startDifference;
    }

    return first.title.localeCompare(second.title);
  });
}

export function tasksToCalendarEvents(tasks: Task[]): CalendarEvent[] {
  return tasks.flatMap((task) => {
    const range = buildAllDayRange(task.startDate ?? task.dueDate, task.dueDate ?? task.startDate);
    if (!range) {
      return [];
    }

    return [
      {
        id: `task-${task.id}`,
        title: task.title,
        start: range.start,
        end: range.end,
        allDay: true,
        status: task.status,
        statusTone: resolveStatusTone(task),
        resource: task,
      },
    ];
  });
}
