import { useState, useCallback, useMemo } from "react";
import { Calendar } from "react-big-calendar";
import { format, addMonths, subMonths } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { cn } from "@/lib/utils";
import type { Task } from "../types";

// Import modular calendar components
import {
  CalendarToolbar,
  CalendarEventPopover,
  localizer,
  EVENT_STYLES,
  getEventInlineStyles,
  tasksToCalendarEvents,
  type CalendarViewType,
  type CalendarEvent,
} from "./calendar";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CalendarViewProps = {
  tasks: Task[];
  onViewTaskDetails?: (taskId: string) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR LEGEND COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function CalendarLegend() {
  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Event Types
        </span>
        <div className="flex items-center gap-4">
          {Object.entries(EVENT_STYLES).map(([type, style]) => {
            const Icon = style.icon;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-3 h-3 rounded-sm border",
                    style.bg,
                    style.border
                  )}
                />
                <Icon className={cn("h-3.5 w-3.5", style.text)} />
                <span className="text-xs text-gray-600">{style.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CalendarView - Main workspace calendar container
 * Displays tasks as calendar events with modern InterDev design
 */
export function CalendarView({ tasks, onViewTaskDetails }: CalendarViewProps) {
  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────

  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarViewType>("month");

  // Popover state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

  // ─────────────────────────────────────────────────────────────────────────
  // MEMOIZED DATA
  // ─────────────────────────────────────────────────────────────────────────

  const events = useMemo(() => tasksToCalendarEvents(tasks), [tasks]);

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  // Handle event click - show popover
  const handleSelectEvent = useCallback(
    (event: CalendarEvent, e: React.SyntheticEvent) => {
      const target = e.target as HTMLElement;
      const rect = target.getBoundingClientRect();

      setPopoverPosition({
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 8,
      });
      setSelectedEvent(event);
    },
    []
  );

  // Close popover
  const closePopover = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Handle calendar navigation
  const handleNavigate = useCallback(
    (action: "PREV" | "NEXT" | "TODAY") => {
      if (action === "TODAY") {
        setDate(new Date());
      } else if (action === "PREV") {
        setDate((prev) => subMonths(prev, 1));
      } else {
        setDate((prev) => addMonths(prev, 1));
      }
    },
    []
  );

  // Handle view change
  const handleViewChange = useCallback((newView: CalendarViewType) => {
    setView(newView);
  }, []);

  // Day prop getter for highlighting today
  const dayPropGetter = useCallback((day: Date) => {
    const isToday =
      format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
    return {
      style: isToday ? { backgroundColor: "#f0fdfa" } : {},
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Custom Toolbar */}
      <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50">
        <CalendarToolbar
          date={date}
          view={view}
          onNavigate={handleNavigate}
          onViewChange={handleViewChange}
        />
      </div>

      {/* Calendar Grid */}
      <div className="px-4 pb-4">
        <div className="h-[550px] interdev-calendar">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            eventPropGetter={getEventInlineStyles}
            onSelectEvent={handleSelectEvent}
            views={["month", "week", "day", "agenda"]}
            date={date}
            view={view}
            onNavigate={setDate}
            onView={setView}
            toolbar={false}
            popup
            showMultiDayTimes
            dayPropGetter={dayPropGetter}
          />
        </div>
      </div>

      {/* Legend */}
      <CalendarLegend />

      {/* Event Popover */}
      <CalendarEventPopover
        event={selectedEvent}
        position={popoverPosition}
        onClose={closePopover}
        onViewDetails={onViewTaskDetails}
      />

      {/* Custom CSS for react-big-calendar */}
      <style>{`
        .interdev-calendar .rbc-header {
          padding: 12px 8px;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          background-color: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .interdev-calendar .rbc-month-view {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
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
          background-color: #f0fdfa !important;
        }
        
        .interdev-calendar .rbc-date-cell {
          padding: 4px 8px;
          text-align: right;
          font-size: 0.875rem;
          color: #475569;
        }
        
        .interdev-calendar .rbc-date-cell.rbc-now {
          font-weight: 700;
          color: #0d9488;
        }
        
        .interdev-calendar .rbc-event {
          border-radius: 4px !important;
          font-size: 0.8rem !important;
        }
        
        .interdev-calendar .rbc-event:hover {
          opacity: 0.9;
          transform: scale(1.02);
          transition: all 0.15s ease;
        }
        
        .interdev-calendar .rbc-event-content {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .interdev-calendar .rbc-show-more {
          color: #0d9488;
          font-weight: 500;
          font-size: 0.75rem;
        }
        
        .interdev-calendar .rbc-agenda-view table {
          border-collapse: separate;
          border-spacing: 0;
        }
        
        .interdev-calendar .rbc-agenda-view .rbc-agenda-date-cell,
        .interdev-calendar .rbc-agenda-view .rbc-agenda-time-cell {
          padding: 8px 12px;
          white-space: nowrap;
          color: #475569;
          font-size: 0.875rem;
        }
        
        .interdev-calendar .rbc-agenda-view .rbc-agenda-event-cell {
          padding: 8px 12px;
        }
        
        .interdev-calendar .rbc-time-view {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        
        .interdev-calendar .rbc-time-header {
          border-bottom: 1px solid #e2e8f0;
        }
        
        .interdev-calendar .rbc-time-content {
          border-top: none;
        }
        
        .interdev-calendar .rbc-current-time-indicator {
          background-color: #0d9488;
          height: 2px;
        }
      `}</style>
    </div>
  );
}

export default CalendarView;
