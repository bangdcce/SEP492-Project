import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { ExternalLink, X } from "lucide-react";
import { CALENDAR_STATUS_META, type CalendarEvent } from "./CalendarConfig";

type CalendarEventPopoverProps = {
  event: CalendarEvent | null;
  position: { x: number; y: number };
  onClose: () => void;
  onViewDetails?: (event: CalendarEvent) => void;
};

function StatusBadge({ label, tone }: { label: string; tone: keyof typeof CALENDAR_STATUS_META }) {
  const meta = CALENDAR_STATUS_META[tone];

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: meta.surface,
        color: meta.text,
        border: `1px solid ${meta.border}`,
      }}
    >
      {label}
    </span>
  );
}

export function CalendarEventPopover({
  event,
  position,
  onClose,
  onViewDetails,
}: CalendarEventPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (nextEvent: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(nextEvent.target as Node)) {
        onClose();
      }
    };

    if (!event) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [event, onClose]);

  useEffect(() => {
    if (!event) {
      return;
    }

    const handleEscape = (nextEvent: KeyboardEvent) => {
      if (nextEvent.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [event, onClose]);

  if (!event) {
    return null;
  }

  const tone = CALENDAR_STATUS_META[event.statusTone];
  const adjustedX = Math.min(position.x, window.innerWidth - 340);
  const adjustedY = Math.min(position.y, window.innerHeight - 360);

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{ left: adjustedX, top: adjustedY }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-popover-title"
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ backgroundColor: tone.surface, borderColor: tone.border }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full border"
            style={{ backgroundColor: tone.surface, borderColor: tone.border }}
          />
          <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: tone.text }}>
            Task
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-900"
          aria-label="Close popover"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h3 id="calendar-event-popover-title" className="text-lg font-semibold text-slate-900">
            {event.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {format(event.start, "MMM d, yyyy")}
            {" - "}
            {format(new Date(event.end.getTime() - 1), "MMM d, yyyy")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={tone.label} tone={event.statusTone} />
          <StatusBadge label={event.status.replace(/_/g, " ")} tone={event.statusTone} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Task events open the task detail flow directly from the calendar so planning and execution stay connected.
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => onViewDetails?.(event)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          <span>View task details</span>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default CalendarEventPopover;
