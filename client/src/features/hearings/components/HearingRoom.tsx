
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CircleAlert,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Timer,
  Users,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  askHearingQuestion,
  closeHearingEvidenceIntake,
  getHearingWorkspace,
  openHearingEvidenceIntake,
  updateSpeakerControl,
} from "@/features/hearings/api";
import type {
  HearingParticipantRole,
  HearingWorkspaceSummary,
  SpeakerRole,
} from "@/features/hearings/types";
import { useHearingRealtime } from "@/features/hearings/hooks/useHearingRealtime";
import { sendDisputeMessage, uploadDisputeEvidence } from "@/features/disputes/api";
import { sendDisputeMessageRealtime } from "@/features/disputes/realtime";
import type { DisputeMessage } from "@/features/disputes/types/dispute.types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { UserRole } from "@/features/staff/types/staff.types";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";
import { Badge } from "@/shared/components/ui/badge";

interface HearingRoomProps {
  hearingId: string;
}

type LocalMessage = DisputeMessage & { status?: "sending" | "sent" | "delivered" | "error" };
type MobilePane = "dossier" | "conversation" | "control";
type HearingPaneId = "dossier" | "conversation" | "control";
type HearingLayout = Record<HearingPaneId, number>;

const LEGACY_LAYOUT_KEY = "hearing-room-layout-v2";
const LAYOUT_KEY = "hearing-room-layout-v3";
const PANE_IDS = ["dossier", "conversation", "control"] as const;
const DEFAULT_LAYOUT: HearingLayout = { dossier: 25, conversation: 50, control: 25 };
const LAYOUT_MIN: HearingLayout = { dossier: 20, conversation: 35, control: 20 };
const EVIDENCE_TAG_REGEX = /#EVD-([A-Za-z0-9-]+)/g;
const PREVIEWABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const isPreviewableImage = (mimeType?: string | null) =>
  Boolean(mimeType && PREVIEWABLE_IMAGE_TYPES.has(mimeType));
const isPreviewablePdf = (mimeType?: string | null) => mimeType === "application/pdf";

const roleLabel = (role?: HearingParticipantRole | string) =>
  role ? role.replace(/_/g, " ") : "Participant";

const systemRoleLabel = (role?: string | null) =>
  role ? role.replace(/_/g, " ") : "Unknown role";

const speakerLabel = (role?: SpeakerRole | null) => {
  if (!role) return "Not set";
  const map: Record<string, string> = {
    ALL: "Open floor",
    MODERATOR_ONLY: "Moderator only",
    RAISER_ONLY: "Raiser only",
    DEFENDANT_ONLY: "Defendant only",
    MUTED_ALL: "Muted",
  };
  return map[role] || role;
};

const roleBadgeClass = (role?: string) => {
  switch (role) {
    case "MODERATOR":
      return "border-teal-300 bg-teal-100 text-teal-800";
    case "RAISER":
      return "border-blue-300 bg-blue-100 text-blue-800";
    case "DEFENDANT":
      return "border-rose-300 bg-rose-100 text-rose-800";
    case "OBSERVER":
      return "border-indigo-300 bg-indigo-100 text-indigo-800";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
};

const systemRoleBadgeClass = (role?: string | null) => {
  if (role === "STAFF" || role === "ADMIN") return "border-teal-300 bg-teal-100 text-teal-800";
  if (role === "CLIENT") return "border-blue-300 bg-blue-100 text-blue-800";
  if (role === "FREELANCER") return "border-violet-300 bg-violet-100 text-violet-800";
  if (role === "BROKER") return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
};

const hearingStatusBadgeClass = (status?: string | null) => {
  if (status === "IN_PROGRESS") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (status === "SCHEDULED") return "border-blue-300 bg-blue-100 text-blue-800";
  if (status === "COMPLETED") return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "CANCELED") return "border-rose-300 bg-rose-100 text-rose-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
};

const questionStatusBadgeClass = (status?: string | null) => {
  if (status === "ANSWERED") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (status === "PENDING_ANSWER") return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
};

const statementStatusBadgeClass = (status?: string | null) => {
  if (status === "SUBMITTED") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const persistLayout = (layout: HearingLayout) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
};

const normalizeLayout = (layout: HearingLayout | null): HearingLayout | null => {
  if (!layout) return null;
  const total = PANE_IDS.reduce((sum, id) => sum + layout[id], 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  const normalized = PANE_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: Number(((layout[id] / total) * 100).toFixed(3)) }),
    {} as HearingLayout,
  );
  if (PANE_IDS.some((id) => normalized[id] < LAYOUT_MIN[id])) return null;
  return normalized;
};

