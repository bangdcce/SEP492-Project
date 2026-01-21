import { useRef, useEffect } from "react";
import { format } from "date-fns";
import { X, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_STYLES, type CalendarEvent } from "./CalendarConfig";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CalendarEventPopoverProps = {
  event: CalendarEvent | null;
  position: { x: number; y: number };
  onClose: () => void;
  onViewDetails?: (taskId: string) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    TODO: { bg: "bg-slate-100", text: "text-slate-700" },
    IN_PROGRESS: { bg: "bg-sky-100", text: "text-sky-700" },
    DONE: { bg: "bg-emerald-100", text: "text-emerald-700" },
  };

  const config = statusConfig[status] ?? statusConfig.TODO;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide",
        config.bg,
        config.text
      )}
    >
      {status?.replace(/_/g, " ")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Event Popover Component
 * Shows detailed information when clicking an event
 * Follows InterDev design system with dynamic theming
 */
export function CalendarEventPopover({
  event,
  position,
  onClose,
  onViewDetails,
}: CalendarEventPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // CLICK OUTSIDE HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (event) {
      // Small delay to prevent immediate close on the triggering click
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [event, onClose]);

  // ─────────────────────────────────────────────────────────────────────────
  // ESCAPE KEY HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (event) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [event, onClose]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (!event) return null;

  const task = event.resource;
  const style = EVENT_STYLES[event.eventType];
  const Icon = style.icon;

  // Calculate position to keep popover in viewport
  const adjustedX = Math.min(position.x, window.innerWidth - 340);
  const adjustedY = Math.min(position.y, window.innerHeight - 360);

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(task.id);
    } else {
      console.log("Navigate to task:", task.id);
    }
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{ left: adjustedX, top: adjustedY }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popover-title"
    >
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* HEADER - Dynamic color based on event type                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "px-4 py-3 flex items-center justify-between",
          style.bg,
          "border-b",
          style.border
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 flex-shrink-0", style.text)} />
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              style.text
            )}
          >
            {style.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className={cn(
            "p-1 rounded-md transition-colors",
            "hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1",
            `focus:ring-${style.text.split("-")[1]}-500`
          )}
          aria-label="Close popover"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* BODY - Event details                                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <h3
          id="popover-title"
          className="text-lg font-bold text-slate-900 leading-tight"
        >
          {event.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Date Row */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">
            {format(event.start, "MMM d, yyyy")}
            {event.start.getTime() !== event.end.getTime() && (
              <span className="text-gray-400">
                {" "}
                — {format(event.end, "MMM d, yyyy")}
              </span>
            )}
          </span>
        </div>

        {/* Status Row */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Status:
          </span>
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* FOOTER - CTA Button                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <button
          onClick={handleViewDetails}
          className={cn(
            "w-full flex items-center justify-center gap-2",
            "px-4 py-2.5 rounded-lg",
            "text-sm font-semibold text-white",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-2",
            style.buttonBg
          )}
        >
          <span>View Task Details</span>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default CalendarEventPopover;
