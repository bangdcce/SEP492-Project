import { useEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface StaffDashboardHandlers {
  onDisputeCreated?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
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
    handlers?.onVerdictIssued,
    handlers?.onStaffOverloaded,
  ]);
};