const parseLayoutRecord = (value: unknown): HearingLayout | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!PANE_IDS.every((id) => isFiniteNumber(raw[id]))) return null;
  return {
    dossier: Number(raw.dossier),
    conversation: Number(raw.conversation),
    control: Number(raw.control),
  };
};

const parseLegacyLayout = (value: unknown): HearingLayout | null => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isFiniteNumber)) return null;
  return {
    dossier: Number(value[0]),
    conversation: Number(value[1]),
    control: Number(value[2]),
  };
};

const loadLayout = (): {
  layout: HearingLayout;
  recoveredFromInvalid: boolean;
  migratedLegacy: boolean;
} => {
  if (typeof window === "undefined") {
    return { layout: DEFAULT_LAYOUT, recoveredFromInvalid: false, migratedLegacy: false };
  }

  let recoveredFromInvalid = false;
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = parseLayoutRecord(JSON.parse(raw));
      const normalized = normalizeLayout(parsed);
      if (normalized) {
        return { layout: normalized, recoveredFromInvalid: false, migratedLegacy: false };
      }
      recoveredFromInvalid = true;
    }
  } catch {
    recoveredFromInvalid = true;
  }

  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_LAYOUT_KEY);
    if (legacyRaw) {
      const parsedLegacy = parseLegacyLayout(JSON.parse(legacyRaw));
      const normalizedLegacy = normalizeLayout(parsedLegacy);
      if (normalizedLegacy) {
        persistLayout(normalizedLegacy);
        window.localStorage.removeItem(LEGACY_LAYOUT_KEY);
        return { layout: normalizedLegacy, recoveredFromInvalid: false, migratedLegacy: true };
      }
      recoveredFromInvalid = true;
    }
  } catch {
    recoveredFromInvalid = true;
  }

  persistLayout(DEFAULT_LAYOUT);
  return { layout: DEFAULT_LAYOUT, recoveredFromInvalid, migratedLegacy: false };
};

const extractEvidenceId = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  const evidence = root.evidence && typeof root.evidence === "object" ? (root.evidence as Record<string, unknown>) : null;
  const dataEvidence = data?.evidence && typeof data.evidence === "object" ? (data.evidence as Record<string, unknown>) : null;
  const candidates = [root.id, data?.id, evidence?.id, dataEvidence?.id];
  const hit = candidates.find((x) => typeof x === "string" && x.trim().length > 0);
  return typeof hit === "string" ? hit : null;
};

const apiCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const root = error as Record<string, unknown>;
  const response = root.response && typeof root.response === "object" ? (root.response as Record<string, unknown>) : null;
  const data = response?.data && typeof response.data === "object" ? (response.data as Record<string, unknown>) : null;
  const msg = data?.message && typeof data.message === "object" ? (data.message as Record<string, unknown>) : null;
  return (data?.errorCode as string) || (msg?.errorCode as string) || undefined;
};

const parseTags = (content?: string | null) => {
  if (!content) return [] as string[];
  const ids = new Set<string>();
  for (const m of content.matchAll(EVIDENCE_TAG_REGEX)) if (m[1]) ids.add(m[1]);
  return Array.from(ids);
};

const Countdown = ({ workspace, nowMs }: { workspace: HearingWorkspaceSummary | null; nowMs: number }) => {
  const hearing = workspace?.hearing;
  if (!hearing) return null;
  const scheduled = new Date(hearing.scheduledAt).getTime();
  const started = hearing.startedAt ? new Date(hearing.startedAt).getTime() : scheduled;
  const end = started + (hearing.estimatedDurationMinutes ?? 60) * 60_000;
  if (hearing.status === "SCHEDULED") {
    const diff = scheduled - nowMs;
    return (
      <Badge className="border-blue-300 bg-blue-100 text-blue-800">
        {diff > 0 ? `Starts in ${Math.ceil(diff / 60_000)}m` : "Starting now"}
      </Badge>
    );
  }
  if (hearing.status === "IN_PROGRESS") {
    const diff = end - nowMs;
    return (
      <Badge
        className={
          diff < 0
            ? "border-rose-300 bg-rose-100 text-rose-800"
            : "border-emerald-300 bg-emerald-100 text-emerald-800"
        }
      >
        {diff < 0 ? `Overtime ${Math.ceil(Math.abs(diff) / 60_000)}m` : `${Math.ceil(diff / 60_000)}m left`}
      </Badge>
    );
  }
  return <Badge className="border-slate-300 bg-slate-100 text-slate-700">Ended</Badge>;
};

