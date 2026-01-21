import { useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { Task } from "../types";

// Define view type locally since react-big-calendar doesn't export it properly
type CalendarView = "month" | "week" | "work_week" | "day" | "agenda";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type CalendarViewProps = {
  tasks: Task[];
};

// Define local interface for calendar events
interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Task;
  allDay?: boolean;
}

export function CalendarView({ tasks }: CalendarViewProps) {
  // State for calendar navigation and view
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");

  // Convert tasks to calendar events
  const events: CalendarEvent[] = tasks
    .filter((task) => task.dueDate) // Only include tasks with due dates
    .map((task) => {
      const dueDate = new Date(task.dueDate!);

      return {
        title: task.title,
        start: dueDate,
        end: dueDate,
        resource: task,
      };
    });

  // Custom event style based on task status
  const eventStyleGetter = (event: CalendarEvent) => {
    const task = event.resource;
    let backgroundColor = "#94a3b8"; // Default gray for TODO
    let borderColor = "#64748b";

    if (task.status === "DONE") {
      backgroundColor = "#10b981"; // Green
      borderColor = "#059669";
    } else if (task.status === "IN_PROGRESS") {
      backgroundColor = "#14b8a6"; // Teal
      borderColor = "#0d9488";
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderRadius: "6px",
        border: `2px solid ${borderColor}`,
        color: "white",
        fontWeight: 500,
        fontSize: "0.875rem",
        padding: "2px 6px",
      },
    };
  };

  // Handle event click
  const handleSelectEvent = (event: CalendarEvent) => {
    const task = event.resource;
    console.log("Task clicked:", task);
    // Future: Open task details modal
  };

  // Handle calendar navigation
  const handleNavigate = (newDate: Date) => {
    setDate(newDate);
  };

  // Handle view change
  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="h-[600px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          views={["month", "week", "day", "agenda"]}
          date={date}
          view={view}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          popup
          showMultiDayTimes
          tooltipAccessor={(event: CalendarEvent) => {
            const task = event.resource;
            return `${task.title} - ${task.status}${
              task.description ? `\n${task.description}` : ""
            }`;
          }}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#94a3b8] rounded border-2 border-[#64748b]"></div>
          <span className="text-slate-700">TODO</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#14b8a6] rounded border-2 border-[#0d9488]"></div>
          <span className="text-slate-700">IN PROGRESS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#10b981] rounded border-2 border-[#059669]"></div>
          <span className="text-slate-700">DONE</span>
        </div>
      </div>
    </div>
  );
}
