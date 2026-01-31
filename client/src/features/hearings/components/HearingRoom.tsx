import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  Clock,
  FileText,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  UserCheck,
  Users,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  askHearingQuestion,
  getHearingAttendance,
  getHearingById,
  getHearingQuestions,
  getHearingStatements,
  getHearingTimeline,
  updateSpeakerControl,
} from "@/features/hearings/api";
import type {
  DisputeHearingSummary,
  HearingAttendanceSummary,
  HearingParticipantRole,
  HearingQuestionSummary,
  HearingStatementSummary,
  HearingTimelineEvent,
  SpeakerRole,
} from "@/features/hearings/types";
import { useHearingRealtime } from "@/features/hearings/hooks/useHearingRealtime";
import { getDisputeMessages, sendDisputeMessage } from "@/features/disputes/api";
import type { DisputeMessage } from "@/features/disputes/types/dispute.types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { UserRole } from "@/features/staff/types/staff.types";

interface HearingRoomProps {
  hearingId: string;
}

const speakerOptions: Array<{ role: SpeakerRole; label: string; helper: string }> = [
  { role: "ALL", label: "Open floor", helper: "Everyone can speak" },
  { role: "MODERATOR_ONLY", label: "Moderator only", helper: "Only moderator can speak" },
  { role: "RAISER_ONLY", label: "Raiser only", helper: "Only raiser can speak" },
  { role: "DEFENDANT_ONLY", label: "Defendant only", helper: "Only defendant can speak" },
  { role: "MUTED_ALL", label: "Mute all", helper: "Chat paused" },
];

const roleLabel = (role?: HearingParticipantRole) => {
  switch (role) {
    case "RAISER":
      return "Raiser";
    case "DEFENDANT":
      return "Defendant";
    case "MODERATOR":
      return "Moderator";
    case "WITNESS":
      return "Witness";
    case "OBSERVER":
      return "Observer";
    default:
      return "Participant";
  }
};

const speakerLabel = (role?: SpeakerRole | null) => {
  switch (role) {
    case "ALL":
      return "Open floor";
    case "MODERATOR_ONLY":
      return "Moderator only";
    case "RAISER_ONLY":
      return "Raiser only";
    case "DEFENDANT_ONLY":
      return "Defendant only";
    case "MUTED_ALL":
      return "Muted";
    default:
      return "Not set";
  }
};

const formatEnumLabel = (value?: string | null) => {
  if (!value) return "N/A";
  return value.replace(/_/g, " ");
};

