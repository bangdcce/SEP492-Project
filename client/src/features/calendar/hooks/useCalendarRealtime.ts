import { useEffect, useLayoutEffect, useRef } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface CalendarRealtimeHandlers {
  onCalendarEventCreated?: (payload: any) => void;
  onCalendarEventUpdated?: (payload: any) => void;
  onCalendarRescheduleRequested?: (payload: any) => void;
  onCalendarRescheduleProcessed?: (payload: any) => void;
  onCalendarInviteResponded?: (payload: any) => void;
  onCalendarAvailabilityUpdated?: (payload: any) => void;
  onCalendarAvailabilityDeleted?: (payload: any) => void;
}

export const useCalendarRealtime = (handlers?: CalendarRealtimeHandlers) => {
  const handlersRef = useRef(handlers);

  useLayoutEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const socket = connectSocket();

    const onCalendarEventCreated = (payload: any) => {
      handlersRef.current?.onCalendarEventCreated?.(payload);
    };
    const onCalendarEventUpdated = (payload: any) => {
      handlersRef.current?.onCalendarEventUpdated?.(payload);
    };
    const onCalendarRescheduleRequested = (payload: any) => {
      handlersRef.current?.onCalendarRescheduleRequested?.(payload);
    };
    const onCalendarRescheduleProcessed = (payload: any) => {
      handlersRef.current?.onCalendarRescheduleProcessed?.(payload);
    };
    const onCalendarInviteResponded = (payload: any) => {
      handlersRef.current?.onCalendarInviteResponded?.(payload);
    };
    const onCalendarAvailabilityUpdated = (payload: any) => {
      handlersRef.current?.onCalendarAvailabilityUpdated?.(payload);
    };
    const onCalendarAvailabilityDeleted = (payload: any) => {
      handlersRef.current?.onCalendarAvailabilityDeleted?.(payload);
    };

    socket.on("CALENDAR_EVENT_CREATED", onCalendarEventCreated);
    socket.on("CALENDAR_EVENT_UPDATED", onCalendarEventUpdated);
    socket.on("CALENDAR_RESCHEDULE_REQUESTED", onCalendarRescheduleRequested);
    socket.on("CALENDAR_RESCHEDULE_PROCESSED", onCalendarRescheduleProcessed);
    socket.on("CALENDAR_INVITE_RESPONDED", onCalendarInviteResponded);
    socket.on("CALENDAR_AVAILABILITY_UPDATED", onCalendarAvailabilityUpdated);
    socket.on("CALENDAR_AVAILABILITY_DELETED", onCalendarAvailabilityDeleted);

    return () => {
      socket.off("CALENDAR_EVENT_CREATED", onCalendarEventCreated);
      socket.off("CALENDAR_EVENT_UPDATED", onCalendarEventUpdated);
      socket.off("CALENDAR_RESCHEDULE_REQUESTED", onCalendarRescheduleRequested);
      socket.off("CALENDAR_RESCHEDULE_PROCESSED", onCalendarRescheduleProcessed);
      socket.off("CALENDAR_INVITE_RESPONDED", onCalendarInviteResponded);
      socket.off("CALENDAR_AVAILABILITY_UPDATED", onCalendarAvailabilityUpdated);
      socket.off("CALENDAR_AVAILABILITY_DELETED", onCalendarAvailabilityDeleted);
    };
  }, []);
};
