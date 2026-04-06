import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  askHearingQuestion,
  answerHearingQuestion,
  cancelHearingQuestion,
  closeHearingEvidenceIntake,
  endHearing,
  extendHearingDuration,
  getHearingWorkspace,
  openHearingEvidenceIntake,
  pauseHearing,
  resumeHearing,
  startHearing,
  submitHearingStatement,
  transitionHearingPhase,
  updateSpeakerControl,
  getDisputeVerdict,
  submitAppeal,
  acceptDisputeVerdict,
} from "@/features/hearings/api";
import type {
  HearingParticipantRole,
  HearingStatementContentBlock,
  HearingStatementType,
  HearingWorkspaceSummary,
  SpeakerRole,
  VerdictSummary,
} from "@/features/hearings/types";
import { useHearingRealtime } from "@/features/hearings/hooks/useHearingRealtime";
import { useHearingNotifications } from "@/features/hearings/hooks/useHearingNotifications";
import { useTypingIndicator } from "@/features/hearings/hooks/useTypingIndicator";
import { useServerTimeSync } from "@/features/hearings/hooks/useServerTimeSync";
import {
  sendDisputeMessage,
  uploadDisputeEvidence,
  hideDisputeMessage,
  unhideDisputeMessage,
} from "@/features/disputes/api";
import { sendDisputeMessageRealtime } from "@/features/disputes/realtime";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { UserRole } from "@/features/staff/types/staff.types";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { cn } from "@/shared/components/ui/utils";

import {
  type LocalMessage,
  type MobilePane,
  type UnifiedTimelineItem,
  loadLayout,
  saveLayout,
  toMs,
  extractEvidenceId,
} from "./hearing-room/constants";
import { HearingHeader } from "./hearing-room/HearingHeader";
import { DossierPane } from "./hearing-room/DossierPane";
import { UnifiedTimeline } from "./hearing-room/UnifiedTimeline";
import { MessageComposer } from "./hearing-room/MessageComposer";
import { EvidencePreview } from "./hearing-room/EvidencePreview";
import { ControlPane } from "./hearing-room/ControlPane";
import {
  PauseHearingDialog,
  EndHearingDialog,
  ExtendHearingDialog,
} from "./hearing-room/ModerationDialogs";
import { StatementSubmissionDialog } from "./hearing-room/StatementSubmissionDialog";
import { InviteSupportStaffDialog } from "./hearing-room/InviteSupportStaffDialog";
import { RescheduleDialog } from "./hearing-room/RescheduleDialog";
import { TypingIndicator } from "./hearing-room/TypingIndicator";
import { RoleGuideBanner } from "./hearing-room/RoleGuideBanner";
import { VerdictAnnouncement } from "./hearing-room/VerdictAnnouncement";
import { PreviousVerdictBanner } from "./hearing-room/PreviousVerdictBanner";
import { AppealDialog } from "./hearing-room/AppealDialog";
import { AcceptVerdictDialog } from "./hearing-room/AcceptVerdictDialog";
import { EvidenceUploadDialog } from "./hearing-room/EvidenceUploadDialog";
import { InHearingVerdictPanel } from "./hearing-room/InHearingVerdictPanel";
import { VerdictReadinessCard } from "./hearing-room/VerdictReadinessCard";

/* ─── Props ─── */

interface HearingRoomProps {
  hearingId: string;
}

/* ─── Component ─── */

