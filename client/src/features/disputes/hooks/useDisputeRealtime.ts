import { useEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface DisputeRealtimeHandlers {
  onEvidenceUploaded?: (payload: any) => void;
  onMessageSent?: (payload: any) => void;
  onMessageHidden?: (payload: any) => void;
  onVerdictIssued?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
  onSettlementOffered?: (payload: any) => void;
  onSettlementAccepted?: (payload: any) => void;
  onSettlementRejected?: (payload: any) => void;
  onSettlementChatUnlocked?: (payload: any) => void;
  onDisputeStatusChanged?: (payload: any) => void;
  onDisputeAssigned?: (payload: any) => void;
  onDisputeReassigned?: (payload: any) => void;
  onDisputeInfoRequested?: (payload: any) => void;
  onDisputeInfoProvided?: (payload: any) => void;
  onDisputeDefendantResponded?: (payload: any) => void;
  onDisputeResolved?: (payload: any) => void;
  onDisputeClosed?: (payload: any) => void;
  onAppealSubmitted?: (payload: any) => void;
  onAppealResolved?: (payload: any) => void;
  onAppealDeadlinePassed?: (payload: any) => void;
}

export const useDisputeRealtime = (
  disputeId?: string,
  handlers?: DisputeRealtimeHandlers,
) => {
  useEffect(() => {
    if (!disputeId) return;

    const socket = connectSocket();

    // Join room only after socket is connected
    const joinRoom = () => {
      socket.emit("joinDispute", { disputeId });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

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
    if (handlers?.onSettlementAccepted) {
      socket.on("SETTLEMENT_ACCEPTED", handlers.onSettlementAccepted);
    }
    if (handlers?.onSettlementRejected) {
      socket.on("SETTLEMENT_REJECTED", handlers.onSettlementRejected);
    }
    if (handlers?.onSettlementChatUnlocked) {
      socket.on("SETTLEMENT_CHAT_UNLOCKED", handlers.onSettlementChatUnlocked);
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
    if (handlers?.onAppealSubmitted) {
      socket.on("APPEAL_SUBMITTED", handlers.onAppealSubmitted);
    }
    if (handlers?.onAppealResolved) {
      socket.on("APPEAL_RESOLVED", handlers.onAppealResolved);
    }
    if (handlers?.onAppealDeadlinePassed) {
      socket.on("APPEAL_DEADLINE_PASSED", handlers.onAppealDeadlinePassed);
    }

    return () => {
      socket.off("connect", joinRoom);
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
      if (handlers?.onSettlementAccepted) {
        socket.off("SETTLEMENT_ACCEPTED", handlers.onSettlementAccepted);
      }
      if (handlers?.onSettlementRejected) {
        socket.off("SETTLEMENT_REJECTED", handlers.onSettlementRejected);
      }
      if (handlers?.onSettlementChatUnlocked) {
        socket.off("SETTLEMENT_CHAT_UNLOCKED", handlers.onSettlementChatUnlocked);
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
      if (handlers?.onAppealSubmitted) {
        socket.off("APPEAL_SUBMITTED", handlers.onAppealSubmitted);
      }
      if (handlers?.onAppealResolved) {
        socket.off("APPEAL_RESOLVED", handlers.onAppealResolved);
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
    handlers?.onSettlementAccepted,
    handlers?.onSettlementRejected,
    handlers?.onSettlementChatUnlocked,
    handlers?.onDisputeStatusChanged,
    handlers?.onDisputeAssigned,
    handlers?.onDisputeReassigned,
    handlers?.onDisputeInfoRequested,
    handlers?.onDisputeInfoProvided,
    handlers?.onDisputeDefendantResponded,
    handlers?.onDisputeResolved,
    handlers?.onDisputeClosed,
    handlers?.onAppealSubmitted,
    handlers?.onAppealResolved,
    handlers?.onAppealDeadlinePassed,
  ]);
};
