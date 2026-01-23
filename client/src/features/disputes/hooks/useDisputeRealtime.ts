import { useEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface DisputeRealtimeHandlers {
  onEvidenceUploaded?: (payload: any) => void;
  onMessageSent?: (payload: any) => void;
  onMessageHidden?: (payload: any) => void;
  onVerdictIssued?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
  onSettlementOffered?: (payload: any) => void;
  onAppealDeadlinePassed?: (payload: any) => void;
}

export const useDisputeRealtime = (
  disputeId?: string,
  handlers?: DisputeRealtimeHandlers,
) => {
  useEffect(() => {
    if (!disputeId) return;

    const socket = connectSocket();
    socket.emit("joinDispute", { disputeId });

    if (handlers?.onEvidenceUploaded) {
      socket.on("EVIDENCE_UPLOADED", handlers.onEvidenceUploaded);
    }
    if (handlers?.onMessageSent) {
      socket.on("MESSAGE_SENT", handlers.onMessageSent);
    }
    if (handlers?.onMessageHidden) {
      socket.on("MESSAGE_HIDDEN", handlers.onMessageHidden);
    }
    if (handlers?.onVerdictIssued) {
      socket.on("VERDICT_ISSUED", handlers.onVerdictIssued);
    }
    if (handlers?.onHearingEnded) {
      socket.on("HEARING_ENDED", handlers.onHearingEnded);
    }
    if (handlers?.onSettlementOffered) {
      socket.on("SETTLEMENT_OFFERED", handlers.onSettlementOffered);
    }
    if (handlers?.onAppealDeadlinePassed) {
      socket.on("APPEAL_DEADLINE_PASSED", handlers.onAppealDeadlinePassed);
    }

    return () => {
      socket.emit("leaveDispute", { disputeId });
      if (handlers?.onEvidenceUploaded) {
        socket.off("EVIDENCE_UPLOADED", handlers.onEvidenceUploaded);
      }
      if (handlers?.onMessageSent) {
        socket.off("MESSAGE_SENT", handlers.onMessageSent);
      }
      if (handlers?.onMessageHidden) {
        socket.off("MESSAGE_HIDDEN", handlers.onMessageHidden);
      }
      if (handlers?.onVerdictIssued) {
        socket.off("VERDICT_ISSUED", handlers.onVerdictIssued);
      }
      if (handlers?.onHearingEnded) {
        socket.off("HEARING_ENDED", handlers.onHearingEnded);
      }
      if (handlers?.onSettlementOffered) {
        socket.off("SETTLEMENT_OFFERED", handlers.onSettlementOffered);
      }
      if (handlers?.onAppealDeadlinePassed) {
        socket.off("APPEAL_DEADLINE_PASSED", handlers.onAppealDeadlinePassed);
      }
    };
  }, [
    disputeId,
    handlers?.onEvidenceUploaded,
    handlers?.onMessageSent,
    handlers?.onMessageHidden,
    handlers?.onVerdictIssued,
    handlers?.onHearingEnded,
    handlers?.onSettlementOffered,
    handlers?.onAppealDeadlinePassed,
  ]);
};
