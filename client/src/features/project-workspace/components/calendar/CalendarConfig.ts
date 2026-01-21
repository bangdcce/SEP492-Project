import { dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  Users,
  FileText,
} from "lucide-react";
import type { Task } from "../../types";

// ─────────────────────────────────────────────────────────────────────────────
// LOCALIZER
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calendar view types supported by react-big-calendar
 */
export type CalendarViewType = "month" | "week" | "work_week" | "day" | "agenda";

/**
 * Event Types for color coding
 * Maps to CalendarEventEntity.type from backend
 */
export type EventType =
  | "TASK_DEADLINE"
  | "DISPUTE_HEARING"
  | "PROJECT_MEETING"
  | "REVIEW_SESSION"
  | "OTHER";

/**
 * Enhanced calendar event interface
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Task;
  eventType: EventType;
  allDay?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT STYLES
// ─────────────────────────────────────────────────────────────────────────────

export type EventStyleConfig = {
  bg: string;
  text: string;
  border: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
  buttonBg: string;
  buttonHover: string;
  icon: typeof CalendarIcon;
  label: string;
};

/**
 * Event styling configuration by type
 * Includes both Tailwind classes and hex values for react-big-calendar
 */
export const EVENT_STYLES: Record<EventType, EventStyleConfig> = {
  TASK_DEADLINE: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    border: "border-teal-300",
    bgHex: "#ccfbf1",
    borderHex: "#5eead4",
    textHex: "#0f766e",
    buttonBg: "bg-teal-600 hover:bg-teal-700",
    buttonHover: "hover:bg-teal-700",
    icon: CheckCircle2,
    label: "Task Deadline",
  },
  DISPUTE_HEARING: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-300",
    bgHex: "#fee2e2",
    borderHex: "#fca5a5",
    textHex: "#b91c1c",
    buttonBg: "bg-red-600 hover:bg-red-700",
    buttonHover: "hover:bg-red-700",
    icon: AlertTriangle,
    label: "Dispute Hearing",
  },
  PROJECT_MEETING: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-300",
    bgHex: "#e0e7ff",
    borderHex: "#a5b4fc",
    textHex: "#4338ca",
    buttonBg: "bg-indigo-600 hover:bg-indigo-700",
    buttonHover: "hover:bg-indigo-700",
    icon: Users,
    label: "Project Meeting",
  },
  REVIEW_SESSION: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-300",
    bgHex: "#fef3c7",
    borderHex: "#fcd34d",
    textHex: "#b45309",
    buttonBg: "bg-amber-600 hover:bg-amber-700",
    buttonHover: "hover:bg-amber-700",
    icon: FileText,
    label: "Review Session",
  },
  OTHER: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    bgHex: "#f1f5f9",
    borderHex: "#cbd5e1",
    textHex: "#475569",
    buttonBg: "bg-slate-600 hover:bg-slate-700",
    buttonHover: "hover:bg-slate-700",
    icon: CalendarIcon,
    label: "Other",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine event type based on task data
 * In future, this could come from task.eventType or linked calendar event
 */
export function getEventType(task: Task): EventType {
  const title = task.title?.toLowerCase() ?? "";
  
  if (title.includes("dispute")) {
    return "DISPUTE_HEARING";
  }
  if (title.includes("meeting")) {
    return "PROJECT_MEETING";
  }
  if (title.includes("review")) {
    return "REVIEW_SESSION";
  }
  return "TASK_DEADLINE";
}

/**
 * Get style configuration for an event type
 */
export function getEventStyle(eventType: EventType): EventStyleConfig {
  return EVENT_STYLES[eventType];
}

/**
 * Get inline styles for react-big-calendar events
 */
export function getEventInlineStyles(event: CalendarEvent) {
  const style = EVENT_STYLES[event.eventType];

  return {
    style: {
      backgroundColor: style.bgHex,
      borderColor: style.borderHex,
      borderRadius: "6px",
      border: `2px solid ${style.borderHex}`,
      color: style.textHex,
      fontWeight: 500,
      fontSize: "0.8rem",
      padding: "2px 8px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      cursor: "pointer",
    },
  };
}

/**
 * Convert tasks array to calendar events
 */
export function tasksToCalendarEvents(tasks: Task[]): CalendarEvent[] {
  return tasks
    .filter((task) => task.dueDate)
    .map((task) => {
      const startDate = task.startDate
        ? new Date(task.startDate)
        : new Date(task.dueDate!);
      const dueDate = new Date(task.dueDate!);

      return {
        id: task.id,
        title: task.title,
        start: startDate,
        end: dueDate,
        resource: task,
        eventType: getEventType(task),
      };
    });
}
