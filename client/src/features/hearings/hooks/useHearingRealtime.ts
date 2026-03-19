import { useEffect, useRef, useLayoutEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

interface HearingRealtimeHandlers {
  onMessageSent?: (payload: any) => void;
  onMessageHidden?: (payload: any) => void;
  onMessageUnhidden?: (payload: any) => void;
  onSpeakerControlChanged?: (payload: any) => void;
  onPhaseTransitioned?: (payload: any) => void;
  onEvidenceIntakeChanged?: (payload: any) => void;
  onHearingStarted?: (payload: any) => void;
  onHearingPaused?: (payload: any) => void;
  onHearingResumed?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
  onHearingExtended?: (payload: any) => void;
  onStatementSubmitted?: (payload: any) => void;
  onQuestionAsked?: (payload: any) => void;
  onQuestionAnswered?: (payload: any) => void;
  onQuestionCancelled?: (payload: any) => void;
  onVerdictIssued?: (payload: any) => void;
  onEvidenceUploaded?: (payload: any) => void;
  onPresenceChanged?: (payload: any) => void;
  onPresenceSync?: (payload: {
    hearingId: string;
    participants: Array<{
      userId: string;
      isOnline: boolean;
      totalOnlineMinutes: number;
    }>;
  }) => void;
  onTyping?: (payload: {
    userId: string;
    userName?: string;
    isTyping: boolean;
  }) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

/**
 * Subscribes to all hearing real-time events via Socket.IO.
 *
 * Handlers are stored in a ref so the socket subscription is set up exactly
 * once per hearingId — no teardown/re-subscribe on every render.
 */
export const useHearingRealtime = (
  hearingId?: string,
  handlers?: HearingRealtimeHandlers,
) => {
  // Keep a live ref to the latest handlers so we never need to re-subscribe
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!hearingId) return;

    const socket = connectSocket();

    /* ── Join the hearing room ── */
    const joinRoom = () => {
      socket.emit("joinHearing", { hearingId });
    };

    // NOTE: Do NOT call joinRoom() here — it will be called exactly once
    // via `onConnected` below (either immediately if already connected,
    // or when the "connect" event fires). Calling it here AND in onConnected
    // inflates the server-side presence counter, breaking online/offline tracking.

    /* ── Stable listener wrappers that delegate to handlersRef ── */
    const onMessageSent = (p: any) => handlersRef.current?.onMessageSent?.(p);
    const onMessageHidden = (p: any) =>
      handlersRef.current?.onMessageHidden?.(p);
    const onMessageUnhidden = (p: any) =>
      handlersRef.current?.onMessageUnhidden?.(p);
    const onSpeakerControlChanged = (p: any) =>
      handlersRef.current?.onSpeakerControlChanged?.(p);
    const onPhaseTransitioned = (p: any) =>
      handlersRef.current?.onPhaseTransitioned?.(p);
    const onEvidenceIntakeChanged = (p: any) =>
      handlersRef.current?.onEvidenceIntakeChanged?.(p);
    const onHearingStarted = (p: any) =>
      handlersRef.current?.onHearingStarted?.(p);
    const onHearingPaused = (p: any) =>
      handlersRef.current?.onHearingPaused?.(p);
    const onHearingResumed = (p: any) =>
      handlersRef.current?.onHearingResumed?.(p);
    const onHearingEnded = (p: any) => handlersRef.current?.onHearingEnded?.(p);
    const onHearingExtended = (p: any) =>
      handlersRef.current?.onHearingExtended?.(p);
    const onStatementSubmitted = (p: any) =>
      handlersRef.current?.onStatementSubmitted?.(p);
    const onQuestionAsked = (p: any) =>
      handlersRef.current?.onQuestionAsked?.(p);
    const onQuestionAnswered = (p: any) =>
      handlersRef.current?.onQuestionAnswered?.(p);
    const onQuestionCancelled = (p: any) =>
      handlersRef.current?.onQuestionCancelled?.(p);
    const onVerdictIssued = (p: any) =>
      handlersRef.current?.onVerdictIssued?.(p);
    const onEvidenceUploaded = (p: any) =>
      handlersRef.current?.onEvidenceUploaded?.(p);
    const onPresenceChanged = (p: any) =>
      handlersRef.current?.onPresenceChanged?.(p);
    const onPresenceSync = (p: any) => handlersRef.current?.onPresenceSync?.(p);
    const onTyping = (p: any) => handlersRef.current?.onTyping?.(p);
    const onConnected = () => {
      joinRoom(); // Re-join on every reconnect so presence is re-established
      handlersRef.current?.onConnected?.();
    };
    const onDisconnected = () => {
      handlersRef.current?.onDisconnected?.();
    };

    /* ── Subscribe to all events ── */
    socket.on("MESSAGE_SENT", onMessageSent);
    socket.on("MESSAGE_HIDDEN", onMessageHidden);
    socket.on("MESSAGE_UNHIDDEN", onMessageUnhidden);
    socket.on("SPEAKER_CONTROL_CHANGED", onSpeakerControlChanged);
    socket.on("PHASE_TRANSITIONED", onPhaseTransitioned);
    socket.on("EVIDENCE_INTAKE_CHANGED", onEvidenceIntakeChanged);
    socket.on("HEARING_STARTED", onHearingStarted);
    socket.on("HEARING_PAUSED", onHearingPaused);
    socket.on("HEARING_RESUMED", onHearingResumed);
    socket.on("HEARING_ENDED", onHearingEnded);
    socket.on("HEARING_EXTENDED", onHearingExtended);
    socket.on("HEARING_STATEMENT_SUBMITTED", onStatementSubmitted);
    socket.on("HEARING_QUESTION_ASKED", onQuestionAsked);
    socket.on("HEARING_QUESTION_ANSWERED", onQuestionAnswered);
    socket.on("HEARING_QUESTION_CANCELLED", onQuestionCancelled);
    socket.on("VERDICT_ISSUED", onVerdictIssued);
    socket.on("EVIDENCE_UPLOADED", onEvidenceUploaded);
    socket.on("HEARING_PRESENCE_CHANGED", onPresenceChanged);
    socket.on("HEARING_PRESENCE_SYNC", onPresenceSync);
    socket.on("HEARING_TYPING", onTyping);
    socket.on("connect", onConnected);
    socket.on("disconnect", onDisconnected);

    // Fire connected immediately if already connected
    if (socket.connected) onConnected();

    /* ── Cleanup ── */
    return () => {
      socket.emit("leaveHearing", { hearingId });

      socket.off("MESSAGE_SENT", onMessageSent);
      socket.off("MESSAGE_HIDDEN", onMessageHidden);
      socket.off("MESSAGE_UNHIDDEN", onMessageUnhidden);
      socket.off("SPEAKER_CONTROL_CHANGED", onSpeakerControlChanged);
      socket.off("PHASE_TRANSITIONED", onPhaseTransitioned);
      socket.off("EVIDENCE_INTAKE_CHANGED", onEvidenceIntakeChanged);
      socket.off("HEARING_STARTED", onHearingStarted);
      socket.off("HEARING_PAUSED", onHearingPaused);
      socket.off("HEARING_RESUMED", onHearingResumed);
      socket.off("HEARING_ENDED", onHearingEnded);
      socket.off("HEARING_EXTENDED", onHearingExtended);
      socket.off("HEARING_STATEMENT_SUBMITTED", onStatementSubmitted);
      socket.off("HEARING_QUESTION_ASKED", onQuestionAsked);
      socket.off("HEARING_QUESTION_ANSWERED", onQuestionAnswered);
      socket.off("HEARING_QUESTION_CANCELLED", onQuestionCancelled);
      socket.off("VERDICT_ISSUED", onVerdictIssued);
      socket.off("EVIDENCE_UPLOADED", onEvidenceUploaded);
      socket.off("HEARING_PRESENCE_CHANGED", onPresenceChanged);
      socket.off("HEARING_PRESENCE_SYNC", onPresenceSync);
      socket.off("HEARING_TYPING", onTyping);
      socket.off("connect", onConnected);
      socket.off("disconnect", onDisconnected);
    };
    // Only re-subscribe when the hearingId changes — handler stability via ref
  }, [hearingId]);
};
