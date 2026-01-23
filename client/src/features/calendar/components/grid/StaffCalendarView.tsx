import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useCalendar } from "../../hooks/useCalendar";

export const StaffCalendarView = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { events, fetchEvents, loading } = useCalendar();
  const startDate = startOfWeek(currentDate);

  useEffect(() => {
    // Fetch events for the current week window
    // Ideally pass startDate and endDate to filter query
    const startStr = startOfWeek(currentDate).toISOString();
    const endStr = addDays(startOfWeek(currentDate), 7).toISOString();
    fetchEvents({ startDate: startStr, endDate: endStr });
  }, [currentDate, fetchEvents]);

  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(startDate, i),
  );

  const hours = Array.from({ length: 11 }).map(
    (_, i) => i + 8, // 8 AM to 6 PM
  );

  const getSlotsForCell = (day: Date, hour: number) => {
    return events.filter((slot) => {
      const slotStart = new Date(slot.startTime);
      return isSameDay(slotStart, day) && slotStart.getHours() === hour;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[600px] relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">
          {format(currentDate, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-sm font-medium text-teal-600 hover:bg-teal-50 px-3 py-1 rounded"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-8 border-b border-gray-200">
            <div className="p-3 text-xs font-medium text-gray-400 border-r border-gray-100">
              GMT+7
            </div>
            {weekDays.map((day) => (
              <div
                key={day.toString()}
                className={`p-3 text-center border-r border-gray-100 ${
                  isSameDay(day, new Date()) ? "bg-teal-50" : ""
                }`}
              >
                <p className="text-xs font-medium text-gray-500">
                  {format(day, "EEE")}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    isSameDay(day, new Date())
                      ? "text-teal-600"
                      : "text-slate-900"
                  }`}
                >
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-8 border-b border-gray-100"
            >
              {/* Time Label */}
              <div className="p-3 text-xs text-gray-500 text-right font-medium border-r border-gray-100">
                {format(new Date().setHours(hour), "h a")}
              </div>

              {/* Day Cells */}
              {weekDays.map((day) => {
                const slots = getSlotsForCell(day, hour);
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="border-r border-gray-100 p-1 min-h-[80px] hover:bg-gray-50 transition-colors relative"
                  >
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-2 rounded text-xs mb-1 cursor-pointer hover:bg-indigo-100"
                      >
                        <div className="font-semibold truncate">
                          {slot.title}
                        </div>
                        <div className="flex items-center gap-1 mt-1 opacity-75">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(new Date(slot.startTime), "h:mm")} -{" "}
                            {format(new Date(slot.endTime), "h:mm a")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
