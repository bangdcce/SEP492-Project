import { useEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface StaffDashboardHandlers {
  onDisputeCreated?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
  onHearingScheduled?: (payload: any) => void;
  onHearingRescheduled?: (payload: any) => void;
  onHearingStarted?: (payload: any) => void;
  onHearingPaused?: (payload: any) => void;
  onHearingResumed?: (payload: any) => void;
  onHearingInviteResponded?: (payload: any) => void;
  onHearingFollowUpScheduled?: (payload: any) => void;
  onVerdictIssued?: (payload: any) => void;
  onStaffOverloaded?: (payload: any) => void;
}

export const useStaffDashboardRealtime = (handlers?: StaffDashboardHandlers) => {
  useEffect(() => {
    const socket = connectSocket();
    socket.emit("joinStaffDashboard");

    if (handlers?.onDisputeCreated) {
      socket.on("DISPUTE_CREATED", handlers.onDisputeCreated);
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
    if (handlers?.onVerdictIssued) {
      socket.on("VERDICT_ISSUED", handlers.onVerdictIssued);
    }
    if (handlers?.onStaffOverloaded) {
      socket.on("STAFF_OVERLOADED", handlers.onStaffOverloaded);
    }

    return () => {
      socket.emit("leaveStaffDashboard");
      if (handlers?.onDisputeCreated) {
        socket.off("DISPUTE_CREATED", handlers.onDisputeCreated);
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
      if (handlers?.onVerdictIssued) {
        socket.off("VERDICT_ISSUED", handlers.onVerdictIssued);
      }
      if (handlers?.onStaffOverloaded) {
        socket.off("STAFF_OVERLOADED", handlers.onStaffOverloaded);
      }
    };
  }, [
    handlers?.onDisputeCreated,
    handlers?.onHearingEnded,
    handlers?.onHearingScheduled,
    handlers?.onHearingRescheduled,
    handlers?.onHearingStarted,
    handlers?.onHearingPaused,
    handlers?.onHearingResumed,
    handlers?.onHearingInviteResponded,
    handlers?.onHearingFollowUpScheduled,
    handlers?.onVerdictIssued,
    handlers?.onStaffOverloaded,
  ]);
};