export const HearingRoom = ({ hearingId }: HearingRoomProps) => {
  const [workspace, setWorkspace] = useState<HearingWorkspaceSummary | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [speakerUpdating, setSpeakerUpdating] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");
  const [previewEvidenceId, setPreviewEvidenceId] = useState<string | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceAttaching, setEvidenceAttaching] = useState(false);
  const [intakeReason, setIntakeReason] = useState("");
  const [intakeUpdating, setIntakeUpdating] = useState(false);
  const [questionTargetId, setQuestionTargetId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("conversation");
  const [layoutState] = useState(() => loadLayout());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const layout = layoutState.layout;

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  const currentUser = useMemo(() => getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER), []);
  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role;

  const refreshWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHearingWorkspace(hearingId);
      setWorkspace(data);
      setMessages((data.messages ?? []).map((m) => ({ ...m, status: "sent" })));
      if (data.evidence?.length && !previewEvidenceId) setPreviewEvidenceId(data.evidence[0].id);
    } catch (error) {
      console.error(error);
      toast.error("Could not load hearing workspace");
    } finally {
      setLoading(false);
    }
  }, [hearingId, previewEvidenceId]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    if (layoutState.recoveredFromInvalid) {
      toast.message("Saved panel layout was invalid. Restored default 25/50/25.");
    } else if (layoutState.migratedLegacy) {
      toast.message("Panel layout upgraded to the latest format.");
    }
  }, [layoutState.migratedLegacy, layoutState.recoveredFromInvalid]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hearing = workspace?.hearing;
  const evidence = workspace?.evidence ?? [];
  const evidenceById = useMemo(() => new Map(evidence.map((x) => [x.id, x])), [evidence]);
  const previewEvidence = previewEvidenceId ? evidenceById.get(previewEvidenceId) : undefined;

  const participantByUser = useMemo(() => {
    const map = new Map<string, HearingParticipantRole | string>();
    hearing?.participants?.forEach((p) => map.set(p.userId, p.role));
    return map;
  }, [hearing?.participants]);

  const systemRoleByUser = useMemo(() => {
    const map = new Map<string, string>();
    hearing?.participants?.forEach((p) => {
      if (p.user?.role) map.set(p.userId, String(p.user.role));
    });
    return map;
  }, [hearing?.participants]);

  const currentParticipant = useMemo(
    () => hearing?.participants?.find((p) => p.userId === currentUserId) ?? null,
    [hearing?.participants, currentUserId],
  );

  const canSendMessage = Boolean(hearing?.permissions?.canSendMessage);
  const canUploadEvidence = Boolean(hearing?.permissions?.canUploadEvidence);
  const canAttachEvidence = Boolean(hearing?.permissions?.canAttachEvidenceLink);
  const canManageIntake = Boolean(hearing?.permissions?.canManageEvidenceIntake);
  const canControlSpeaker = Boolean(
    (hearing?.moderatorId && currentUserId && hearing.moderatorId === currentUserId) ||
      currentUserRole === UserRole.ADMIN,
  );
  const canAskQuestions = currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.STAFF;
  const uploadBlockedReason =
    currentUserRole === UserRole.STAFF || currentUserRole === UserRole.ADMIN
      ? "Staff/Admin are cite-only. New evidence uploads are disabled."
      : hearing?.permissions?.uploadEvidenceBlockedReason || "Upload blocked";

  const chatReason = hearing?.permissions?.sendMessageBlockedReason || "You cannot speak right now.";

  const handleRealtimeMessageSent = useCallback(
    (payload: any) => {
      if (!payload?.messageId || payload.hearingId !== hearingId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.messageId)) return prev;
        return [...prev, { ...payload, id: payload.messageId, createdAt: payload.createdAt || new Date().toISOString() }];
      });
      requestAnimationFrame(() => {
        const el = messagesRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
    [hearingId],
  );

  useHearingRealtime(hearingId, {
    onMessageSent: handleRealtimeMessageSent,
    onSpeakerControlChanged: (payload) => {
      if (!payload?.newRole) return;
      setWorkspace((prev) =>
        prev ? { ...prev, hearing: { ...prev.hearing, currentSpeakerRole: payload.newRole } } : prev,
      );
    },
    onEvidenceIntakeChanged: (payload) => {
      if (typeof payload?.isOpen !== "boolean") return;
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              hearing: { ...prev.hearing, isEvidenceIntakeOpen: payload.isOpen },
              evidenceIntake: { ...prev.evidenceIntake, isOpen: payload.isOpen, reason: payload.reason || prev.evidenceIntake.reason },
            }
          : prev,
      );
    },
  });

  const handleSend = async () => {
    if (!hearing?.disputeId || !messageInput.trim()) return;
    if (!canSendMessage) return toast.error(chatReason);
    const content = messageInput.trim();
    setMessageInput("");
    try {
      setSending(true);
      await sendDisputeMessageRealtime({ disputeId: hearing.disputeId, hearingId: hearing.id, content });
    } catch {
      try {
        await sendDisputeMessage(hearing.disputeId, { hearingId: hearing.id, content });
        await refreshWorkspace();
      } catch {
        toast.error("Could not send message");
      }
    } finally {
      setSending(false);
    }
  };

  const attachEvidence = async (evidenceId: string) => {
    if (!hearing?.disputeId || !evidenceId) return;
    if (!canAttachEvidence) return toast.error(hearing?.permissions?.attachEvidenceBlockedReason || "Attach blocked");
    try {
      setEvidenceAttaching(true);
      const item = evidenceById.get(evidenceId);
      await sendDisputeMessageRealtime({
        disputeId: hearing.disputeId,
        hearingId: hearing.id,
        type: "EVIDENCE_LINK",
        relatedEvidenceId: evidenceId,
        content: `Attached evidence: ${item?.fileName || evidenceId} (#EVD-${evidenceId})`,
      });
      setSelectedEvidenceId("");
      setPreviewEvidenceId(evidenceId);
    } catch {
      toast.error("Could not attach evidence link");
    } finally {
      setEvidenceAttaching(false);
    }
  };

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !hearing?.disputeId) return;
    if (!canUploadEvidence) {
      toast.error(hearing?.permissions?.uploadEvidenceBlockedReason || "Upload blocked");
      event.target.value = "";
      return;
    }
    try {
      setEvidenceUploading(true);
      const response = await uploadDisputeEvidence(hearing.disputeId, file, evidenceDescription.trim() || undefined);
      const evdId = extractEvidenceId(response);
      await refreshWorkspace();
      if (evdId) {
        setPreviewEvidenceId(evdId);
        if (canAttachEvidence) await attachEvidence(evdId);
      }
      setEvidenceDescription("");
    } catch (error) {
      const code = apiCode(error);
      if (code === "HEARING_EVIDENCE_WINDOW_CLOSED") toast.error("Evidence intake is closed.");
      else if (code === "STAFF_UPLOAD_FORBIDDEN") toast.error("Staff cannot upload new evidence.");
      else toast.error("Could not upload evidence");
    } finally {
      setEvidenceUploading(false);
      event.target.value = "";
    }
  };

  const onOpenIntake = async () => {
    if (!hearing) return;
    if (!canManageIntake) return toast.error(hearing.permissions?.manageEvidenceIntakeBlockedReason || "Not allowed");
    if (!intakeReason.trim()) return toast.error("Reason is required.");
    try {
      setIntakeUpdating(true);
      await openHearingEvidenceIntake(hearing.id, intakeReason.trim());
      setIntakeReason("");
      await refreshWorkspace();
    } catch {
      toast.error("Could not open intake");
    } finally {
      setIntakeUpdating(false);
    }
  };

  const onCloseIntake = async () => {
    if (!hearing) return;
    if (!canManageIntake) return;
    try {
      setIntakeUpdating(true);
      await closeHearingEvidenceIntake(hearing.id);
      await refreshWorkspace();
    } catch {
      toast.error("Could not close intake");
    } finally {
      setIntakeUpdating(false);
    }
  };

  const onAskQuestion = async () => {
    if (!hearing || !questionTargetId || !questionText.trim()) return;
    try {
      setQuestionSubmitting(true);
      await askHearingQuestion(hearing.id, { targetUserId: questionTargetId, question: questionText.trim() });
      setQuestionText("");
      setQuestionTargetId("");
      await refreshWorkspace();
    } catch {
      toast.error("Could not send question");
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const handleLayoutChange = useCallback((nextLayout: Record<string, number>) => {
    const normalized = normalizeLayout(parseLayoutRecord(nextLayout));
    if (normalized) persistLayout(normalized);
  }, []);

  const paneCardClass =
    "rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100";

  const dossierPane = (
    <div className="space-y-5">
      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-3">
          <Gavel className="w-5 h-5 text-teal-600" />
          Dispute dossier
        </h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Badge className={hearingStatusBadgeClass(workspace?.dossier?.dispute?.status)}>
            {workspace?.dossier?.dispute?.status?.replace(/_/g, " ") || "STATUS N/A"}
          </Badge>
          <Badge className="border-sky-300 bg-sky-100 text-sky-800">
            {workspace?.dossier?.dispute?.phase?.replace(/_/g, " ") || "PHASE N/A"}
          </Badge>
        </div>
        <div className="mt-4 text-sm text-slate-700 space-y-3 leading-6">
          <p>
            Project:{" "}
            <span className="font-semibold text-slate-900">
              {workspace?.dossier?.project?.title || "N/A"}
            </span>
          </p>
          <p>
            Milestone:{" "}
            <span className="font-semibold text-slate-900">
              {workspace?.dossier?.milestone?.milestoneTitle || "N/A"}
            </span>
          </p>
        </div>
      </div>

      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900">Contracts</h3>
        <div className="mt-3 space-y-3 text-sm">
          {workspace?.dossier?.contracts?.length ? (
            workspace.dossier.contracts.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/60">
                <p className="font-semibold text-slate-900">{c.title || c.id}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Badge className="border-slate-300 bg-white text-slate-700">
                    {c.status?.replace(/_/g, " ") || "Unknown status"}
                  </Badge>
                  {c.contractUrl ? (
                    <a
                      href={c.contractUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-700 inline-flex items-center gap-1.5 font-medium hover:text-teal-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open contract
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No contracts</p>
          )}
        </div>
      </div>
    </div>
  );

  const conversationPane = (
    <div className="space-y-5">
      <div className={`${paneCardClass} space-y-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-teal-300 bg-teal-100 text-teal-800">
                PHASE {workspace?.phase?.current?.replace(/_/g, " ") || "N/A"}
              </Badge>
              <Badge className={hearingStatusBadgeClass(hearing?.status)}>
                {hearing?.status?.replace(/_/g, " ") || "UNKNOWN"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>Speaker floor:</span>
              <Badge className="border-cyan-300 bg-cyan-100 text-cyan-800">
                {speakerLabel(hearing?.currentSpeakerRole)}
              </Badge>
            </div>
          </div>
          <Countdown workspace={workspace} nowMs={nowMs} />
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden ring-1 ring-slate-200">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
            style={{ width: `${workspace?.phase?.progressPercent ?? 0}%` }}
          />
        </div>
        {workspace?.phase?.gate && !workspace.phase.gate.canTransition ? (
          <div className="text-sm text-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <CircleAlert className="w-5 h-5 mt-0.5 text-amber-600" />
              <p>{workspace.phase.gate.reason}</p>
            </div>
            {workspace.phase.gate.missingParticipants?.length ? (
              <div className="space-y-2">
                <p className="font-semibold">
                  Missing {workspace.phase.gate.requiredRole.toLowerCase()} statement submitters:
                </p>
                <div className="flex flex-wrap gap-2">
                  {workspace.phase.gate.missingParticipants.map((item) => (
                    <Badge key={item.participantId} className="border-amber-300 bg-white text-amber-800">
                      {item.displayName}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-teal-600" />
          Chat
        </h3>
        <div
          ref={messagesRef}
          className="mt-4 h-[380px] overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3"
        >
          {messages.map((m) => {
            const sender = m.sender?.fullName || m.sender?.email || m.senderId || "System";
            const hearingRole = m.senderHearingRole || (m.senderId ? participantByUser.get(m.senderId) : undefined);
            const systemRole =
              m.sender?.role || m.senderRole || (m.senderId ? systemRoleByUser.get(m.senderId) : undefined);
            const tags = [...new Set([...parseTags(m.content), ...(m.relatedEvidenceId ? [m.relatedEvidenceId] : [])])];
            return (
              <div key={m.id} className="bg-white border border-slate-200 rounded-lg p-4 text-sm shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <p className="font-semibold text-slate-900">{sender}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className={roleBadgeClass(String(hearingRole || ""))}>
                    {hearingRole ? roleLabel(hearingRole) : "No hearing role"}
                  </Badge>
                  <Badge className={systemRoleBadgeClass(String(systemRole || ""))}>
                    {systemRoleLabel(String(systemRole || ""))}
                  </Badge>
                </div>
                <p className="text-slate-600">{m.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((id) => (
                    <button
                      key={id}
                      onClick={() => setPreviewEvidenceId(id)}
                      className="px-3 py-1 rounded-full border border-cyan-300 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 text-xs"
                    >
                      #EVD-{id.slice(0, 8)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!messages.length ? <p className="text-sm text-gray-500">No messages yet.</p> : null}
        </div>

        <div className="mt-4 space-y-3 border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/70">
          <p className="text-sm font-semibold text-slate-700">Evidence actions</p>
          <div className="flex gap-3">
            <select value={selectedEvidenceId} onChange={(e) => setSelectedEvidenceId(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select existing evidence</option>
              {evidence.map((ev) => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
            </select>
            <button onClick={() => void attachEvidence(selectedEvidenceId)} disabled={!selectedEvidenceId || evidenceAttaching || !canAttachEvidence} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-50">{evidenceAttaching ? "..." : "Attach"}</button>
          </div>
          {!canAttachEvidence ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              {hearing?.permissions?.attachEvidenceBlockedReason || "Attach blocked"}
            </p>
          ) : null}

          {canUploadEvidence ? (
            <>
              <input ref={evidenceInputRef} type="file" className="hidden" onChange={onUploadFile} />
              <div className="flex gap-3">
                <input value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} placeholder="Description (optional)" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={() => evidenceInputRef.current?.click()} disabled={evidenceUploading} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">{evidenceUploading ? "Uploading" : "Upload"}</button>
              </div>
            </>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{uploadBlockedReason}</p>
          )}
        </div>

        {canSendMessage ? (
          <form className="mt-4 flex gap-3" onSubmit={(e) => { e.preventDefault(); void handleSend(); }}>
            <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Type a message..." className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-base" />
            <button type="submit" disabled={sending || !messageInput.trim()} className="px-5 py-3 rounded-lg bg-teal-600 text-white text-base disabled:opacity-50">Send</button>
          </form>
        ) : <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{chatReason}</p>}
      </div>

      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900">Statements</h3>
        <div className="mt-3 max-h-[280px] overflow-y-auto space-y-3">
          {workspace?.statements?.length ? workspace.statements.slice(-40).map((statement) => {
            const participantName =
              statement.participant?.user?.fullName ||
              statement.participant?.user?.email ||
              statement.participant?.userId ||
              statement.participantId;
            const hearingRole = statement.participant?.role;
            const systemRole = statement.participant?.user?.role;
            return (
              <div key={statement.id} className="rounded-lg border border-slate-200 p-4 text-sm bg-slate-50/60">
                <p className="font-semibold text-slate-900">{participantName}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className={roleBadgeClass(String(hearingRole || ""))}>
                    {hearingRole ? roleLabel(hearingRole) : "No hearing role"}
                  </Badge>
                  <Badge className={systemRoleBadgeClass(systemRole)}>
                    {systemRoleLabel(systemRole)}
                  </Badge>
                  <Badge className="border-indigo-300 bg-indigo-100 text-indigo-800">
                    {statement.type}
                  </Badge>
                  <Badge className={statementStatusBadgeClass(statement.status)}>
                    {statement.status}
                  </Badge>
                </div>
                {statement.title ? <p className="font-medium text-slate-700">{statement.title}</p> : null}
                <p className="text-slate-600 line-clamp-3">{statement.content}</p>
              </div>
            );
          }) : <p className="text-sm text-gray-500">No statements yet.</p>}
        </div>
      </div>

      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-3"><HelpCircle className="w-5 h-5 text-teal-600" />Questions</h3>
        <div className="mt-3 max-h-[280px] overflow-y-auto space-y-3">
          {workspace?.questions?.length ? workspace.questions.slice(-40).map((question) => {
            const askedByName =
              question.askedBy?.fullName || question.askedBy?.email || question.askedById;
            const targetName =
              question.targetUser?.fullName || question.targetUser?.email || question.targetUserId;
            const askedByHearingRole = question.askedById ? participantByUser.get(question.askedById) : undefined;
            const targetHearingRole = question.targetUserId
              ? participantByUser.get(question.targetUserId)
              : undefined;
            return (
              <div key={question.id} className="rounded-lg border border-slate-200 p-4 text-sm space-y-2 bg-slate-50/60">
                <p className="font-semibold text-slate-900">Q: {question.question}</p>
                <p className="text-slate-500">Asked by {askedByName}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={roleBadgeClass(String(askedByHearingRole || ""))}>
                    {askedByHearingRole ? roleLabel(askedByHearingRole) : "No hearing role"}
                  </Badge>
                  <Badge className={systemRoleBadgeClass(question.askedBy?.role)}>
                    {systemRoleLabel(question.askedBy?.role)}
                  </Badge>
                </div>
                <p className="text-slate-500">Target {targetName}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={roleBadgeClass(String(targetHearingRole || ""))}>
                    {targetHearingRole ? roleLabel(targetHearingRole) : "No hearing role"}
                  </Badge>
                  <Badge className={systemRoleBadgeClass(question.targetUser?.role)}>
                    {systemRoleLabel(question.targetUser?.role)}
                  </Badge>
                  <Badge className={questionStatusBadgeClass(question.status)}>
                    {question.status}
                  </Badge>
                </div>
                {question.answer ? <p className="text-emerald-700">Answer: {question.answer}</p> : null}
              </div>
            );
          }) : <p className="text-sm text-gray-500">No questions yet.</p>}
        </div>
        {canAskQuestions ? (
          <div className="mt-3 space-y-3">
            <select value={questionTargetId} onChange={(e) => setQuestionTargetId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select target</option>
              {hearing?.participants?.filter((p) => p.role !== "MODERATOR").map((p) => <option key={p.id} value={p.userId}>{p.user?.fullName || p.user?.email || p.userId} ({roleLabel(p.role)})</option>)}
            </select>
            <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Write a question" />
            <button onClick={() => void onAskQuestion()} disabled={questionSubmitting || !questionTargetId || !questionText.trim()} className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">Ask</button>
          </div>
        ) : <p className="mt-3 text-sm text-gray-500">Only staff/admin can ask questions.</p>}
      </div>
    </div>
  );

  const controlPane = (
    <div className="space-y-5">
      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-3"><Users className="w-5 h-5 text-teal-600" />Participants</h3>
        <div className="mt-3 space-y-3 text-sm">
          {hearing?.participants?.map((p) => (
            <div key={p.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/60">
              <p className="font-semibold text-slate-900">{p.user?.fullName || p.user?.email || p.userId}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className={roleBadgeClass(p.role)}>{roleLabel(p.role)}</Badge>
                <Badge className={systemRoleBadgeClass(p.user?.role)}>{p.user?.role || "N/A"}</Badge>
                <Badge
                  className={
                    p.isOnline
                      ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                      : "border-slate-300 bg-slate-100 text-slate-700"
                  }
                >
                  {p.isOnline ? "ONLINE" : "OFFLINE"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900">Attendance</h3>
        {workspace?.attendance ? (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">Online: <span className="font-semibold text-slate-900">{workspace.attendance.totals.presentOnlineCount ?? 0}</span></div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">Ever joined: <span className="font-semibold text-slate-900">{workspace.attendance.totals.presentEverJoinedCount ?? workspace.attendance.totals.presentCount}</span></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">Late: <span className="font-semibold text-slate-900">{workspace.attendance.totals.lateCount + workspace.attendance.totals.veryLateCount}</span></div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">No-show: <span className="font-semibold text-slate-900">{workspace.attendance.totals.noShowCount}</span></div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Attendance visible for staff/admin only.</p>
        )}
      </div>

      <div className={`${paneCardClass} space-y-3`}>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-3"><Volume2 className="w-5 h-5 text-teal-600" />Speaker control</h3>
        {canControlSpeaker ? (["ALL", "MODERATOR_ONLY", "RAISER_ONLY", "DEFENDANT_ONLY", "MUTED_ALL"] as SpeakerRole[]).map((role) => (
          <button key={role} onClick={async () => { if (!hearing) return; setSpeakerUpdating(true); try { await updateSpeakerControl(hearing.id, role); setWorkspace((prev) => prev ? { ...prev, hearing: { ...prev.hearing, currentSpeakerRole: role } } : prev); } catch { toast.error("Could not update speaker control"); } finally { setSpeakerUpdating(false); } }} disabled={speakerUpdating || hearing?.status !== "IN_PROGRESS"} className={`w-full text-left px-4 py-3 rounded-lg border text-sm ${hearing?.currentSpeakerRole === role ? "border-teal-400 bg-teal-50 text-teal-700" : "border-gray-200 text-slate-600"}`}>
            {speakerLabel(role)}
          </button>
        )) : <p className="text-sm text-gray-500">Only moderator/admin can control floor.</p>}
      </div>

      <div className={`${paneCardClass} space-y-3`}>
        <p className="text-base font-semibold text-slate-900 flex items-center gap-3"><Timer className="w-5 h-5 text-teal-600" />Evidence intake</p>
        <Badge
          className={
            workspace?.evidenceIntake?.isOpen
              ? "border-emerald-300 bg-emerald-100 text-emerald-800"
              : "border-slate-300 bg-slate-100 text-slate-700"
          }
        >
          {workspace?.evidenceIntake?.isOpen ? "OPEN" : "CLOSED"}
        </Badge>
        {workspace?.evidenceIntake?.reason ? <p className="text-sm text-slate-500">Reason: {workspace.evidenceIntake.reason}</p> : null}
        {canManageIntake ? (
          workspace?.evidenceIntake?.isOpen ? (
            <button onClick={() => void onCloseIntake()} disabled={intakeUpdating} className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm">Close intake</button>
          ) : (
            <>
              <textarea value={intakeReason} onChange={(e) => setIntakeReason(e.target.value)} rows={3} placeholder="Reason to open intake" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={() => void onOpenIntake()} disabled={intakeUpdating || !intakeReason.trim()} className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm">Open intake</button>
            </>
          )
        ) : <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{hearing?.permissions?.manageEvidenceIntakeBlockedReason}</p>}
      </div>

      <div className={paneCardClass}>
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-3"><FileText className="w-5 h-5 text-teal-600" />Evidence preview</h3>
        <select value={previewEvidenceId ?? ""} onChange={(e) => setPreviewEvidenceId(e.target.value || null)} className="mt-3 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Select evidence</option>
          {evidence.map((ev) => <option key={ev.id} value={ev.id}>{ev.fileName}</option>)}
        </select>
        {previewEvidence ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{previewEvidence.fileName}</p>
            <p className="text-slate-500">{previewEvidence.mimeType}</p>
            {isPreviewableImage(previewEvidence.mimeType) && previewEvidence.signedUrl ? (
              <img
                src={previewEvidence.signedUrl}
                alt={previewEvidence.fileName}
                className="max-h-[280px] w-full object-contain rounded-lg border border-gray-200 bg-slate-50"
              />
            ) : isPreviewablePdf(previewEvidence.mimeType) && previewEvidence.signedUrl ? (
              <iframe
                src={previewEvidence.signedUrl}
                title={previewEvidence.fileName}
                className="h-[320px] w-full rounded-lg border border-gray-200 bg-white"
              />
            ) : null}
            <div className="flex gap-3">
              <button onClick={async () => { if (!previewEvidence) return; if (!previewEvidence.signedUrl) return; const res = await fetch(previewEvidence.signedUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = previewEvidence.fileName; a.click(); URL.revokeObjectURL(url); }} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm inline-flex items-center gap-2"><Download className="w-4 h-4" />Download</button>
              {previewEvidence.signedUrl ? <a href={previewEvidence.signedUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border border-gray-200 text-sm inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" />Open</a> : null}
            </div>
          </div>
        ) : <p className="mt-3 text-sm text-gray-500">Select evidence to preview.</p>}
      </div>
    </div>
  );

  if (loading && !workspace) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-gray-500 shadow-sm ring-1 ring-slate-100">
        Loading hearing workspace...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Hearing Room</h2>
          <p className="text-base text-gray-500">3-pane courtroom workspace</p>
          <div className="flex flex-wrap gap-3">
            <Badge className="border-teal-300 bg-teal-100 text-teal-800">Live workspace</Badge>
            {currentParticipant?.role ? (
              <Badge className={roleBadgeClass(currentParticipant.role)}>
                Your hearing role: {roleLabel(currentParticipant.role)}
              </Badge>
            ) : null}
          </div>
        </div>
        <button onClick={() => void refreshWorkspace()} className="px-4 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button>
      </div>

      <div className="xl:hidden rounded-xl border border-slate-200 bg-white p-3 flex gap-3 shadow-sm ring-1 ring-slate-100">
        {(["dossier", "conversation", "control"] as MobilePane[]).map((pane) => <button key={pane} onClick={() => setMobilePane(pane)} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold capitalize ${mobilePane === pane ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>{pane}</button>)}
      </div>

      <div className="xl:hidden">
        {mobilePane === "dossier" && dossierPane}
        {mobilePane === "conversation" && conversationPane}
        {mobilePane === "control" && controlPane}
      </div>

      <div className="hidden xl:block">
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChange={handleLayoutChange}
          className="min-h-[860px] h-[calc(100vh-200px)] rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-100 shadow-sm ring-1 ring-slate-100"
        >
          <ResizablePanel id="dossier" defaultSize={layout.dossier} minSize={20}><div className="h-full overflow-y-auto p-5">{dossierPane}</div></ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="conversation" defaultSize={layout.conversation} minSize={35}><div className="h-full overflow-y-auto p-5">{conversationPane}</div></ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="control" defaultSize={layout.control} minSize={20}><div className="h-full overflow-y-auto p-5">{controlPane}</div></ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

