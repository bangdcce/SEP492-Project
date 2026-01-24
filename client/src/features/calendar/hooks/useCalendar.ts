import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getEvents } from "../api";
import type { CalendarEvent, CalendarEventFilter } from "../types";

export const useCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (filter?: CalendarEventFilter) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEvents(filter);
      setEvents(data.items || []);
    } catch (err: any) {
      console.error("Failed to fetch calendar events:", err);
      setError(err.message || "Failed to load events");
      toast.error("Could not load calendar events");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    events,
    loading,
    error,
    fetchEvents,
  };
};