export const HearingRoom = ({ hearingId }: HearingRoomProps) => {
  /* ── workspace / loading ── */
  const [workspace, setWorkspace] = useState<HearingWorkspaceSummary | null>(
    null,
  );
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── action spinners ── */
  const [sending, setSending] = useState(false);
  const [speakerUpdating, setSpeakerUpdating] = useState(false);
  const [pauseUpdating, setPauseUpdating] = useState(false);
  const [resumeUpdating, setResumeUpdating] = useState(false);
  const [ending, setEnding] = useState(false);
  const [intakeUpdating, setIntakeUpdating] = useState(false);

  /* ── evidence ── */
  const [previewEvidenceId, setPreviewEvidenceId] = useState<string | null>(
    null,
  );
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceAttaching, setEvidenceAttaching] = useState(false);
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [evidenceUploadDialogOpen, setEvidenceUploadDialogOpen] =
    useState(false);
  const [pendingEvidenceFile, setPendingEvidenceFile] = useState<File | null>(
    null,
  );

  /* ── moderation dialogs ── */
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendUpdating, setExtendUpdating] = useState(false);
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);
  const [inviteSupportOpen, setInviteSupportOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  /* ── verdict ── */
  const [verdict, setVerdict] = useState<VerdictSummary | null>(null);
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const [acceptVerdictDialogOpen, setAcceptVerdictDialogOpen] = useState(false);
  const [acceptVerdictLoading, setAcceptVerdictLoading] = useState(false);

  /* ── layout ── */
  const [mobilePane, setMobilePane] = useState<MobilePane>("main");
  const [layout] = useState(() => loadLayout());
  const [dossierCollapsed, setDossierCollapsed] = useState(false);
  const nowMs = useServerTimeSync();

  /* ── realtime connection indicator ── */
  const [isConnected, setIsConnected] = useState(false);
  const { notify } = useHearingNotifications();

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER),
    [],
  );
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;

  const { typingList, emitTyping, handleTyping } = useTypingIndicator(
    hearingId,
    currentUserId,
  );

  /* ─── Refresh workspace ─── */

  const refreshWorkspace = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const data = await getHearingWorkspace(hearingId);
        setWorkspace(data);
        setMessages(
          (data.messages ?? []).map((m) => ({ ...m, status: "sent" as const })),
        );
        setPreviewEvidenceId((prev) => prev ?? data.evidence?.[0]?.id ?? null);
      } catch {
        toast.error("Could not load hearing workspace");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [hearingId],
  );

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  /* ─── Derived data ─── */

  const hearing = workspace?.hearing;
  const evidence = useMemo(
    () => workspace?.evidence ?? [],
    [workspace?.evidence],
  );
  const evidenceById = useMemo(
    () => new Map(evidence.map((x) => [x.id, x])),
    [evidence],
  );
  const previewEvidence = previewEvidenceId
    ? evidenceById.get(previewEvidenceId)
    : undefined;

  const participantByUser = useMemo(() => {
    const map = new Map<string, HearingParticipantRole | string>();
    hearing?.participants?.forEach((p) => map.set(p.userId, p.role));
    return map;
  }, [hearing?.participants]);

  const currentParticipant = useMemo(
    () =>
      hearing?.participants?.find((p) => p.userId === currentUserId) ?? null,
    [hearing?.participants, currentUserId],
  );

  const ownStatementDrafts = useMemo(
    () =>
      (workspace?.statements ?? []).filter(
        (statement) =>
          statement.status === "DRAFT" &&
          statement.participant?.userId === currentUserId,
      ),
    [workspace?.statements, currentUserId],
  );

  const pendingQuestionsForMe = useMemo(
    () =>
      (workspace?.questions ?? []).filter(
        (q) =>
          q.targetUserId === currentUserId && q.status === "PENDING_ANSWER",
      ).length,
    [workspace?.questions, currentUserId],
  );

  /* ─── Permissions ─── */

  const canSendMessage = Boolean(hearing?.permissions?.canSendMessage);
  const canUploadEvidence = Boolean(hearing?.permissions?.canUploadEvidence);
  const canAttachEvidence = Boolean(
    hearing?.permissions?.canAttachEvidenceLink,
  );
  const canManageIntake = Boolean(
    hearing?.permissions?.canManageEvidenceIntake,
  );
  const canModerate = Boolean(
    hearing &&
    (currentUserRole === UserRole.ADMIN ||
      hearing.moderatorId === currentUserId),
  );
  const canAskQuestions =
    currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;

  const chatReason =
    hearing?.permissions?.sendMessageBlockedReason ||
    "You cannot speak right now.";

  const statusLabel =
    hearing?.status === "IN_PROGRESS"
      ? "LIVE"
      : hearing?.status === "PAUSED"
        ? "PAUSED"
        : hearing?.status === "COMPLETED" || hearing?.status === "CANCELED"
          ? "ENDED"
          : hearing?.status || "UNKNOWN";

  /* ─── Countdown + elapsed progress ─── */

  const { countdown, elapsedPercent } = useMemo(() => {
    if (!hearing) return { countdown: "Not started", elapsedPercent: 0 };
    const scheduledMs = new Date(hearing.scheduledAt).getTime();
    const startedMs = hearing.startedAt
      ? new Date(hearing.startedAt).getTime()
      : scheduledMs;
    const durationMs = (hearing.estimatedDurationMinutes ?? 60) * 60_000;
    const livePauseSeconds =
      hearing.status === "PAUSED" && hearing.pausedAt
        ? Math.max(
            0,
            Math.floor((nowMs - new Date(hearing.pausedAt).getTime()) / 1000),
          )
        : 0;
    const totalPauseMs =
      ((hearing.accumulatedPauseSeconds ?? 0) + livePauseSeconds) * 1000;
    if (hearing.status === "SCHEDULED") {
      const diff = scheduledMs - nowMs;
      return {
        countdown:
          diff > 0 ? `Starts in ${Math.ceil(diff / 60_000)}m` : "Starting now",
        elapsedPercent: 0,
      };
    }
    if (hearing.status === "IN_PROGRESS" || hearing.status === "PAUSED") {
      const elapsedMs = Math.max(0, nowMs - startedMs - totalPauseMs);
      const pct =
        durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0;
      const remainingMs = durationMs - elapsedMs;
      const cdStr =
        remainingMs >= 0
          ? `${Math.ceil(remainingMs / 60_000)}m left`
          : `Overtime ${Math.ceil(Math.abs(remainingMs) / 60_000)}m`;
      return { countdown: cdStr, elapsedPercent: Math.round(pct) };
    }
    return { countdown: "Ended", elapsedPercent: 100 };
  }, [hearing, nowMs]);

  /* ─── Verdict fetch ─── */

  const fetchVerdict = useCallback(
    async (disputeId?: string) => {
      const id = disputeId || hearing?.disputeId;
      if (!id) return;
      try {
        const data = await getDisputeVerdict(id);
        setVerdict(data);
      } catch {
        /* verdict not yet issued — ignore */
      }
    },
    [hearing?.disputeId],
  );

  useEffect(() => {
    if (hearing?.status === "COMPLETED" || hearing?.status === "CANCELED") {
      void fetchVerdict();
    }
  }, [hearing?.status, fetchVerdict]);

  const appealDeadlinePassed = useMemo(() => {
    if (!verdict?.appealDeadline) return false;
    return Date.now() > new Date(verdict.appealDeadline).getTime();
  }, [verdict?.appealDeadline]);

  const appealDeadlineText = useMemo(() => {
    if (!verdict?.appealDeadline) return undefined;
    const diff = new Date(verdict.appealDeadline).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.ceil((diff % 3_600_000) / 60_000);
    return hours > 0
      ? `${hours}h ${minutes}m remaining`
      : `${minutes}m remaining`;
  }, [verdict?.appealDeadline]);

  const handleAppealSubmit = useCallback(
    async (input: {
      reason: string;
      disclaimerAccepted: boolean;
      disclaimerVersion?: string;
    }) => {
      if (!hearing?.disputeId) return;
      setAppealLoading(true);
      try {
        await submitAppeal(hearing.disputeId, input);
        toast.success("Appeal submitted successfully");
        setAppealDialogOpen(false);
        await Promise.all([fetchVerdict(), refreshWorkspace(true)]);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to submit appeal");
      } finally {
        setAppealLoading(false);
      }
    },
    [fetchVerdict, hearing?.disputeId, refreshWorkspace],
  );

  const handleAcceptVerdictSubmit = useCallback(
    async (input: {
      disclaimerAccepted: boolean;
      waiveAppealRights: boolean;
      disclaimerVersion?: string;
    }) => {
      if (!hearing?.disputeId) return;
      setAcceptVerdictLoading(true);
      try {
        await acceptDisputeVerdict(hearing.disputeId, input);
        toast.success("Verdict accepted");
        setAcceptVerdictDialogOpen(false);
        await Promise.all([fetchVerdict(), refreshWorkspace(true)]);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to accept verdict");
      } finally {
        setAcceptVerdictLoading(false);
      }
    },
    [fetchVerdict, hearing?.disputeId, refreshWorkspace],
  );

  /* ─── Unified timeline ─── */

  const unifiedTimeline = useMemo<UnifiedTimelineItem[]>(() => {
    const messageItems: UnifiedTimelineItem[] = messages.map((message) => ({
      kind: "message",
      id: `message-${message.id}`,
      occurredAt: message.createdAt,
      sortAt: toMs(message.createdAt),
      message,
    }));
    const statementItems: UnifiedTimelineItem[] = (
      workspace?.statements ?? []
    ).map((statement) => ({
      kind: "statement",
      id: `statement-${statement.id}`,
      occurredAt: statement.createdAt,
      sortAt: toMs(statement.createdAt),
      statement,
    }));
    const questionItems: UnifiedTimelineItem[] = (
      workspace?.questions ?? []
    ).map((question) => ({
      kind: "question",
      id: `question-${question.id}`,
      occurredAt: question.createdAt,
      sortAt: toMs(question.createdAt),
      question,
    }));
    const verdictItems: UnifiedTimelineItem[] = verdict
      ? [
          {
            kind: "verdict" as const,
            id: "verdict-announcement",
            occurredAt: verdict.issuedAt ?? new Date().toISOString(),
            sortAt: toMs(verdict.issuedAt ?? new Date().toISOString()),
            verdictResult: verdict.result,
            adjudicatorName: verdict.adjudicator?.fullName,
          },
        ]
      : [];
    return [
      ...messageItems,
      ...statementItems,
      ...questionItems,
      ...verdictItems,
    ].sort((a, b) =>
      a.sortAt === b.sortAt ? a.id.localeCompare(b.id) : a.sortAt - b.sortAt,
    );
  }, [messages, workspace?.questions, workspace?.statements, verdict]);

  /* auto-scroll timeline */
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [unifiedTimeline.length]);

  /* ─── Realtime ─── */

  const handleRealtimeMessageSent = useCallback(
    (payload: any) => {
      if (!payload?.messageId) return;
      if (payload.hearingId && payload.hearingId !== hearingId) return;
      setMessages((prev) => {
        // Already have this exact message — skip
        if (prev.some((m) => m.id === payload.messageId)) return prev;

        // If the sender is the current user, replace the optimistic message
        // instead of appending a duplicate
        if (payload.senderId === currentUserId) {
          const hasOptimistic = prev.some(
            (m) =>
              m.id.startsWith("optimistic-") && m.senderId === currentUserId,
          );
          if (hasOptimistic) {
            // Replace the first matching optimistic message with the real one
            let replaced = false;
            return prev.map((m) => {
              if (
                !replaced &&
                m.id.startsWith("optimistic-") &&
                m.senderId === currentUserId
              ) {
                replaced = true;
                return {
                  ...payload,
                  id: payload.messageId,
                  createdAt: payload.createdAt || m.createdAt,
                  status: "delivered" as const,
                };
              }
              return m;
            });
          }
        }

        return [
          ...prev,
          {
            ...payload,
            id: payload.messageId,
            createdAt: payload.createdAt || new Date().toISOString(),
            status: "delivered" as const,
          },
        ];
      });
    },
    [hearingId, currentUserId],
  );

  useHearingRealtime(hearingId, {
    onMessageSent: handleRealtimeMessageSent,
    onMessageHidden: (payload) => {
      if (!payload?.messageId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId
            ? { ...msg, isHidden: true, hiddenReason: payload.hiddenReason }
            : msg,
        ),
      );
    },
    onMessageUnhidden: (payload) => {
      if (!payload?.messageId) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === payload.messageId
            ? { ...msg, isHidden: false, hiddenReason: undefined }
            : msg,
        ),
      );
    },
    onSpeakerControlChanged: (payload) => {
      if (!payload?.newRole) return;
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              hearing: {
                ...prev.hearing,
                currentSpeakerRole: payload.newRole,
              },
            }
          : prev,
      );
    },
    onEvidenceIntakeChanged: (payload) => {
      if (typeof payload?.isOpen !== "boolean") return;
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              hearing: {
                ...prev.hearing,
                isEvidenceIntakeOpen: payload.isOpen,
              },
              evidenceIntake: {
                ...prev.evidenceIntake,
                isOpen: payload.isOpen,
                reason: payload.reason || prev.evidenceIntake.reason,
              },
            }
          : prev,
      );
    },
    onHearingPaused: () => {
      notify({ type: "warning", title: "Hearing Paused", browser: true });
      void refreshWorkspace(true);
    },
    onHearingResumed: () => {
      notify({ type: "start", title: "Hearing Resumed", browser: true });
      void refreshWorkspace(true);
    },
    onHearingStarted: () => {
      notify({
        type: "start",
        title: "Hearing Started",
        body: "The hearing session is now live",
        browser: true,
      });
      void refreshWorkspace(true);
    },
    onHearingEnded: () => {
      notify({
        type: "warning",
        title: "Hearing Ended",
        body: "The hearing session has ended",
        browser: true,
      });
      void fetchVerdict();
      void refreshWorkspace(true);
    },
    onHearingTimeWarning: (payload) => {
      const body =
        typeof payload?.minutesRemaining === "number"
          ? `About ${payload.minutesRemaining} minute(s) remain before the current session is closed.`
          : "The hearing is close to its current time limit.";
      notify({
        type: "warning",
        title: "Hearing Time Warning",
        body,
        browser: true,
      });
    },
    onHearingFollowUpScheduled: (payload) => {
      notify({
        type: "start",
        title: payload?.manualRequired
          ? "Follow-up Requires Scheduling"
          : "Follow-up Hearing Scheduled",
        body: payload?.manualRequired
          ? payload?.reason || "Staff must schedule the next hearing manually."
          : "A new hearing session has been scheduled for this dispute.",
        browser: true,
      });
      void refreshWorkspace(true);
    },
    onHearingExtended: (payload) => {
      if (payload?.newDurationMinutes) {
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                hearing: {
                  ...prev.hearing,
                  estimatedDurationMinutes: payload.newDurationMinutes,
                },
              }
            : prev,
        );
      } else {
        void refreshWorkspace(true);
      }
      notify({
        type: "phase",
        title: "Hearing Extended",
        body: payload?.additionalMinutes
          ? `Extended by ${payload.additionalMinutes} minutes`
          : "Duration extended",
        browser: true,
      });
    },
    onStatementSubmitted: () => void refreshWorkspace(true),
    onQuestionAsked: () => {
      notify({
        type: "question",
        title: "New Question",
        body: "A formal question has been asked",
        browser: true,
      });
      void refreshWorkspace(true);
    },
    onQuestionAnswered: () => void refreshWorkspace(true),
    onPhaseTransitioned: (payload) => {
      const phaseName = payload?.newPhase || payload?.phase;
      notify({
        type: "phase",
        title: "Phase Changed",
        body: phaseName
          ? `Now: ${phaseName.replace(/_/g, " ")}`
          : "Phase updated",
        browser: true,
      });
      if (!phaseName) return void refreshWorkspace(true);
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              phase: {
                ...prev.phase,
                current: phaseName,
                currentStep: payload.currentStep ?? prev.phase.currentStep + 1,
                progressPercent:
                  payload.progressPercent ?? prev.phase.progressPercent,
                gate: payload.gate ?? prev.phase.gate,
              },
              hearing: {
                ...prev.hearing,
                currentSpeakerRole:
                  payload.newSpeakerRole ??
                  payload.speakerRole ??
                  prev.hearing.currentSpeakerRole,
              },
            }
          : prev,
      );
    },
    onQuestionCancelled: () => void refreshWorkspace(true),
    onVerdictIssued: () => {
      notify({
        type: "warning",
        title: "Verdict Issued",
        body: "The adjudicator has issued a verdict",
        browser: true,
      });
      void fetchVerdict();
      void refreshWorkspace(true);
    },
    onEvidenceUploaded: (payload) => {
      // Refresh evidence list for all participants in real-time
      void refreshWorkspace(true);
      // Show toast for evidence from other users
      if (payload?.uploaderId && payload.uploaderId !== currentUserId) {
        const uploaderLabel =
          payload.uploaderName ||
          payload.uploaderRole?.replace(/_/g, " ") ||
          "A participant";
        notify({
          type: "phase",
          title: "New Evidence",
          body: `${uploaderLabel} submitted: ${payload.fileName || "new file"}`,
          browser: true,
        });
      }
    },
    onPresenceChanged: (payload) => {
      if (payload?.hearingId && payload.hearingId !== hearingId) return;
      if (!payload?.userId) return;
      setWorkspace((prev) => {
        if (!prev?.hearing?.participants?.length) return prev;
        return {
          ...prev,
          hearing: {
            ...prev.hearing,
            participants: prev.hearing.participants.map((p) =>
              p.userId === payload.userId
                ? {
                    ...p,
                    isOnline: Boolean(payload.isOnline),
                    totalOnlineMinutes:
                      payload.totalOnlineMinutes ?? p.totalOnlineMinutes,
                  }
                : p,
            ),
          },
        };
      });
    },
    onPresenceSync: (payload) => {
      if (!payload?.hearingId || payload.hearingId !== hearingId) return;
      if (!payload.participants?.length) return;
      setWorkspace((prev) => {
        if (!prev?.hearing?.participants?.length) return prev;
        const lookup = new Map(
          payload.participants.map(
            (p: {
              userId: string;
              isOnline: boolean;
              totalOnlineMinutes: number;
            }) => [p.userId, p],
          ),
        );
        return {
          ...prev,
          hearing: {
            ...prev.hearing,
            participants: prev.hearing.participants.map((p) => {
              const synced = lookup.get(p.userId);
              if (!synced) return p;
              return {
                ...p,
                isOnline: synced.isOnline,
                totalOnlineMinutes:
                  synced.totalOnlineMinutes ?? p.totalOnlineMinutes,
              };
            }),
          },
        };
      });
    },
    onTyping: handleTyping,
    onConnected: () => setIsConnected(true),
    onDisconnected: () => setIsConnected(false),
  });

  /* ─── Handlers ─── */

  const handleSend = useCallback(
    async (content: string) => {
      if (!hearing?.disputeId || !content.trim()) return;
      if (!canSendMessage) return toast.error(chatReason);

      /* Optimistic insert */
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: LocalMessage = {
        id: optimisticId,
        disputeId: hearing.disputeId,
        hearingId: hearing.id,
        content: content.trim(),
        senderId: currentUserId ?? "",
        createdAt: new Date().toISOString(),
        status: "sending" as const,
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        setSending(true);
        await sendDisputeMessageRealtime({
          disputeId: hearing.disputeId,
          hearingId: hearing.id,
          content: content.trim(),
        });
        /* Mark as delivered */
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, status: "delivered" as const } : m,
          ),
        );
      } catch {
        try {
          await sendDisputeMessage(hearing.disputeId, {
            hearingId: hearing.id,
            content: content.trim(),
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId
                ? { ...m, status: "delivered" as const }
                : m,
            ),
          );
          await refreshWorkspace(true);
        } catch {
          /* Remove optimistic message on failure */
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          toast.error("Could not send message");
        }
      } finally {
        setSending(false);
      }
    },
    [
      hearing?.disputeId,
      hearing?.id,
      currentUserId,
      canSendMessage,
      chatReason,
      refreshWorkspace,
    ],
  );

  const attachEvidence = useCallback(
    async (evidenceId: string) => {
      if (!hearing?.disputeId || !evidenceId) return;
      if (!canAttachEvidence)
        return toast.error(
          hearing?.permissions?.attachEvidenceBlockedReason || "Attach blocked",
        );
      try {
        setEvidenceAttaching(true);
        const selected = evidenceById.get(evidenceId);
        await sendDisputeMessageRealtime({
          disputeId: hearing.disputeId,
          hearingId: hearing.id,
          type: "EVIDENCE_LINK",
          relatedEvidenceId: evidenceId,
          content: `Attached evidence: ${selected?.fileName || evidenceId} (#EVD-${evidenceId})`,
        });
        setPreviewEvidenceId(evidenceId);
      } catch {
        toast.error("Could not attach evidence link");
      } finally {
        setEvidenceAttaching(false);
      }
    },
    [
      hearing?.disputeId,
      hearing?.id,
      hearing?.permissions?.attachEvidenceBlockedReason,
      canAttachEvidence,
      evidenceById,
    ],
  );

  const onUploadFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !hearing?.disputeId) return;
      if (!canUploadEvidence) {
        toast.error(
          hearing?.permissions?.uploadEvidenceBlockedReason || "Upload blocked",
        );
        event.target.value = "";
        return;
      }
      // Client-side file size check (50MB max for video, 25MB for PDF, 15MB for docs, 10MB for images)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB absolute max
      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 50MB.`,
        );
        event.target.value = "";
        return;
      }
      // Store file and open description dialog
      setPendingEvidenceFile(file);
      setEvidenceUploadDialogOpen(true);
      event.target.value = "";
    },
    [
      hearing?.disputeId,
      hearing?.permissions?.uploadEvidenceBlockedReason,
      canUploadEvidence,
    ],
  );

  const onEvidenceUploadConfirm = useCallback(
    async (description: string) => {
      if (!pendingEvidenceFile || !hearing?.disputeId) return;
      try {
        setEvidenceUploading(true);
        const response = await uploadDisputeEvidence(
          hearing.disputeId,
          pendingEvidenceFile,
          description,
        );
        const eid = extractEvidenceId(response);
        await refreshWorkspace(true);
        if (eid) {
          setPreviewEvidenceId(eid);
          if (canAttachEvidence) await attachEvidence(eid);
        }
        setEvidenceUploadDialogOpen(false);
        setPendingEvidenceFile(null);
      } catch {
        toast.error("Could not upload evidence");
      } finally {
        setEvidenceUploading(false);
      }
    },
    [
      pendingEvidenceFile,
      hearing?.disputeId,
      canAttachEvidence,
      attachEvidence,
      refreshWorkspace,
    ],
  );

  const onAskQuestion = useCallback(
    async (targetUserId: string, question: string) => {
      if (!hearing) return;
      try {
        setQuestionSubmitting(true);
        await askHearingQuestion(hearing.id, {
          targetUserId,
          question: question.trim(),
        });
        await refreshWorkspace(true);
      } catch {
        toast.error("Could not send question");
      } finally {
        setQuestionSubmitting(false);
      }
    },
    [hearing, refreshWorkspace],
  );

  const onAnswerQuestion = useCallback(
    async (questionId: string, answer: string) => {
      if (!hearing) return;
      try {
        await answerHearingQuestion(hearing.id, questionId, answer);
        await refreshWorkspace(true);
        toast.success("Answer submitted");
      } catch (error: unknown) {
        const msg =
          (error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Could not submit answer";
        toast.error(msg);
        throw error; // re-throw so QuestionItem keeps the answer text
      }
    },
    [hearing, refreshWorkspace],
  );

  const onHideMessage = useCallback(
    async (messageId: string, reason: string) => {
      if (!hearing) return;
      try {
        await hideDisputeMessage(messageId, reason);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isHidden: true, hiddenReason: reason }
              : msg,
          ),
        );
        toast.success("Message hidden");
      } catch {
        toast.error("Could not hide message");
      }
    },
    [hearing],
  );

  const onUnhideMessage = useCallback(
    async (messageId: string) => {
      if (!hearing) return;
      try {
        await unhideDisputeMessage(messageId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isHidden: false, hiddenReason: undefined }
              : msg,
          ),
        );
        toast.success("Message restored");
      } catch {
        toast.error("Could not restore message");
      }
    },
    [hearing],
  );

  const onSkipQuestion = useCallback(
    async (questionId: string) => {
      if (!hearing || !canModerate) return;
      try {
        await cancelHearingQuestion(hearing.id, questionId);
        await refreshWorkspace(true);
        toast.success("Question skipped");
      } catch {
        toast.error("Could not skip question");
      }
    },
    [hearing, canModerate, refreshWorkspace],
  );

  const onPauseSession = useCallback(
    async (reason: string) => {
      if (!hearing || hearing.status !== "IN_PROGRESS" || !canModerate) return;
      try {
        setPauseUpdating(true);
        await pauseHearing(hearing.id, reason.trim());
        await refreshWorkspace(true);
      } catch {
        toast.error("Could not pause hearing");
      } finally {
        setPauseUpdating(false);
        setPauseDialogOpen(false);
      }
    },
    [hearing, canModerate, refreshWorkspace],
  );

  const onResumeSession = useCallback(async () => {
    if (!hearing || hearing.status !== "PAUSED" || !canModerate) return;
    try {
      setResumeUpdating(true);
      await resumeHearing(hearing.id);
      await refreshWorkspace(true);
    } catch {
      toast.error("Could not resume hearing");
    } finally {
      setResumeUpdating(false);
    }
  }, [hearing, canModerate, refreshWorkspace]);

  const onEndSession = useCallback(
    async (data: {
      summary: string;
      findings: string;
      pendingActions?: string[];
      noShowNote?: string;
    }) => {
      if (
        !hearing ||
        !canModerate ||
        !["IN_PROGRESS", "PAUSED"].includes(hearing.status)
      )
        return;
      const summary = data.summary.trim();
      const findings = data.findings.trim();
      if (!summary || !findings) {
        toast.error("Summary and findings are required to close hearing.");
        return;
      }
      try {
        setEnding(true);
        await endHearing(hearing.id, {
          hearingId: hearing.id,
          summary,
          findings,
          pendingActions: data.pendingActions,
          noShowNote: data.noShowNote,
        });
        await refreshWorkspace(true);
      } catch {
        toast.error("Could not end hearing");
      } finally {
        setEnding(false);
        setEndDialogOpen(false);
      }
    },
    [hearing, canModerate, refreshWorkspace],
  );

  const onExtendSession = useCallback(
    async (additionalMinutes: number, reason: string) => {
      if (!hearing || !canModerate) return;
      try {
        setExtendUpdating(true);
        await extendHearingDuration(hearing.id, {
          hearingId: hearing.id,
          additionalMinutes,
          reason,
        });
        await refreshWorkspace(true);
        toast.success(`Hearing extended by ${additionalMinutes} minutes`);
      } catch {
        toast.error("Could not extend hearing");
      } finally {
        setExtendUpdating(false);
        setExtendDialogOpen(false);
      }
    },
    [hearing, canModerate, refreshWorkspace],
  );

  const onDownloadPreviewEvidence = useCallback(async () => {
    if (!previewEvidence?.signedUrl) return;
    try {
      const response = await fetch(previewEvidence.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = previewEvidence.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download evidence");
    }
  }, [previewEvidence]);

  const handleLayoutChange = useCallback((nextLayout: any) => {
    saveLayout(nextLayout);
  }, []);

  const onOpenIntake = useCallback(
    async (reason: string) => {
      if (!hearing || !canManageIntake) return;
      try {
        setIntakeUpdating(true);
        await openHearingEvidenceIntake(hearing.id, reason);
        await refreshWorkspace(true);
      } catch {
        toast.error("Could not open intake");
      } finally {
        setIntakeUpdating(false);
      }
    },
    [hearing, canManageIntake, refreshWorkspace],
  );

  const onCloseIntake = useCallback(async () => {
    if (!hearing || !canManageIntake) return;
    try {
      setIntakeUpdating(true);
      await closeHearingEvidenceIntake(hearing.id);
      await refreshWorkspace(true);
    } catch {
      toast.error("Could not close intake");
    } finally {
      setIntakeUpdating(false);
    }
  }, [hearing, canManageIntake, refreshWorkspace]);

  const onUpdateSpeakerControl = useCallback(
    async (role: SpeakerRole) => {
      if (!hearing) return;
      try {
        setSpeakerUpdating(true);
        await updateSpeakerControl(hearing.id, role);
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                hearing: { ...prev.hearing, currentSpeakerRole: role },
              }
            : prev,
        );
      } catch {
        toast.error("Could not update speaker control");
      } finally {
        setSpeakerUpdating(false);
      }
    },
    [hearing],
  );

  const handleSelectEvidence = useCallback((id: string) => {
    setPreviewEvidenceId(id);
    setMobilePane("main");
  }, []);

  const onTransitionPhase = useCallback(
    async (phase: string) => {
      if (!hearing) return;
      try {
        await transitionHearingPhase(hearing.id, phase);
        await refreshWorkspace(true);
        toast.success(
          `Transitioned to ${phase.replace(/_/g, " ").toLowerCase()}`,
        );
      } catch {
        toast.error("Could not transition phase");
      }
    },
    [hearing, refreshWorkspace],
  );

  const onStartSession = useCallback(async () => {
    if (!hearing) return;
    try {
      await startHearing(hearing.id);
      await refreshWorkspace(true);
      toast.success("Hearing session started");
    } catch {
      toast.error("Could not start hearing");
    }
  }, [hearing, refreshWorkspace]);

  const onSubmitStatement = useCallback(
    async (input: {
      type: HearingStatementType;
      title?: string;
      content: string;
      contentBlocks: HearingStatementContentBlock[];
      citedEvidenceIds?: string[];
      platformDeclarationAccepted?: boolean;
      changeSummary?: string;
      draftId?: string;
      isDraft?: boolean;
    }) => {
      if (!hearing) return;
      await submitHearingStatement(hearing.id, input);
      await refreshWorkspace(true);
      toast.success(
        input.isDraft ? "Draft saved" : "Statement submitted to the record",
      );
    },
    [hearing, refreshWorkspace],
  );

  /* ─── Loading state ─── */

  if (loading && !workspace) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">
          Loading hearing workspace…
        </span>
      </div>
    );
  }

  /* ─── Pane content ─── */

  const dossierPaneContent = (
    <div className="space-y-3">
      <DossierPane
        workspace={workspace}
        evidence={evidence}
        previewEvidenceId={previewEvidenceId}
        onSelectEvidence={setPreviewEvidenceId}
        disputeId={hearing?.disputeId}
      />
      {hearing && (
        <VerdictReadinessCard
          hearingId={hearing.id}
          hearingStatus={hearing.status}
          disputePhase={workspace?.phase?.current}
        />
      )}
    </div>
  );

  const mainStagePane = (
    <div className="h-full min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Phase gate warning */}
        {workspace?.phase?.gate && !workspace.phase.gate.canTransition ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 inline-flex gap-2 items-start">
            <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{workspace.phase.gate.reason}</span>
          </div>
        ) : null}

        {/* Role guide banner */}
        <div className="shrink-0 px-3 pt-3">
          <RoleGuideBanner
            participantRole={currentParticipant?.role}
            currentPhase={workspace?.phase?.current}
            hearingStatus={hearing?.status}
            canSendMessage={canSendMessage}
            canAskQuestions={canAskQuestions}
            canModerate={canModerate}
            chatBlockedReason={chatReason}
          />
        </div>

        {/* ─── TIER_2: show previous (tier 1) verdict as reference banner ─── */}
        {hearing?.tier === "TIER_2" && verdict && verdict.tier === 1 && (
          <div className="shrink-0 px-3 pt-2">
            <PreviousVerdictBanner verdict={verdict} />
          </div>
        )}

        {/* Verdict announcement (final verdict — tier matches hearing, or tier 1 in non-appeal) */}
        {verdict && !(hearing?.tier === "TIER_2" && verdict.tier === 1) && (
          <div className="shrink-0 px-3 pt-2">
            <VerdictAnnouncement
              verdict={verdict}
              participantRole={currentParticipant?.role}
              appealDeadlinePassed={appealDeadlinePassed}
              onAppeal={() => setAppealDialogOpen(true)}
              appealLoading={appealLoading}
              onAccept={() => setAcceptVerdictDialogOpen(true)}
              acceptLoading={acceptVerdictLoading}
            />
          </div>
        )}

        {/* In-hearing verdict panel (DELIBERATION phase, moderator only, no final verdict yet) */}
        {(!verdict || (hearing?.tier === "TIER_2" && verdict.tier === 1)) &&
          canModerate &&
          workspace?.phase?.current === "DELIBERATION" &&
          hearing?.status === "IN_PROGRESS" && (
            <div className="shrink-0 px-3 pt-2">
              <InHearingVerdictPanel
                hearingId={hearing.id}
                disputedAmount={workspace?.dossier?.dispute?.disputedAmount}
                disputeCategory={workspace?.dossier?.dispute?.category}
                onVerdictIssued={() => {
                  void fetchVerdict();
                  void refreshWorkspace(true);
                }}
              />
            </div>
          )}

        {/* Evidence preview overlay */}
        {previewEvidence ? (
          <div className="shrink-0 max-h-[40%] overflow-hidden">
            <EvidencePreview
              evidence={previewEvidence}
              onClose={() => setPreviewEvidenceId(null)}
              onDownload={() => void onDownloadPreviewEvidence()}
            />
          </div>
        ) : null}

        {/* Timeline + Composer */}
        <div className="min-h-0 flex-1 flex flex-col">
          <UnifiedTimeline
            items={unifiedTimeline}
            currentUserId={currentUserId}
            participantByUser={participantByUser}
            evidenceById={evidenceById}
            onPreviewEvidence={setPreviewEvidenceId}
            onAnswerQuestion={onAnswerQuestion}
            onHideMessage={onHideMessage}
            onUnhideMessage={onUnhideMessage}
            onSkipQuestion={onSkipQuestion}
            canModerate={canModerate}
            nowMs={nowMs}
          />

          <div className="shrink-0">
            <TypingIndicator typingUsers={typingList} />
          </div>

          <div className="shrink-0">
            <MessageComposer
              canSendMessage={canSendMessage}
              chatBlockedReason={chatReason}
              canUploadEvidence={canUploadEvidence}
              uploadBlockedReason={
                hearing?.permissions?.uploadEvidenceBlockedReason ??
                "Upload blocked"
              }
              canAttachEvidence={canAttachEvidence}
              canAskQuestions={canAskQuestions}
              sending={sending}
              evidenceAttaching={evidenceAttaching}
              evidenceUploading={evidenceUploading}
              questionSubmitting={questionSubmitting}
              evidence={evidence}
              participants={hearing?.participants ?? []}
              onSendMessage={handleSend}
              onAttachEvidence={attachEvidence}
              onUploadFile={onUploadFile}
              onAskQuestion={onAskQuestion}
              onTyping={emitTyping}
              onOpenStatementDialog={() => setStatementDialogOpen(true)}
              pendingQuestionsForMe={pendingQuestionsForMe}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const controlPaneContent = (
    <ControlPane
      participants={hearing?.participants ?? []}
      evidence={evidence}
      currentSpeakerRole={hearing?.currentSpeakerRole}
      hearingStatus={hearing?.status}
      canModerate={canModerate}
      speakerUpdating={speakerUpdating}
      onUpdateSpeakerControl={onUpdateSpeakerControl}
      evidenceIntakeOpen={workspace?.evidenceIntake?.isOpen ?? false}
      evidenceIntakeReason={workspace?.evidenceIntake?.reason}
      canManageIntake={canManageIntake}
      intakeBlockedReason={
        hearing?.permissions?.manageEvidenceIntakeBlockedReason
      }
      intakeUpdating={intakeUpdating}
      onOpenIntake={onOpenIntake}
      onCloseIntake={onCloseIntake}
      attendance={workspace?.attendance ?? null}
      previewEvidenceId={previewEvidenceId}
      onSelectEvidence={handleSelectEvidence}
      canUploadEvidence={canUploadEvidence}
      evidenceUploading={evidenceUploading}
      onUploadFile={onUploadFile}
      phaseSequence={workspace?.phase?.sequence}
      currentPhase={workspace?.phase?.current}
      currentStep={workspace?.phase?.currentStep}
      phaseGate={workspace?.phase?.gate}
      onTransitionPhase={onTransitionPhase}
      confirmationSummary={hearing?.participantConfirmationSummary}
      disputeId={hearing?.disputeId}
    />
  );

  /* ─── Render ─── */

  return (
    <div className="space-y-0 min-w-0">
      {/* ── Header (sticky courtroom bar) ── */}
      <HearingHeader
        workspace={workspace}
        countdown={countdown}
        statusLabel={statusLabel}
        canModerate={canModerate}
        isConnected={isConnected}
        elapsedPercent={elapsedPercent}
        onRefresh={() => void refreshWorkspace()}
        onToggleDossier={() => setDossierCollapsed((p) => !p)}
        dossierCollapsed={dossierCollapsed}
        onPause={() => setPauseDialogOpen(true)}
        onResume={() => void onResumeSession()}
        onEnd={() => setEndDialogOpen(true)}
        onExtend={() => setExtendDialogOpen(true)}
        onStart={onStartSession}
        onInviteSupport={() => setInviteSupportOpen(true)}
        onReschedule={() => setRescheduleOpen(true)}
        pauseUpdating={pauseUpdating}
        resumeUpdating={resumeUpdating}
        ending={ending}
        currentParticipantRole={currentParticipant?.role}
      />

      {/* ── Mobile pane selector ── */}
      <div className="lg:hidden rounded-xl border border-slate-200 bg-white p-2 mt-2">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "dossier" as const, label: "Dossier" },
              { id: "main" as const, label: "Timeline" },
              { id: "control" as const, label: "Controls" },
            ] as const
          ).map((pane) => (
            <button
              key={pane.id}
              onClick={() => setMobilePane(pane.id)}
              className={cn(
                "h-11 rounded-lg text-sm font-medium transition-colors",
                mobilePane === pane.id
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              {pane.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile view ── */}
      <div className="lg:hidden mt-2 h-[calc(100vh-220px)] min-h-96">
        {mobilePane === "dossier" && (
          <div className="h-full overflow-y-auto">{dossierPaneContent}</div>
        )}
        {mobilePane === "main" && mainStagePane}
        {mobilePane === "control" && (
          <div className="h-full overflow-y-auto">{controlPaneContent}</div>
        )}
      </div>

      {/* ── Desktop 3-pane layout ── */}
      <div className="hidden lg:block mt-2">
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChange={handleLayoutChange}
          className="h-[calc(100vh-180px)] min-h-190 rounded-xl border border-slate-200 bg-linear-to-b from-slate-50 to-slate-100"
        >
          {!dossierCollapsed ? (
            <>
              <ResizablePanel id="dossier" defaultSize={layout[0]} minSize={18}>
                <div className="h-full overflow-y-auto p-3">
                  {dossierPaneContent}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          ) : null}
          <ResizablePanel
            id="main"
            defaultSize={dossierCollapsed ? 70 : layout[1]}
            minSize={40}
          >
            <div className="h-full overflow-hidden p-3">{mainStagePane}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="control"
            defaultSize={dossierCollapsed ? 30 : layout[2]}
            minSize={18}
          >
            <div className="h-full overflow-y-auto p-3">
              {controlPaneContent}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ── Moderation dialogs ── */}
      <PauseHearingDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        onConfirm={onPauseSession}
        loading={pauseUpdating}
      />
      <EndHearingDialog
        open={endDialogOpen}
        onOpenChange={setEndDialogOpen}
        onConfirm={onEndSession}
        loading={ending}
      />
      <ExtendHearingDialog
        open={extendDialogOpen}
        onOpenChange={setExtendDialogOpen}
        onConfirm={onExtendSession}
        loading={extendUpdating}
      />
      <StatementSubmissionDialog
        open={statementDialogOpen}
        onOpenChange={setStatementDialogOpen}
        onSubmit={onSubmitStatement}
        currentPhase={workspace?.phase?.current}
        participantRole={currentParticipant?.role}
        draftStatements={ownStatementDrafts}
      />
      {hearing && (
        <InviteSupportStaffDialog
          open={inviteSupportOpen}
          onOpenChange={setInviteSupportOpen}
          hearingId={hearing.id}
          onInvited={() => void refreshWorkspace(true)}
        />
      )}
      {hearing && (
        <RescheduleDialog
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          hearingId={hearing.id}
          onRescheduled={() => void refreshWorkspace(true)}
        />
      )}
      <AppealDialog
        open={appealDialogOpen}
        onOpenChange={setAppealDialogOpen}
        onSubmit={handleAppealSubmit}
        deadlineText={appealDeadlineText}
      />
      <AcceptVerdictDialog
        open={acceptVerdictDialogOpen}
        onOpenChange={setAcceptVerdictDialogOpen}
        onSubmit={handleAcceptVerdictSubmit}
      />
      <EvidenceUploadDialog
        open={evidenceUploadDialogOpen}
        onOpenChange={(open) => {
          setEvidenceUploadDialogOpen(open);
          if (!open) setPendingEvidenceFile(null);
        }}
        file={pendingEvidenceFile}
        onConfirm={onEvidenceUploadConfirm}
        loading={evidenceUploading}
        requireJustification={
          hearing?.status === "IN_PROGRESS" &&
          workspace?.phase?.current !== "EVIDENCE_SUBMISSION"
        }
      />

      {/* Hidden file input for evidence upload */}
      <input
        ref={evidenceInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/x-zip-compressed,video/mp4,video/webm,audio/mpeg,audio/wav,.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.json,.doc,.docx,.xls,.xlsx,.zip,.mp4,.webm,.mp3,.wav"
        onChange={onUploadFile}
      />
    </div>
  );
};
