import { useEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface HearingRealtimeHandlers {
  onMessageSent?: (payload: any) => void;
  onMessageHidden?: (payload: any) => void;
  onSpeakerControlChanged?: (payload: any) => void;
  onPhaseTransitioned?: (payload: any) => void;
  onEvidenceIntakeChanged?: (payload: any) => void;
}

export const useHearingRealtime = (
  hearingId?: string,
  handlers?: HearingRealtimeHandlers,
) => {
  useEffect(() => {
    if (!hearingId) return;

    const socket = connectSocket();

    // Join room only after socket is connected
    const joinRoom = () => {
      socket.emit("joinHearing", { hearingId });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    if (handlers?.onMessageSent) {
      socket.on("MESSAGE_SENT", handlers.onMessageSent);
    }
    if (handlers?.onMessageHidden) {
      socket.on("MESSAGE_HIDDEN", handlers.onMessageHidden);
    }
    if (handlers?.onSpeakerControlChanged) {
      socket.on("SPEAKER_CONTROL_CHANGED", handlers.onSpeakerControlChanged);
    }
    if (handlers?.onPhaseTransitioned) {
      socket.on("PHASE_TRANSITIONED", handlers.onPhaseTransitioned);
    }
    if (handlers?.onEvidenceIntakeChanged) {
      socket.on("EVIDENCE_INTAKE_CHANGED", handlers.onEvidenceIntakeChanged);
    }

    return () => {
      socket.off("connect", joinRoom);
      socket.emit("leaveHearing", { hearingId });
      if (handlers?.onMessageSent) {
        socket.off("MESSAGE_SENT", handlers.onMessageSent);
      }
      if (handlers?.onMessageHidden) {
        socket.off("MESSAGE_HIDDEN", handlers.onMessageHidden);
      }
      if (handlers?.onSpeakerControlChanged) {
        socket.off("SPEAKER_CONTROL_CHANGED", handlers.onSpeakerControlChanged);
      }
      if (handlers?.onPhaseTransitioned) {
        socket.off("PHASE_TRANSITIONED", handlers.onPhaseTransitioned);
      }
      if (handlers?.onEvidenceIntakeChanged) {
        socket.off("EVIDENCE_INTAKE_CHANGED", handlers.onEvidenceIntakeChanged);
      }
    };
  }, [
    hearingId,
    handlers?.onMessageSent,
    handlers?.onMessageHidden,
    handlers?.onSpeakerControlChanged,
    handlers?.onPhaseTransitioned,
    handlers?.onEvidenceIntakeChanged,
  ]);
};
