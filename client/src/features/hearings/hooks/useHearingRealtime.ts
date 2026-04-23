import { useEffect, useRef, useLayoutEffect } from "react";
import { connectSocket } from "@/shared/realtime/socket";

const REALTIME_EVENT_DEDUPE_TTL_MS = 1200;

interface HearingRealtimeHandlers {
  onMessageSent?: (payload: any) => void;
  onMessageHidden?: (payload: any) => void;
  onMessageUnhidden?: (payload: any) => void;
  onHearingInviteResponded?: (payload: any) => void;
  onSpeakerControlChanged?: (payload: any) => void;
  onPhaseTransitioned?: (payload: any) => void;
  onEvidenceIntakeChanged?: (payload: any) => void;
  onHearingStarted?: (payload: any) => void;
  onHearingPaused?: (payload: any) => void;
  onHearingResumed?: (payload: any) => void;
  onHearingEnded?: (payload: any) => void;
  onHearingExtended?: (payload: any) => void;
  onHearingTimeWarning?: (payload: any) => void;
  onHearingFollowUpScheduled?: (payload: any) => void;
  onHearingSupportInvited?: (payload: any) => void;
  onHearingReminderSent?: (payload: any) => void;
  onHearingPhaseDeadlinesSet?: (payload: any) => void;
  onHearingStatementDraftSaved?: (payload: any) => void;
  onHearingModeratorDisconnected?: (payload: any) => void;
  onHearingModeratorReconnected?: (payload: any) => void;
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
  const eventSignatureRef = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!hearingId) return;

    const socket = connectSocket();
    eventSignatureRef.current.clear();

    const buildRealtimeSignature = (
      eventName: string,
      payload: unknown,
    ): string => {
      if (!payload || typeof payload !== "object") {
        return `${eventName}:no-payload`;
      }

      const value = payload as Record<string, unknown>;
      const fields = [
        value.hearingId,
        value.disputeId,
        value.eventId,
        value.messageId,
        value.questionId,
        value.statementId,
        value.evidenceId,
        value.participantId,
        value.userId,
        value.response,
        value.eventStatus,
        value.newPhase,
        value.phase,
        value.newRole,
        value.isOpen,
        value.serverTimestamp,
        value.changedAt,
        value.createdAt,
        value.answeredAt,
        value.respondedAt,
        value.uploadedAt,
      ]
        .map((item) => {
          if (
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean"
          ) {
            return String(item);
          }
          return "";
        })
        .filter(Boolean)
        .join("|");

      const participantCount = Array.isArray(value.participants)
        ? `|participants:${value.participants.length}`
        : "";

      return `${eventName}:${fields}${participantCount}`;
    };

    const shouldProcessEvent = (eventName: string, payload: unknown): boolean => {
      // Typing and connection events are intentionally noisy and should not be deduped.
      if (eventName === "HEARING_TYPING") {
        return true;
      }

      const now = Date.now();
      const signatures = eventSignatureRef.current;
      signatures.forEach((timestamp, key) => {
        if (now - timestamp > REALTIME_EVENT_DEDUPE_TTL_MS) {
          signatures.delete(key);
        }
      });

      const signature = buildRealtimeSignature(eventName, payload);
      const seenAt = signatures.get(signature);
      if (seenAt && now - seenAt < REALTIME_EVENT_DEDUPE_TTL_MS) {
        return false;
      }

      signatures.set(signature, now);
      return true;
    };

    const withDedup = <T,>(eventName: string, callback: (payload: T) => void) => {
      return (payload: T) => {
        if (!shouldProcessEvent(eventName, payload)) {
          return;
        }
        callback(payload);
      };
    };

    /* ── Join the hearing room ── */
    const joinRoom = () => {
      socket.emit("joinHearing", { hearingId });
    };

    // NOTE: Do NOT call joinRoom() here — it will be called exactly once
    // via `onConnected` below (either immediately if already connected,
    // or when the "connect" event fires). Calling it here AND in onConnected
    // inflates the server-side presence counter, breaking online/offline tracking.

    /* ── Stable listener wrappers that delegate to handlersRef ── */
    const onMessageSent = withDedup("MESSAGE_SENT", (p: any) =>
      handlersRef.current?.onMessageSent?.(p),
    );
    const onMessageHidden = withDedup("MESSAGE_HIDDEN", (p: any) =>
      handlersRef.current?.onMessageHidden?.(p),
    );
    const onMessageUnhidden = withDedup("MESSAGE_UNHIDDEN", (p: any) =>
      handlersRef.current?.onMessageUnhidden?.(p),
    );
    const onHearingInviteResponded = withDedup(
      "HEARING_INVITE_RESPONDED",
      (p: any) => handlersRef.current?.onHearingInviteResponded?.(p),
    );
    const onSpeakerControlChanged = withDedup("SPEAKER_CONTROL_CHANGED", (p: any) =>
      handlersRef.current?.onSpeakerControlChanged?.(p),
    );
    const onPhaseTransitioned = withDedup("PHASE_TRANSITIONED", (p: any) =>
      handlersRef.current?.onPhaseTransitioned?.(p),
    );
    const onEvidenceIntakeChanged = withDedup("EVIDENCE_INTAKE_CHANGED", (p: any) =>
      handlersRef.current?.onEvidenceIntakeChanged?.(p),
    );
    const onHearingStarted = withDedup("HEARING_STARTED", (p: any) =>
      handlersRef.current?.onHearingStarted?.(p),
    );
    const onHearingPaused = withDedup("HEARING_PAUSED", (p: any) =>
      handlersRef.current?.onHearingPaused?.(p),
    );
    const onHearingResumed = withDedup("HEARING_RESUMED", (p: any) =>
      handlersRef.current?.onHearingResumed?.(p),
    );
    const onHearingEnded = withDedup("HEARING_ENDED", (p: any) =>
      handlersRef.current?.onHearingEnded?.(p),
    );
    const onHearingExtended = withDedup("HEARING_EXTENDED", (p: any) =>
      handlersRef.current?.onHearingExtended?.(p),
    );
    const onHearingTimeWarning = withDedup("HEARING_TIME_WARNING", (p: any) =>
      handlersRef.current?.onHearingTimeWarning?.(p),
    );
    const onHearingFollowUpScheduled = withDedup("HEARING_FOLLOW_UP_SCHEDULED", (p: any) =>
      handlersRef.current?.onHearingFollowUpScheduled?.(p),
    );
    const onHearingSupportInvited = withDedup("HEARING_SUPPORT_INVITED", (p: any) =>
      handlersRef.current?.onHearingSupportInvited?.(p),
    );
    const onHearingReminderSent = withDedup("HEARING_REMINDER_SENT", (p: any) =>
      handlersRef.current?.onHearingReminderSent?.(p),
    );
    const onHearingPhaseDeadlinesSet = withDedup("HEARING_PHASE_DEADLINES_SET", (p: any) =>
      handlersRef.current?.onHearingPhaseDeadlinesSet?.(p),
    );
    const onHearingStatementDraftSaved = withDedup(
      "HEARING_STATEMENT_DRAFT_SAVED",
      (p: any) => handlersRef.current?.onHearingStatementDraftSaved?.(p),
    );
    const onHearingModeratorDisconnected = withDedup(
      "HEARING_MODERATOR_DISCONNECTED",
      (p: any) => handlersRef.current?.onHearingModeratorDisconnected?.(p),
    );
    const onHearingModeratorReconnected = withDedup(
      "HEARING_MODERATOR_RECONNECTED",
      (p: any) => handlersRef.current?.onHearingModeratorReconnected?.(p),
    );
    const onStatementSubmitted = withDedup("HEARING_STATEMENT_SUBMITTED", (p: any) =>
      handlersRef.current?.onStatementSubmitted?.(p),
    );
    const onQuestionAsked = withDedup("HEARING_QUESTION_ASKED", (p: any) =>
      handlersRef.current?.onQuestionAsked?.(p),
    );
    const onQuestionAnswered = withDedup("HEARING_QUESTION_ANSWERED", (p: any) =>
      handlersRef.current?.onQuestionAnswered?.(p),
    );
    const onQuestionCancelled = withDedup("HEARING_QUESTION_CANCELLED", (p: any) =>
      handlersRef.current?.onQuestionCancelled?.(p),
    );
    const onVerdictIssued = withDedup("VERDICT_ISSUED", (p: any) =>
      handlersRef.current?.onVerdictIssued?.(p),
    );
    const onEvidenceUploaded = withDedup("EVIDENCE_UPLOADED", (p: any) =>
      handlersRef.current?.onEvidenceUploaded?.(p),
    );
    const onPresenceChanged = withDedup("HEARING_PRESENCE_CHANGED", (p: any) =>
      handlersRef.current?.onPresenceChanged?.(p),
    );
    const onPresenceSync = withDedup("HEARING_PRESENCE_SYNC", (p: any) =>
      handlersRef.current?.onPresenceSync?.(p),
    );
    const onTyping = withDedup("HEARING_TYPING", (p: any) =>
      handlersRef.current?.onTyping?.(p),
    );
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
    socket.on("HEARING_INVITE_RESPONDED", onHearingInviteResponded);
    socket.on("SPEAKER_CONTROL_CHANGED", onSpeakerControlChanged);
    socket.on("PHASE_TRANSITIONED", onPhaseTransitioned);
    socket.on("EVIDENCE_INTAKE_CHANGED", onEvidenceIntakeChanged);
    socket.on("HEARING_STARTED", onHearingStarted);
    socket.on("HEARING_PAUSED", onHearingPaused);
    socket.on("HEARING_RESUMED", onHearingResumed);
    socket.on("HEARING_ENDED", onHearingEnded);
    socket.on("HEARING_EXTENDED", onHearingExtended);
    socket.on("HEARING_TIME_WARNING", onHearingTimeWarning);
    socket.on("HEARING_FOLLOW_UP_SCHEDULED", onHearingFollowUpScheduled);
    socket.on("HEARING_SUPPORT_INVITED", onHearingSupportInvited);
    socket.on("HEARING_REMINDER_SENT", onHearingReminderSent);
    socket.on("HEARING_PHASE_DEADLINES_SET", onHearingPhaseDeadlinesSet);
    socket.on("HEARING_STATEMENT_DRAFT_SAVED", onHearingStatementDraftSaved);
    socket.on("HEARING_MODERATOR_DISCONNECTED", onHearingModeratorDisconnected);
    socket.on("HEARING_MODERATOR_RECONNECTED", onHearingModeratorReconnected);
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
      socket.off("HEARING_INVITE_RESPONDED", onHearingInviteResponded);
      socket.off("SPEAKER_CONTROL_CHANGED", onSpeakerControlChanged);
      socket.off("PHASE_TRANSITIONED", onPhaseTransitioned);
      socket.off("EVIDENCE_INTAKE_CHANGED", onEvidenceIntakeChanged);
      socket.off("HEARING_STARTED", onHearingStarted);
      socket.off("HEARING_PAUSED", onHearingPaused);
      socket.off("HEARING_RESUMED", onHearingResumed);
      socket.off("HEARING_ENDED", onHearingEnded);
      socket.off("HEARING_EXTENDED", onHearingExtended);
      socket.off("HEARING_TIME_WARNING", onHearingTimeWarning);
      socket.off("HEARING_FOLLOW_UP_SCHEDULED", onHearingFollowUpScheduled);
      socket.off("HEARING_SUPPORT_INVITED", onHearingSupportInvited);
      socket.off("HEARING_REMINDER_SENT", onHearingReminderSent);
      socket.off("HEARING_PHASE_DEADLINES_SET", onHearingPhaseDeadlinesSet);
      socket.off("HEARING_STATEMENT_DRAFT_SAVED", onHearingStatementDraftSaved);
      socket.off("HEARING_MODERATOR_DISCONNECTED", onHearingModeratorDisconnected);
      socket.off("HEARING_MODERATOR_RECONNECTED", onHearingModeratorReconnected);
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
