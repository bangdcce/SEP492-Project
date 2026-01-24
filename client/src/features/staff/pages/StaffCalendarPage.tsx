import { useEffect, useState } from "react";
import { format } from "date-fns";
import { StaffCalendarView } from "../../calendar/components/grid/StaffCalendarView";
import { RescheduleNegotiator } from "../../calendar/components/negotiation/RescheduleNegotiator";
import { getEvents } from "../../calendar/api";
import { EventStatus, EventType, type CalendarEvent } from "../../calendar/types";

export const StaffCalendarPage = () => {
  const [nextHearing, setNextHearing] = useState<CalendarEvent | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);

  useEffect(() => {
    const loadNextHearing = async () => {
      try {
        setLoadingNext(true);
        const now = new Date();
        const data = await getEvents({
          type: EventType.DISPUTE_HEARING,
          startDate: now.toISOString(),
        });
        const upcoming = (data.items || [])
          .filter((event) =>
            [EventStatus.SCHEDULED, EventStatus.PENDING_CONFIRMATION].includes(
              event.status,
            ),
          )
          .sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          )[0];
        setNextHearing(upcoming || null);
      } catch (error) {
        console.error("Failed to load next hearing:", error);
      } finally {
        setLoadingNext(false);
      }
    };

    loadNextHearing();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Hearing Calendar
          </h2>
          <p className="text-gray-500">
            Manage dispute hearings and mediation sessions.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Demo Buttons to toggle views if needed, for now just static */}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Calendar View (Grid) */}
        <div className="xl:col-span-2">
          <StaffCalendarView />
        </div>

        {/* Sidebar: Negotiation Requests & Upcoming */}
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">
              Pending Reschedule Requests
            </h3>
            {/* Demo of the Reschedule Component */}
            <RescheduleNegotiator />
          </div>

          <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
            <h4 className="font-medium text-teal-900 mb-2">Next Hearing</h4>
            {loadingNext ? (
              <p className="text-sm text-teal-700">Loading next hearing...</p>
            ) : nextHearing ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="bg-white p-2 rounded-lg border border-teal-100 text-center min-w-[60px]">
                    <span className="block text-xs font-bold text-teal-600 uppercase">
                      {format(new Date(nextHearing.startTime), "MMM d")}
                    </span>
                    <span className="block text-lg font-bold text-slate-900">
                      {format(new Date(nextHearing.startTime), "HH:mm")}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {nextHearing.title}
                    </p>
                    <p className="text-xs text-teal-700">
                      {format(new Date(nextHearing.startTime), "h:mm a")} -{" "}
                      {format(new Date(nextHearing.endTime), "h:mm a")}
                    </p>
                  </div>
                </div>
                {nextHearing.externalMeetingLink ? (
                  <a
                    href={nextHearing.externalMeetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full mt-3 inline-flex justify-center bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium py-2 rounded-lg transition-colors"
                  >
                    Join Room
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full mt-3 bg-teal-200 text-teal-900 text-xs font-medium py-2 rounded-lg opacity-70"
                  >
                    Meeting link pending
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-teal-700">
                No upcoming hearings scheduled.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
