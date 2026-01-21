import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarViewType } from "./CalendarConfig";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CalendarToolbarProps = {
  date: Date;
  view: CalendarViewType;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
  onViewChange: (view: CalendarViewType) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEW OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { key: CalendarViewType; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "agenda", label: "Agenda" },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Custom Calendar Toolbar Component
 * Modern header with navigation and view controls following InterDev design
 */
export function CalendarToolbar({
  date,
  view,
  onNavigate,
  onViewChange,
}: CalendarToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate("TODAY")}
          className="px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
        >
          Today
        </button>
        <div className="flex items-center">
          <button
            onClick={() => onNavigate("PREV")}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => onNavigate("NEXT")}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 ml-2">
          {format(date, "MMMM yyyy")}
        </h2>
      </div>

      {/* View Switcher */}
      <div className="flex items-center bg-gray-100 rounded-lg p-1">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onViewChange(opt.key)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              view === opt.key
                ? "bg-white text-teal-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CalendarToolbar;