const attendanceBadgeClass = (status?: string | null) => {
  switch (status) {
    case "ON_TIME":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "LATE":
    case "VERY_LATE":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "NO_SHOW":
      return "bg-red-50 text-red-700 border-red-200";
    case "NOT_STARTED":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const questionBadgeClass = (status?: string | null) => {
  switch (status) {
    case "ANSWERED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PENDING_ANSWER":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "CANCELLED_BY_MODERATOR":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const speakerAllows = (speakerRole?: SpeakerRole | null, participantRole?: HearingParticipantRole) => {
  if (!speakerRole || !participantRole) return false;
  switch (speakerRole) {
    case "ALL":
      return true;
    case "MODERATOR_ONLY":
      return participantRole === "MODERATOR";
    case "RAISER_ONLY":
      return participantRole === "RAISER";
    case "DEFENDANT_ONLY":
      return participantRole === "DEFENDANT";
    case "MUTED_ALL":
      return false;
    default:
      return false;
  }
};

export const HearingRoom = ({ hearingId }: HearingRoomProps) => {
  const [hearing, setHearing] = useState<DisputeHearingSummary | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speakerUpdating, setSpeakerUpdating] = useState(false);
  const [speakerGraceUntil, setSpeakerGraceUntil] = useState<string | null>(null);
  const [statements, setStatements] = useState<HearingStatementSummary[]>([]);
  const [questions, setQuestions] = useState<HearingQuestionSummary[]>([]);
  const [timeline, setTimeline] = useState<HearingTimelineEvent[]>([]);
  const [attendance, setAttendance] = useState<HearingAttendanceSummary | null>(null);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [questionTargetId, setQuestionTargetId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionDeadlineMinutes, setQuestionDeadlineMinutes] = useState("");
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER),
    [],
  );
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;

  const refreshHearing = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHearingById(hearingId);
      setHearing(data);
    } catch (error) {
      console.error("Failed to load hearing:", error);
      toast.error("Could not load hearing details");
    } finally {
      setLoading(false);
    }
  }, [hearingId]);

  const loadMessages = useCallback(async () => {
    if (!hearing?.disputeId) return;
    try {
      setMessagesLoading(true);
      const data = await getDisputeMessages(hearing.disputeId, {
        hearingId: hearing.id,
        limit: 100,
      });
      setMessages(data ?? []);
    } catch (error) {
      console.error("Failed to load hearing messages:", error);
      toast.error("Could not load hearing messages");
    } finally {
      setMessagesLoading(false);
    }
  }, [hearing?.disputeId, hearing?.id]);

  const loadStatements = useCallback(async () => {
    try {
      setStatementsLoading(true);
      const includeDrafts =
        currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;
      const data = await getHearingStatements(hearingId, { includeDrafts });
      setStatements(data ?? []);
    } catch (error) {
      console.error("Failed to load hearing statements:", error);
      toast.error("Could not load hearing statements");
    } finally {
      setStatementsLoading(false);
    }
  }, [hearingId, currentUserRole]);

  const loadQuestions = useCallback(async () => {
    try {
      setQuestionsLoading(true);
      const data = await getHearingQuestions(hearingId);
      setQuestions(data ?? []);
    } catch (error) {
      console.error("Failed to load hearing questions:", error);
      toast.error("Could not load hearing questions");
    } finally {
      setQuestionsLoading(false);
    }
  }, [hearingId]);

  const loadTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);
      const data = await getHearingTimeline(hearingId);
      setTimeline(data ?? []);
    } catch (error) {
      console.error("Failed to load hearing timeline:", error);
      toast.error("Could not load hearing timeline");
    } finally {
      setTimelineLoading(false);
    }
  }, [hearingId]);

  const loadAttendance = useCallback(async () => {
    if (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.STAFF) {
      return;
    }
    try {
      setAttendanceLoading(true);
      const data = await getHearingAttendance(hearingId);
      setAttendance(data);
    } catch (error) {
      console.error("Failed to load hearing attendance:", error);
      toast.error("Could not load attendance analytics");
    } finally {
      setAttendanceLoading(false);
    }
  }, [hearingId, currentUserRole]);

  useEffect(() => {
    refreshHearing();
  }, [refreshHearing]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadStatements();
  }, [loadStatements]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useHearingRealtime(hearingId, {
    onSpeakerControlChanged: (payload) => {
      if (payload?.newRole && hearing) {
        setHearing((prev) =>
          prev ? { ...prev, currentSpeakerRole: payload.newRole } : prev,
        );
      }
      if (payload?.gracePeriodUntil) {
        setSpeakerGraceUntil(payload.gracePeriodUntil);
      } else {
        setSpeakerGraceUntil(null);
      }
    },
    onMessageSent: (payload) => {
      if (!payload?.messageId || payload.hearingId !== hearingId) return;
      setMessages((prev) => {
        if (prev.some((item) => item.id === payload.messageId)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: payload.messageId,
            disputeId: payload.disputeId,
            hearingId: payload.hearingId,
            senderId: payload.senderId,
            senderRole: payload.senderRole,
            type: payload.type,
            content: payload.content,
            metadata: payload.metadata,
            replyToMessageId: payload.replyToMessageId,
            relatedEvidenceId: payload.relatedEvidenceId,
            isHidden: payload.isHidden,
            hiddenReason: payload.hiddenReason,
            createdAt: payload.createdAt ?? new Date().toISOString(),
            sender: payload.sender,
          } as DisputeMessage,
        ];
      });
    },
    onMessageHidden: (payload) => {
      if (!payload?.messageId) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === payload.messageId
            ? {
                ...message,
                isHidden: true,
                hiddenReason: payload.hiddenReason ?? message.hiddenReason,
              }
            : message,
        ),
      );
    },
  });

  const currentParticipant = useMemo(() => {
    if (!currentUserId || !hearing?.participants) return null;
    return hearing.participants.find((participant) => participant.userId === currentUserId);
  }, [currentUserId, hearing?.participants]);

  const questionTargets = useMemo(() => {
    if (!hearing?.participants) return [];
    return hearing.participants.filter(
      (participant) => participant.role !== "MODERATOR",
    );
  }, [hearing?.participants]);

  const canControlSpeaker =
    Boolean(hearing?.moderatorId && currentUserId && hearing.moderatorId === currentUserId) ||
    currentUserRole === UserRole.ADMIN;
  const canAskQuestions =
    currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;

  const canSendMessage = useMemo(() => {
    if (!hearing) return false;
    if (hearing.status !== "IN_PROGRESS") return false;
    if (!hearing.isChatRoomActive) return false;
    if (!currentParticipant) return false;
    return speakerAllows(hearing.currentSpeakerRole, currentParticipant.role);
  }, [hearing, currentParticipant]);

  const chatDisabledReason = useMemo(() => {
    if (!hearing) return "Loading hearing...";
    if (hearing.status !== "IN_PROGRESS") return "Hearing is not in progress.";
    if (!hearing.isChatRoomActive) return "Chat room is not active.";
    if (!currentParticipant) return "You are not a hearing participant.";
    if (!speakerAllows(hearing.currentSpeakerRole, currentParticipant.role)) {
      return "You do not have the floor.";
    }
    return "";
  }, [hearing, currentParticipant]);

  const handleSendMessage = async () => {
    if (!hearing || !hearing.disputeId) return;
    if (!messageInput.trim()) return;

    try {
      setSending(true);
      await sendDisputeMessage(hearing.disputeId, {
        content: messageInput.trim(),
        hearingId: hearing.id,
      });
      setMessageInput("");
    } catch (error) {
      console.error("Failed to send hearing message:", error);
      toast.error("Could not send message");
    } finally {
      setSending(false);
    }
  };

  const handleSpeakerChange = async (role: SpeakerRole) => {
    if (!hearing) return;
    try {
      setSpeakerUpdating(true);
      await updateSpeakerControl(hearing.id, role);
      setHearing((prev) => (prev ? { ...prev, currentSpeakerRole: role } : prev));
      toast.success(`Speaker role set to ${speakerLabel(role)}.`);
    } catch (error) {
      console.error("Failed to update speaker control:", error);
      toast.error("Could not update speaker control");
    } finally {
      setSpeakerUpdating(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!hearing) return;
    if (!questionTargetId) {
      toast.error("Select a target participant.");
      return;
    }
    if (!questionText.trim()) {
      toast.error("Enter a question.");
      return;
    }

    let deadlineMinutes: number | undefined;
    if (questionDeadlineMinutes) {
      const parsed = Number(questionDeadlineMinutes);
      if (Number.isFinite(parsed) && parsed > 0) {
        deadlineMinutes = Math.min(60, Math.max(1, Math.floor(parsed)));
      }
    }

    try {
      setQuestionSubmitting(true);
      await askHearingQuestion(hearing.id, {
        targetUserId: questionTargetId,
        question: questionText.trim(),
        deadlineMinutes,
      });
      toast.success("Question sent.");
      setQuestionText("");
      setQuestionTargetId("");
      setQuestionDeadlineMinutes("");
      await loadQuestions();
      await loadTimeline();
    } catch (error) {
      console.error("Failed to ask hearing question:", error);
      toast.error("Could not send question");
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const scheduleLine = useMemo(() => {
    if (!hearing) return "N/A";
    const start = new Date(hearing.scheduledAt);
    if (Number.isNaN(start.getTime())) return "Invalid schedule";
    const duration = hearing.estimatedDurationMinutes ?? 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return `${format(start, "MMM d, yyyy h:mm a")} - ${format(end, "h:mm a")}`;
  }, [hearing]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Hearing Room</h2>
          <p className="text-gray-500">
            Live hearing controls, attendance, and chat.
          </p>
        </div>
        <button
          onClick={refreshHearing}
          className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {loading || !hearing ? (
              <p className="text-sm text-gray-500">Loading hearing details...</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Hearing #{hearing.hearingNumber ?? "-"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {scheduleLine}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs border ${
                      hearing.status === "IN_PROGRESS"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : hearing.status === "SCHEDULED"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {hearing.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>Started: {hearing.startedAt ? format(new Date(hearing.startedAt), "MMM d, h:mm a") : "N/A"}</div>
                  <div>Ended: {hearing.endedAt ? format(new Date(hearing.endedAt), "MMM d, h:mm a") : "N/A"}</div>
                  <div>Speaker: {speakerLabel(hearing.currentSpeakerRole)}</div>
                  <div>Chat: {hearing.isChatRoomActive ? "Active" : "Inactive"}</div>
                </div>

                {speakerGraceUntil ? (
                  <p className="text-xs text-amber-700">
                    Speaker grace active until{" "}
                    {format(new Date(speakerGraceUntil), "h:mm a")}
                  </p>
                ) : null}

                {hearing.agenda ? (
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Agenda:</span> {hearing.agenda}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-600" />
                Hearing chat
              </h3>
              {messagesLoading ? (
                <span className="text-xs text-gray-400">Loading...</span>
              ) : null}
            </div>

            <div className="mt-4 h-[320px] overflow-y-auto bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-500">No messages yet.</p>
              ) : (
                messages.map((message) => {
                  const senderLabel =
                    message.sender?.fullName ||
                    message.sender?.email ||
                    message.senderId ||
                    "System";
                  return (
                    <div key={message.id} className="text-sm text-gray-700">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="font-medium text-gray-600">
                          {senderLabel}
                        </span>
                        <span>
                          {format(new Date(message.createdAt), "h:mm a")}
                        </span>
                      </div>
                      <div className="mt-1">
                        {message.isHidden ? (
                          <span className="text-xs text-red-500 italic">
                            Message hidden
                          </span>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-3">
              {canSendMessage ? (
                <div className="flex gap-2">
                  <input
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || !messageInput.trim()}
                    className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  {chatDisabledReason}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Participants
            </h3>
            <div className="mt-4 space-y-3">
              {hearing?.participants?.map((participant) => {
                const name =
                  participant.user?.fullName ||
                  participant.user?.email ||
                  participant.userId;
                return (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{name}</p>
                      <p className="text-xs text-gray-500">
                        {roleLabel(participant.role)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-medium ${
                          participant.isOnline ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        {participant.isOnline ? "Online" : "Offline"}
                      </span>
                      <div className="text-[11px] text-gray-400">
                        {participant.totalOnlineMinutes ?? 0}m online
                      </div>
                    </div>
                  </div>
                );
              })}
              {!hearing?.participants?.length && (
                <p className="text-xs text-gray-500">No participants loaded.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-teal-600" />
              Speaker control
            </h3>
            {canControlSpeaker ? (
              <div className="mt-4 space-y-2">
                {speakerOptions.map((option) => (
                  <button
                    key={option.role}
                    onClick={() => handleSpeakerChange(option.role)}
                    disabled={speakerUpdating || hearing?.status !== "IN_PROGRESS"}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      hearing?.currentSpeakerRole === option.role
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    } ${speakerUpdating ? "opacity-60" : ""}`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-gray-400">{option.helper}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-500">
                Only the assigned moderator or admin can control speaker roles.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                Statements
              </h3>
              {statementsLoading ? (
                <span className="text-xs text-gray-400">Loading...</span>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {statements.length === 0 ? (
                <p className="text-sm text-gray-500">No statements yet.</p>
              ) : (
                statements.map((statement) => {
                  const author =
                    statement.participant?.user?.fullName ||
                    statement.participant?.user?.email ||
                    statement.participant?.userId ||
                    "Participant";
                  const contentPreview =
                    statement.content && statement.content.length > 180
                      ? `${statement.content.slice(0, 180)}...`
                      : statement.content;
                  return (
                    <div
                      key={statement.id}
                      className="border border-gray-100 rounded-lg bg-gray-50 p-3 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {statement.title ||
                              `${formatEnumLabel(statement.type)} statement`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {author} ·{" "}
                            {format(new Date(statement.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] border ${
                            statement.status === "DRAFT"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {formatEnumLabel(statement.status)}
                        </span>
                      </div>
                      {contentPreview ? (
                        <p className="text-xs text-gray-600">{contentPreview}</p>
                      ) : null}
                      {statement.isRedacted ? (
                        <p className="text-xs text-red-500">
                          Redacted: {statement.redactedReason || "No reason provided"}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-teal-600" />
                  Questions
                </h4>
                {questionsLoading ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {questions.length === 0 ? (
                  <p className="text-sm text-gray-500">No questions yet.</p>
                ) : (
                  questions.map((question) => {
                    const askedBy =
                      question.askedBy?.fullName ||
                      question.askedBy?.email ||
                      question.askedById;
                    const target =
                      question.targetUser?.fullName ||
                      question.targetUser?.email ||
                      question.targetUserId;
                    return (
                      <div
                        key={question.id}
                        className="border border-gray-100 rounded-lg bg-white p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {askedBy} → {target}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(question.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] border ${questionBadgeClass(
                              question.status,
                            )}`}
                          >
                            {formatEnumLabel(question.status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{question.question}</p>
                        {question.answer ? (
                          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md p-2">
                            Answer: {question.answer}
                          </div>
                        ) : null}
                        {question.deadline ? (
                          <p className="text-[11px] text-gray-400">
                            Deadline:{" "}
                            {format(new Date(question.deadline), "MMM d, h:mm a")}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              {canAskQuestions ? (
                <div className="mt-4 border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Ask a question</p>
                  <div className="grid gap-2">
                    <select
                      value={questionTargetId}
                      onChange={(event) => setQuestionTargetId(event.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    >
                      <option value="">Select target</option>
                      {questionTargets.map((participant) => {
                        const label =
                          participant.user?.fullName ||
                          participant.user?.email ||
                          participant.userId;
                        return (
                          <option key={participant.id} value={participant.userId}>
                            {label} ({formatEnumLabel(participant.role)})
                          </option>
                        );
                      })}
                    </select>
                    <textarea
                      rows={2}
                      value={questionText}
                      onChange={(event) => setQuestionText(event.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                      placeholder="Write a question..."
                    />
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={questionDeadlineMinutes}
                        onChange={(event) => setQuestionDeadlineMinutes(event.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-24"
                        placeholder="Minutes"
                      />
                    </div>
                    <button
                      onClick={handleAskQuestion}
                      disabled={
                        questionSubmitting ||
                        hearing?.status !== "IN_PROGRESS" ||
                        !questionText.trim()
                      }
                      className="px-3 py-2 text-xs rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {questionSubmitting ? "Sending..." : "Send question"}
                    </button>
                    {hearing?.status !== "IN_PROGRESS" ? (
                      <p className="text-[11px] text-amber-600">
                        Questions can be asked only while the hearing is in progress.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                Timeline
              </h3>
              {timelineLoading ? (
                <span className="text-xs text-gray-400">Loading...</span>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-gray-500">No timeline events yet.</p>
              ) : (
                timeline.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 text-sm text-gray-700"
                  >
                    <div className="text-xs text-gray-400 min-w-[72px]">
                      {format(new Date(event.occurredAt), "MMM d, h:mm a")}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{event.title}</p>
                      {event.description ? (
                        <p className="text-xs text-gray-500">{event.description}</p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600" />
                Attendance
              </h3>
              {attendanceLoading ? (
                <span className="text-xs text-gray-400">Loading...</span>
              ) : null}
            </div>
            {!attendance && !attendanceLoading ? (
              <p className="mt-3 text-sm text-gray-500">
                Attendance analytics are available to staff and admin only.
              </p>
            ) : null}
            {attendance ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                    Present:{" "}
                    <span className="font-semibold text-slate-900">
                      {attendance.totals.presentCount}
                    </span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                    No-show:{" "}
                    <span className="font-semibold text-slate-900">
                      {attendance.totals.noShowCount}
                    </span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                    Late:{" "}
                    <span className="font-semibold text-slate-900">
                      {attendance.totals.lateCount}
                    </span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
                    Avg mins:{" "}
                    <span className="font-semibold text-slate-900">
                      {attendance.totals.averageAttendanceMinutes}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {attendance.participants.map((participant) => {
                    const name =
                      participant.user?.fullName ||
                      participant.user?.email ||
                      participant.userId;
                    return (
                      <div
                        key={participant.participantId}
                        className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{name}</p>
                          <p className="text-[11px] text-gray-500">
                            {formatEnumLabel(participant.role)} ·{" "}
                            {participant.attendanceMinutes ?? 0}m attended
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[11px] ${attendanceBadgeClass(
                              participant.attendanceStatus,
                            )}`}
                          >
                            {formatEnumLabel(participant.attendanceStatus)}
                          </span>
                          {participant.isNoShow ? (
                            <p className="text-[10px] text-red-500 mt-1">No-show</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
