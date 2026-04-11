import { useEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface StaffDashboardHandlers {
  onDisputeCreated?: (payload: any) => void;
  onDisputeStatusChanged?: (payload: any) => void;
  onDisputeAssigned?: (payload: any) => void;
  onDisputeReassigned?: (payload: any) => void;
  onDisputeInfoRequested?: (payload: any) => void;
  onDisputeInfoProvided?: (payload: any) => void;
  onDisputeDefendantResponded?: (payload: any) => void;
  onDisputeResolved?: (payload: any) => void;
  onDisputeClosed?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
  onHearingScheduled?: (payload: any) => void;
  onHearingRescheduled?: (payload: any) => void;
  onHearingStarted?: (payload: any) => void;
  onHearingPaused?: (payload: any) => void;
  onHearingResumed?: (payload: any) => void;
  onHearingInviteResponded?: (payload: any) => void;
  onHearingFollowUpScheduled?: (payload: any) => void;
  onHearingSupportInvited?: (payload: any) => void;
  onHearingReminderSent?: (payload: any) => void;
  onHearingModeratorDisconnected?: (payload: any) => void;
  onHearingModeratorReconnected?: (payload: any) => void;
  onVerdictIssued?: (payload: any) => void;
  onAppealSubmitted?: (payload: any) => void;
  onAppealResolved?: (payload: any) => void;
  onCalendarEventCreated?: (payload: any) => void;
  onCalendarEventUpdated?: (payload: any) => void;
  onCalendarRescheduleRequested?: (payload: any) => void;
  onCalendarRescheduleProcessed?: (payload: any) => void;
  onCalendarInviteResponded?: (payload: any) => void;
  onStaffOverloaded?: (payload: any) => void;
}

export const useStaffDashboardRealtime = (handlers?: StaffDashboardHandlers) => {
  useEffect(() => {
    const socket = connectSocket();
    socket.emit("joinStaffDashboard");

    if (handlers?.onDisputeCreated) {
      socket.on("DISPUTE_CREATED", handlers.onDisputeCreated);
    }
    if (handlers?.onDisputeStatusChanged) {
      socket.on("DISPUTE_STATUS_CHANGED", handlers.onDisputeStatusChanged);
    }
    if (handlers?.onDisputeAssigned) {
      socket.on("DISPUTE_ASSIGNED", handlers.onDisputeAssigned);
    }
    if (handlers?.onDisputeReassigned) {
      socket.on("DISPUTE_REASSIGNED", handlers.onDisputeReassigned);
    }
    if (handlers?.onDisputeInfoRequested) {
      socket.on("DISPUTE_INFO_REQUESTED", handlers.onDisputeInfoRequested);
    }
    if (handlers?.onDisputeInfoProvided) {
      socket.on("DISPUTE_INFO_PROVIDED", handlers.onDisputeInfoProvided);
    }
    if (handlers?.onDisputeDefendantResponded) {
      socket.on("DISPUTE_DEFENDANT_RESPONDED", handlers.onDisputeDefendantResponded);
    }
    if (handlers?.onDisputeResolved) {
      socket.on("DISPUTE_RESOLVED", handlers.onDisputeResolved);
    }
    if (handlers?.onDisputeClosed) {
      socket.on("DISPUTE_CLOSED", handlers.onDisputeClosed);
    }
    if (handlers?.onHearingEnded) {
      socket.on("HEARING_ENDED", handlers.onHearingEnded);
    }
    if (handlers?.onHearingScheduled) {
      socket.on("HEARING_SCHEDULED", handlers.onHearingScheduled);
    }
    if (handlers?.onHearingRescheduled) {
      socket.on("HEARING_RESCHEDULED", handlers.onHearingRescheduled);
    }
    if (handlers?.onHearingStarted) {
      socket.on("HEARING_STARTED", handlers.onHearingStarted);
    }
    if (handlers?.onHearingPaused) {
      socket.on("HEARING_PAUSED", handlers.onHearingPaused);
    }
    if (handlers?.onHearingResumed) {
      socket.on("HEARING_RESUMED", handlers.onHearingResumed);
    }
    if (handlers?.onHearingInviteResponded) {
      socket.on("HEARING_INVITE_RESPONDED", handlers.onHearingInviteResponded);
    }
    if (handlers?.onHearingFollowUpScheduled) {
      socket.on("HEARING_FOLLOW_UP_SCHEDULED", handlers.onHearingFollowUpScheduled);
    }
    if (handlers?.onHearingSupportInvited) {
      socket.on("HEARING_SUPPORT_INVITED", handlers.onHearingSupportInvited);
    }
    if (handlers?.onHearingReminderSent) {
      socket.on("HEARING_REMINDER_SENT", handlers.onHearingReminderSent);
    }
    if (handlers?.onHearingModeratorDisconnected) {
      socket.on("HEARING_MODERATOR_DISCONNECTED", handlers.onHearingModeratorDisconnected);
    }
    if (handlers?.onHearingModeratorReconnected) {
      socket.on("HEARING_MODERATOR_RECONNECTED", handlers.onHearingModeratorReconnected);
    }
    if (handlers?.onVerdictIssued) {
      socket.on("VERDICT_ISSUED", handlers.onVerdictIssued);
    }
    if (handlers?.onAppealSubmitted) {
      socket.on("APPEAL_SUBMITTED", handlers.onAppealSubmitted);
    }
    if (handlers?.onAppealResolved) {
      socket.on("APPEAL_RESOLVED", handlers.onAppealResolved);
    }
    if (handlers?.onCalendarEventCreated) {
      socket.on("CALENDAR_EVENT_CREATED", handlers.onCalendarEventCreated);
    }
    if (handlers?.onCalendarEventUpdated) {
      socket.on("CALENDAR_EVENT_UPDATED", handlers.onCalendarEventUpdated);
    }
    if (handlers?.onCalendarRescheduleRequested) {
      socket.on("CALENDAR_RESCHEDULE_REQUESTED", handlers.onCalendarRescheduleRequested);
    }
    if (handlers?.onCalendarRescheduleProcessed) {
      socket.on("CALENDAR_RESCHEDULE_PROCESSED", handlers.onCalendarRescheduleProcessed);
    }
    if (handlers?.onCalendarInviteResponded) {
      socket.on("CALENDAR_INVITE_RESPONDED", handlers.onCalendarInviteResponded);
    }
    if (handlers?.onStaffOverloaded) {
      socket.on("STAFF_OVERLOADED", handlers.onStaffOverloaded);
    }

    return () => {
      socket.emit("leaveStaffDashboard");
      if (handlers?.onDisputeCreated) {
        socket.off("DISPUTE_CREATED", handlers.onDisputeCreated);
      }
      if (handlers?.onDisputeStatusChanged) {
        socket.off("DISPUTE_STATUS_CHANGED", handlers.onDisputeStatusChanged);
      }
      if (handlers?.onDisputeAssigned) {
        socket.off("DISPUTE_ASSIGNED", handlers.onDisputeAssigned);
      }
      if (handlers?.onDisputeReassigned) {
        socket.off("DISPUTE_REASSIGNED", handlers.onDisputeReassigned);
      }
      if (handlers?.onDisputeInfoRequested) {
        socket.off("DISPUTE_INFO_REQUESTED", handlers.onDisputeInfoRequested);
      }
      if (handlers?.onDisputeInfoProvided) {
        socket.off("DISPUTE_INFO_PROVIDED", handlers.onDisputeInfoProvided);
      }
      if (handlers?.onDisputeDefendantResponded) {
        socket.off("DISPUTE_DEFENDANT_RESPONDED", handlers.onDisputeDefendantResponded);
      }
      if (handlers?.onDisputeResolved) {
        socket.off("DISPUTE_RESOLVED", handlers.onDisputeResolved);
      }
      if (handlers?.onDisputeClosed) {
        socket.off("DISPUTE_CLOSED", handlers.onDisputeClosed);
      }
      if (handlers?.onHearingEnded) {
        socket.off("HEARING_ENDED", handlers.onHearingEnded);
      }
      if (handlers?.onHearingScheduled) {
        socket.off("HEARING_SCHEDULED", handlers.onHearingScheduled);
      }
      if (handlers?.onHearingRescheduled) {
        socket.off("HEARING_RESCHEDULED", handlers.onHearingRescheduled);
      }
      if (handlers?.onHearingStarted) {
        socket.off("HEARING_STARTED", handlers.onHearingStarted);
      }
      if (handlers?.onHearingPaused) {
        socket.off("HEARING_PAUSED", handlers.onHearingPaused);
      }
      if (handlers?.onHearingResumed) {
        socket.off("HEARING_RESUMED", handlers.onHearingResumed);
      }
      if (handlers?.onHearingInviteResponded) {
        socket.off("HEARING_INVITE_RESPONDED", handlers.onHearingInviteResponded);
      }
      if (handlers?.onHearingFollowUpScheduled) {
        socket.off("HEARING_FOLLOW_UP_SCHEDULED", handlers.onHearingFollowUpScheduled);
      }
      if (handlers?.onHearingSupportInvited) {
        socket.off("HEARING_SUPPORT_INVITED", handlers.onHearingSupportInvited);
      }
      if (handlers?.onHearingReminderSent) {
        socket.off("HEARING_REMINDER_SENT", handlers.onHearingReminderSent);
      }
      if (handlers?.onHearingModeratorDisconnected) {
        socket.off("HEARING_MODERATOR_DISCONNECTED", handlers.onHearingModeratorDisconnected);
      }
      if (handlers?.onHearingModeratorReconnected) {
        socket.off("HEARING_MODERATOR_RECONNECTED", handlers.onHearingModeratorReconnected);
      }
      if (handlers?.onVerdictIssued) {
        socket.off("VERDICT_ISSUED", handlers.onVerdictIssued);
      }
      if (handlers?.onAppealSubmitted) {
        socket.off("APPEAL_SUBMITTED", handlers.onAppealSubmitted);
      }
      if (handlers?.onAppealResolved) {
        socket.off("APPEAL_RESOLVED", handlers.onAppealResolved);
      }
      if (handlers?.onCalendarEventCreated) {
        socket.off("CALENDAR_EVENT_CREATED", handlers.onCalendarEventCreated);
      }
      if (handlers?.onCalendarEventUpdated) {
        socket.off("CALENDAR_EVENT_UPDATED", handlers.onCalendarEventUpdated);
      }
      if (handlers?.onCalendarRescheduleRequested) {
        socket.off("CALENDAR_RESCHEDULE_REQUESTED", handlers.onCalendarRescheduleRequested);
      }
      if (handlers?.onCalendarRescheduleProcessed) {
        socket.off("CALENDAR_RESCHEDULE_PROCESSED", handlers.onCalendarRescheduleProcessed);
      }
      if (handlers?.onCalendarInviteResponded) {
        socket.off("CALENDAR_INVITE_RESPONDED", handlers.onCalendarInviteResponded);
      }
      if (handlers?.onStaffOverloaded) {
        socket.off("STAFF_OVERLOADED", handlers.onStaffOverloaded);
      }
    };
  }, [
    handlers?.onDisputeCreated,
    handlers?.onDisputeStatusChanged,
    handlers?.onDisputeAssigned,
    handlers?.onDisputeReassigned,
    handlers?.onDisputeInfoRequested,
    handlers?.onDisputeInfoProvided,
    handlers?.onDisputeDefendantResponded,
    handlers?.onDisputeResolved,
    handlers?.onDisputeClosed,
    handlers?.onHearingEnded,
    handlers?.onHearingScheduled,
    handlers?.onHearingRescheduled,
    handlers?.onHearingStarted,
    handlers?.onHearingPaused,
    handlers?.onHearingResumed,
    handlers?.onHearingInviteResponded,
    handlers?.onHearingFollowUpScheduled,
    handlers?.onHearingSupportInvited,
    handlers?.onHearingReminderSent,
    handlers?.onHearingModeratorDisconnected,
    handlers?.onHearingModeratorReconnected,
    handlers?.onVerdictIssued,
    handlers?.onAppealSubmitted,
    handlers?.onAppealResolved,
    handlers?.onCalendarEventCreated,
    handlers?.onCalendarEventUpdated,
    handlers?.onCalendarRescheduleRequested,
    handlers?.onCalendarRescheduleProcessed,
    handlers?.onCalendarInviteResponded,
    handlers?.onStaffOverloaded,
  ]);
};
