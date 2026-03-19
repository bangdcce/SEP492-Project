import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarViewType } from "./CalendarConfig";

type CalendarToolbarProps = {
  date: Date;
  view: CalendarViewType;
  taskCount: number;
  selectedMilestoneLabel?: string | null;
  onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
  onViewChange: (view: CalendarViewType) => void;
};

const VIEW_OPTIONS: { key: CalendarViewType; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "agenda", label: "Agenda" },
];

export function CalendarToolbar({
  date,
  view,
  taskCount,
  selectedMilestoneLabel,
  onNavigate,
  onViewChange,
}: CalendarToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 border-b border-slate-200 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate("TODAY")}
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100"
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              onClick={() => onNavigate("PREV")}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => onNavigate("NEXT")}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="ml-2">
            <h2 className="text-lg font-semibold text-slate-900">{format(date, "MMMM yyyy")}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {selectedMilestoneLabel ? (
                <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-700">
                  Milestone: {selectedMilestoneLabel}
                </span>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600">
                  All scheduled tasks
                </span>
              )}
              <span>{taskCount} task{taskCount === 1 ? "" : "s"} on the calendar</span>
            </div>
          </div>
        </div>

        <div className="flex items-center rounded-xl bg-slate-100 p-1">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => onViewChange(option.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === option.key
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CalendarToolbar;
