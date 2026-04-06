import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  Clock,
  FileText,
  History,
  MessageSquare,
  ExternalLink,
  Scale,
  ShieldAlert,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DisputeComplexityBadge } from "./DisputeComplexityBadge";
import { EvidenceVault } from "../evidence/EvidenceVault";
import { InternalCaseNotesPanel } from "./InternalCaseNotesPanel";
import { DisputeHearingPanel } from "../hearings/DisputeHearingPanel";
import { VerdictWizard } from "../wizard/VerdictWizard";
import { useDisputeRealtime } from "@/features/disputes/hooks/useDisputeRealtime";
import { AppealDialog } from "@/features/hearings/components/hearing-room/AppealDialog";
import { AcceptVerdictDialog } from "@/features/hearings/components/hearing-room/AcceptVerdictDialog";
import { VerdictAnnouncement } from "@/features/hearings/components/hearing-room/VerdictAnnouncement";
import {
  acceptDisputeVerdict,
  getDisputeVerdict,
} from "@/features/hearings/api";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { triggerBlobDownload } from "@/shared/utils/download";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  submitDisputeEscalationRequest,
  getDisputeActivities,
  getDisputeComplexity,
  getDisputeDetail,
  getDisputeDossier,
  exportDisputeDossier,
  invalidateDisputeDetailCache,
  invalidateDisputesCache,
  submitDisputeAppeal,
  submitDisputeRejectionAppeal,
  submitNeutralPanelRecommendation,
  submitDisputeReviewRequest,
} from "../../api";
import type {
  DisputeActivity,
  DisputeComplexity,
  DisputeDossier,
  DisputeSummary,
} from "../../types/dispute.types";
import type { VerdictSummary } from "@/features/hearings/types";
import { DisputeStatus, UserRole } from "../../../staff/types/staff.types";
import {
  resolveParticipantRoleBasePath,
  resolveProfileViewerBasePath,
} from "@/features/hearings/utils/hearingRouting";

interface DisputeDetailHubProps {
  disputeId?: string;
  initialDispute?: DisputeSummary;
  initialTab?: string;
}

const TimelineRoute = ({
  activities,
  loading,
}: {
  activities: DisputeActivity[];
  loading: boolean;
}) => {
  if (loading) {
    return <div className="p-4 text-gray-500">Loading timeline...</div>;
  }

  if (!activities.length) {
    return <div className="p-4 text-gray-500">No activity yet.</div>;
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const actorLabel =
          activity.actor?.fullName ||
          activity.actor?.email ||
          activity.actorId ||
          "System";
        const timestamp = activity.timestamp
          ? format(new Date(activity.timestamp), "MMM d, yyyy h:mm a")
          : "Unknown time";

        return (
          <div
            key={activity.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {activity.action}
                </p>
                <p className="mt-1 text-xs text-gray-500">{actorLabel}</p>
                {activity.description ? (
                  <p className="mt-2 text-sm text-gray-700">
                    {activity.description}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {timestamp}
                </div>
                {activity.isInternal ? (
                  <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    Internal
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const formatAppealDeadlineText = (appealDeadline?: string | null) => {
  if (!appealDeadline) return undefined;
  const diff = new Date(appealDeadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.ceil((diff % 3_600_000) / 60_000);
  return hours > 0
    ? `${hours}h ${minutes}m remaining`
    : `${minutes}m remaining`;
};

const caseStageLabelMap: Record<string, string> = {
  FILED: "Filed",
  TRIAGE: "Triage",
  PRE_HEARING_SUBMISSIONS: "Pre-hearing submissions",
  HEARING_IN_PROGRESS: "Hearing docket active",
  DELIBERATION: "Deliberation",
  VERDICT_ISSUED: "Verdict issued",
  APPEAL_WINDOW: "Appeal window",
  APPEAL_HEARING: "Appeal hearing",
  FINAL_ARCHIVE: "Final archive",
};

export const DisputeDetailHub = ({
  disputeId,
  initialDispute,
  initialTab,
}: DisputeDetailHubProps) => {
  const navigate = useNavigate();
  const normalizedTab = initialTab?.toLowerCase();
  const tabIndexMap: Record<string, number> = {
    timeline: 0,
    hearings: 1,
    hearing: 1,
    evidence: 2,
    "evidence-vault": 2,
    "internal-notes": 3,
    discussion: 3,
    chat: 3,
    resolution: 1,
    verdict: 1,
  };
  const migrationBanner =
    normalizedTab === "resolution" || normalizedTab === "verdict"
      ? "Resolution tab was removed. Verdict must be issued transparently from Hearing Room or appeal review."
      : normalizedTab === "discussion" || normalizedTab === "chat"
        ? "Case Discussion (Async) has been replaced by Internal Case Notes."
        : null;
  const initialIndex =
    normalizedTab && tabIndexMap[normalizedTab] !== undefined
      ? tabIndexMap[normalizedTab]
      : 0;

  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [dispute, setDispute] = useState<DisputeSummary | null>(
    initialDispute ?? null,
  );
  const [activities, setActivities] = useState<DisputeActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [complexity, setComplexity] = useState<DisputeComplexity | null>(null);
  const [dossier, setDossier] = useState<DisputeDossier | null>(null);
  const [verdict, setVerdict] = useState<VerdictSummary | null>(null);
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const [acceptVerdictDialogOpen, setAcceptVerdictDialogOpen] = useState(false);
  const [acceptVerdictLoading, setAcceptVerdictLoading] = useState(false);
  const [appealWizardOpen, setAppealWizardOpen] = useState(false);
  const [dossierExporting, setDossierExporting] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [requestDialogMode, setRequestDialogMode] = useState<
    | "impact-review"
    | "support-escalation"
    | "admin-oversight"
    | "neutral-panel"
    | null
  >(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewImpactSummary, setReviewImpactSummary] = useState("");
  const [panelRecommendation, setPanelRecommendation] = useState<
    "UPHOLD" | "OVERTURN" | "NEEDS_HEARING"
  >("UPHOLD");
  const [panelSummary, setPanelSummary] = useState("");
  const [panelRationale, setPanelRationale] = useState("");
  const [panelSubmitting, setPanelSubmitting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const currentUser = useMemo(() => {
    return getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER);
  }, []);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const contractBasePath = useMemo(
    () => resolveParticipantRoleBasePath(currentUser?.role),
    [currentUser?.role],
  );
  const profileBasePath = useMemo(
    () => resolveProfileViewerBasePath(currentUser?.role),
    [currentUser?.role],
  );
  const canViewInternal = useMemo(() => {
    return (
      currentUser?.role === UserRole.ADMIN ||
      currentUser?.role === UserRole.STAFF
    );
  }, [currentUser]);

  const fetchDetail = useCallback(
    async (preferCache: boolean = true) => {
      if (!disputeId) return;
      try {
        setLoading(true);
        const detail = await getDisputeDetail(disputeId, { preferCache });
        setDispute((prev) => ({
          ...(prev ?? ({} as DisputeSummary)),
          ...detail,
        }));
      } catch (error) {
        console.error("Failed to load dispute detail:", error);
        toast.error("Could not load dispute details");
      } finally {
        setLoading(false);
      }
    },
    [disputeId],
  );

  const fetchActivities = useCallback(
    async (preferCache: boolean = true) => {
      if (!disputeId) return;
      try {
        setActivityLoading(true);
        const data = await getDisputeActivities(disputeId, canViewInternal, {
          preferCache,
        });
        setActivities(data ?? []);
      } catch (error) {
        console.error("Failed to load dispute activities:", error);
      } finally {
        setActivityLoading(false);
      }
    },
    [canViewInternal, disputeId],
  );

  const fetchComplexity = useCallback(
    async (preferCache: boolean = true) => {
      if (!disputeId || !canViewInternal) {
        setComplexity(null);
        return;
      }
      try {
        const data = await getDisputeComplexity(disputeId, { preferCache });
        setComplexity(data.data);
      } catch (error) {
        console.error("Failed to load dispute complexity:", error);
      }
    },
    [canViewInternal, disputeId],
  );

  const fetchVerdict = useCallback(async () => {
    if (!disputeId) return;
    try {
      const data = await getDisputeVerdict(disputeId);
      setVerdict(data);
    } catch (error) {
      console.error("Failed to load dispute verdict:", error);
      setVerdict(null);
    }
  }, [disputeId]);

  const fetchDossier = useCallback(async () => {
    if (!disputeId) return;
    try {
      const data = await getDisputeDossier(disputeId);
      setDossier(data);
    } catch (error) {
      console.error("Failed to load dispute dossier:", error);
      setDossier(null);
    }
  }, [disputeId]);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex, disputeId]);

  useEffect(() => {
    if (initialDispute?.id && initialDispute.id === disputeId) {
      setDispute(initialDispute);
    }
  }, [initialDispute, disputeId]);

  useEffect(() => {
    if (!disputeId) {
      setDispute(initialDispute ?? null);
      setVerdict(null);
      return;
    }

    void fetchDetail(true);
    void fetchActivities(true);
    void fetchComplexity(true);
    void fetchDossier();
    void fetchVerdict();
  }, [
    disputeId,
    initialDispute,
    fetchActivities,
    fetchComplexity,
    fetchDetail,
    fetchDossier,
    fetchVerdict,
  ]);

  const handleRealtimeRefresh = useCallback(() => {
    void fetchDetail(false);
    void fetchActivities(false);
    void fetchComplexity(false);
    void fetchDossier();
    void fetchVerdict();
    setRefreshToken((prev) => prev + 1);
  }, [
    fetchActivities,
    fetchComplexity,
    fetchDetail,
    fetchDossier,
    fetchVerdict,
  ]);

  useDisputeRealtime(disputeId, {
    onEvidenceUploaded: handleRealtimeRefresh,
    onVerdictIssued: handleRealtimeRefresh,
    onHearingEnded: handleRealtimeRefresh,
  });

  const headerStatusStyle = (status?: DisputeStatus) => {
    switch (status) {
      case DisputeStatus.TRIAGE_PENDING:
        return "bg-violet-50 text-violet-700 border-violet-200";
      case DisputeStatus.PREVIEW:
        return "bg-sky-50 text-sky-700 border-sky-200";
      case DisputeStatus.PENDING_REVIEW:
        return "bg-amber-50 text-amber-700 border-amber-200";
      case DisputeStatus.INFO_REQUESTED:
        return "bg-blue-50 text-blue-700 border-blue-200";
      case DisputeStatus.IN_MEDIATION:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case DisputeStatus.APPEALED:
        return "bg-amber-50 text-amber-800 border-amber-200";
      case DisputeStatus.REJECTED:
        return "bg-red-50 text-red-700 border-red-200";
      case DisputeStatus.RESOLVED:
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    [],
  );

  const allowedActions = dispute?.allowedActions ?? [];
  const appealTrack = dispute?.appealTrack;
  const appealDeadlineSource =
    appealTrack?.deadline ?? verdict?.appealDeadline ?? null;
  const appealDeadlinePassed = useMemo(() => {
    if (!appealDeadlineSource) return false;
    return Date.now() > new Date(appealDeadlineSource).getTime();
  }, [appealDeadlineSource]);

  const canSubmitVerdictAppeal = useMemo(() => {
    if (typeof verdict?.acceptance?.currentUserCanAppeal === "boolean") {
      return verdict.acceptance.currentUserCanAppeal;
    }
    if (allowedActions.includes("SUBMIT_APPEAL")) {
      return true;
    }
    if (!dispute || !verdict) return false;
    if (canViewInternal) return false;
    if (appealTrack?.kind && appealTrack.kind !== "NONE") {
      return appealTrack.kind === "VERDICT" && Boolean(appealTrack.canSubmit);
    }
    if (dispute.canAppealVerdict === true) {
      return true;
    }
    if (
      currentUser?.id !== dispute.raisedById &&
      currentUser?.id !== dispute.defendantId
    ) {
      return false;
    }
    if (dispute.status !== DisputeStatus.RESOLVED) return false;
    if (dispute.isAppealed || verdict.isAppealVerdict) return false;
    if (!verdict.appealDeadline || appealDeadlinePassed) return false;
    return true;
  }, [
    allowedActions,
    appealDeadlinePassed,
    appealTrack?.canSubmit,
    appealTrack?.kind,
    canViewInternal,
    currentUser?.id,
    dispute,
    verdict,
  ]);

  const canSubmitRejectionAppeal = useMemo(() => {
    if (allowedActions.includes("SUBMIT_REJECTION_APPEAL")) {
      return true;
    }
    return Boolean(appealTrack?.kind === "REJECTION" && appealTrack.canSubmit);
  }, [allowedActions, appealTrack]);

  const canSubmitAppeal = canSubmitVerdictAppeal || canSubmitRejectionAppeal;
  const appealDialogMode = canSubmitRejectionAppeal ? "rejection" : "verdict";

  const canResolveAppeal = useMemo(() => {
    return Boolean(
      isAdmin && dispute?.status === DisputeStatus.APPEALED && verdict?.id,
    );
  }, [dispute?.status, isAdmin, verdict?.id]);

  const canSubmitImpactReview = useMemo(() => {
    if (allowedActions.includes("SUBMIT_IMPACT_REVIEW")) {
      return true;
    }
    if (!dispute || canViewInternal || !currentUser?.id) {
      return false;
    }

    if ([dispute.raisedById, dispute.defendantId].includes(currentUser.id)) {
      return false;
    }

    return [
      dispute.project?.clientId,
      dispute.project?.brokerId,
      dispute.project?.freelancerId,
    ].includes(currentUser.id);
  }, [allowedActions, canViewInternal, currentUser?.id, dispute]);
  const canRequestSupportEscalation = allowedActions.includes(
    "REQUEST_SUPPORT_ESCALATION",
  );
  const canRequestAdminOversight = allowedActions.includes(
    "REQUEST_ADMIN_OVERSIGHT",
  );
  const canRequestNeutralPanel = allowedActions.includes(
    "REQUEST_NEUTRAL_PANEL",
  );
  const isNeutralPanelReviewer = Boolean(
    dispute?.participants?.some(
      (participant) =>
        participant.userId === currentUser?.id &&
        participant.caseRole === "NEUTRAL_PANEL",
    ),
  );

  const handleAppealSubmit = useCallback(
    async (input: {
      reason: string;
      disclaimerAccepted: boolean;
      disclaimerVersion?: string;
    }) => {
      if (!disputeId) return;
      try {
        setAppealLoading(true);
        if (appealDialogMode === "rejection") {
          await submitDisputeRejectionAppeal(disputeId, {
            reason: input.reason,
          });
        } else {
          await submitDisputeAppeal(disputeId, input);
        }
        invalidateDisputesCache();
        invalidateDisputeDetailCache(disputeId);
        toast.success(
          appealDialogMode === "rejection"
            ? "Rejection appeal submitted successfully"
            : "Appeal submitted successfully",
        );
        setAppealDialogOpen(false);
        handleRealtimeRefresh();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            (appealDialogMode === "rejection"
              ? "Failed to submit rejection appeal"
              : "Failed to submit appeal"),
        );
      } finally {
        setAppealLoading(false);
      }
    },
    [appealDialogMode, disputeId, handleRealtimeRefresh],
  );

  const handleAcceptVerdictSubmit = useCallback(
    async (input: {
      disclaimerAccepted: boolean;
      waiveAppealRights: boolean;
      disclaimerVersion?: string;
    }) => {
      if (!disputeId) return;
      try {
        setAcceptVerdictLoading(true);
        await acceptDisputeVerdict(disputeId, input);
        invalidateDisputesCache();
        invalidateDisputeDetailCache(disputeId);
        toast.success("Verdict accepted");
        setAcceptVerdictDialogOpen(false);
        handleRealtimeRefresh();
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Failed to accept verdict",
        );
      } finally {
        setAcceptVerdictLoading(false);
      }
    },
    [disputeId, handleRealtimeRefresh],
  );

  const handleReviewRequestSubmit = useCallback(async () => {
    if (!disputeId || !requestDialogMode) {
      return;
    }
    const reason = reviewReason.trim();
    if (reason.length < 20) {
      toast.error("Please provide at least 20 characters of context.");
      return;
    }

    try {
      setReviewSubmitting(true);
      if (requestDialogMode === "impact-review") {
        await submitDisputeReviewRequest(disputeId, {
          reason,
          impactSummary: reviewImpactSummary.trim() || undefined,
        });
      } else {
        await submitDisputeEscalationRequest(disputeId, {
          kind:
            requestDialogMode === "support-escalation"
              ? "SUPPORT_ESCALATION"
              : requestDialogMode === "admin-oversight"
                ? "ADMIN_OVERSIGHT"
                : "NEUTRAL_PANEL",
          reason,
          impactSummary: reviewImpactSummary.trim() || undefined,
        });
      }
      invalidateDisputeDetailCache(disputeId);
      invalidateDisputesCache();
      toast.success(
        requestDialogMode === "impact-review"
          ? "Impact review submitted."
          : requestDialogMode === "support-escalation"
            ? "Support escalation submitted."
            : requestDialogMode === "admin-oversight"
              ? "Admin oversight request submitted."
              : "Neutral panel request submitted.",
      );
      setReviewDialogOpen(false);
      setRequestDialogMode(null);
      setReviewReason("");
      setReviewImpactSummary("");
      handleRealtimeRefresh();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to submit dispute request",
      );
    } finally {
      setReviewSubmitting(false);
    }
  }, [
    disputeId,
    handleRealtimeRefresh,
    requestDialogMode,
    reviewImpactSummary,
    reviewReason,
  ]);

  const handleNeutralPanelRecommendationSubmit = useCallback(async () => {
    if (!disputeId) {
      return;
    }

    const rationale = panelRationale.trim();
    if (rationale.length < 50) {
      toast.error("Panel rationale must be at least 50 characters.");
      return;
    }

    try {
      setPanelSubmitting(true);
      await submitNeutralPanelRecommendation(disputeId, {
        recommendation: panelRecommendation,
        rationale,
        summary: panelSummary.trim() || undefined,
      });
      invalidateDisputeDetailCache(disputeId);
      invalidateDisputesCache();
      toast.success("Neutral panel recommendation submitted.");
      setPanelSummary("");
      setPanelRationale("");
      handleRealtimeRefresh();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit neutral panel recommendation",
      );
    } finally {
      setPanelSubmitting(false);
    }
  }, [
    disputeId,
    handleRealtimeRefresh,
    panelRationale,
    panelRecommendation,
    panelSummary,
  ]);

  const handleAppealResolved = useCallback(async () => {
    if (!disputeId) return;
    invalidateDisputesCache();
    invalidateDisputeDetailCache(disputeId);
    setAppealWizardOpen(false);
    handleRealtimeRefresh();
  }, [disputeId, handleRealtimeRefresh]);

  const handleDossierExport = useCallback(async () => {
    if (!disputeId) return;
    try {
      setDossierExporting(true);
      const exported = await exportDisputeDossier(disputeId);
      triggerBlobDownload(exported.blob, exported.fileName);
      toast.success("Dossier export started");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to export dossier");
    } finally {
      setDossierExporting(false);
    }
  }, [disputeId]);
  const evidenceReadOnly = !allowedActions.includes("UPLOAD_EVIDENCE");
  const hearingPanelReadOnly = !allowedActions.includes("MANAGE_HEARING");
  const participantArchiveReadOnly = Boolean(
    dispute?.isReadOnly && !canViewInternal,
  );

  const tabs = [
    {
      name: "Timeline",
      icon: History,
      component: (
        <TimelineRoute activities={activities} loading={activityLoading} />
      ),
    },
    {
      name: "Hearings",
      icon: Calendar,
      component: disputeId ? (
        <DisputeHearingPanel
          disputeId={disputeId}
          refreshToken={refreshToken}
          readOnly={hearingPanelReadOnly}
        />
      ) : null,
    },
    {
      name: "Evidence Vault",
      icon: FileText,
      component: disputeId ? (
        <EvidenceVault
          disputeId={disputeId}
          refreshToken={refreshToken}
          readOnly={evidenceReadOnly}
        />
      ) : null,
    },
    ...(canViewInternal
      ? [
          {
            name: "Internal Case Notes",
            icon: MessageSquare,
            component: disputeId ? (
              <InternalCaseNotesPanel disputeId={disputeId} />
            ) : null,
          },
        ]
      : []),
  ];
  const activeTabIndex = selectedIndex < tabs.length ? selectedIndex : 0;

  const raiserLabel =
    dispute?.raiser?.fullName ||
    dispute?.raiser?.email ||
    dispute?.raisedById ||
    "Unknown";
  const defendantLabel =
    dispute?.defendant?.fullName ||
    dispute?.defendant?.email ||
    dispute?.defendantId ||
    "Unknown";
  const participantRoster = useMemo(() => {
    if (dispute?.participants?.length) {
      return dispute.participants;
    }

    return [
      {
        userId: dispute?.raisedById || "",
        displayName: raiserLabel,
        email: dispute?.raiser?.email || null,
        caseRole: "CLAIMANT",
        source: "DISPUTE_PARTY",
      },
      {
        userId: dispute?.defendantId || "",
        displayName: defendantLabel,
        email: dispute?.defendant?.email || null,
        caseRole: "RESPONDENT",
        source: "DISPUTE_PARTY",
      },
    ].filter((participant) => participant.userId);
  }, [
    defendantLabel,
    dispute?.defendant?.email,
    dispute?.defendantId,
    dispute?.participants,
    dispute?.raisedById,
    dispute?.raiser?.email,
    raiserLabel,
  ]);
  const escrowAmount = dispute?.disputedAmount
    ? currencyFormatter.format(dispute.disputedAmount)
    : "N/A";
  const appealDeadlineText = formatAppealDeadlineText(appealDeadlineSource);
  const isClosedCase = Boolean(dispute?.isReadOnly);
  const complexityLevel = useMemo(() => {
    if (!complexity) return null;
    const legacyComplexity = complexity as DisputeComplexity & {
      severity?: string;
    };
    const rawLevel = legacyComplexity.level ?? legacyComplexity.severity;
    if (
      rawLevel === "LOW" ||
      rawLevel === "MEDIUM" ||
      rawLevel === "HIGH" ||
      rawLevel === "CRITICAL"
    ) {
      return rawLevel;
    }
    return null;
  }, [complexity]);
  const complexityRecommendedMinutes = useMemo(() => {
    if (!complexity) return null;
    const recommendedMinutes = complexity.timeEstimation?.recommendedMinutes;
    if (typeof recommendedMinutes === "number") {
      return recommendedMinutes;
    }

    const legacyEvidenceLoad = (
      complexity as DisputeComplexity & {
        evidenceLoad?: number;
      }
    ).evidenceLoad;
    if (typeof legacyEvidenceLoad === "number") {
      return Math.max(30, legacyEvidenceLoad * 30);
    }

    return null;
  }, [complexity]);
  const hasRenderableVerdict = Boolean(
    verdict &&
    typeof verdict === "object" &&
    verdict.id &&
    verdict.issuedAt &&
    verdict.result,
  );
  const appealStateLabel = useMemo(() => {
    if (appealTrack?.state && appealTrack.state !== "NONE") {
      const kindLabel =
        appealTrack.kind === "REJECTION" ? "rejection appeal" : "appeal";
      if (appealTrack.state === "AVAILABLE") {
        return `${kindLabel} available`;
      }
      if (appealTrack.state === "FILED") {
        return `${kindLabel} filed`;
      }
      if (appealTrack.state === "RESOLVED") {
        return `${kindLabel} resolved`;
      }
      if (appealTrack.state === "EXPIRED") {
        return `${kindLabel} expired`;
      }
    }
    if (dispute?.appealState) {
      return dispute.appealState.replaceAll("_", " ");
    }
    if (
      dispute?.appealResolvedAt ||
      dispute?.appealResolution ||
      verdict?.isAppealVerdict
    ) {
      return "Appeal resolved";
    }
    if (
      dispute?.isAppealed ||
      dispute?.status === DisputeStatus.APPEALED ||
      dispute?.status === DisputeStatus.REJECTION_APPEALED
    ) {
      return "Appealed";
    }
    if (canSubmitAppeal) {
      return "Appeal available";
    }
    if (isClosedCase && verdict?.appealDeadline && appealDeadlinePassed) {
      return "Appeal expired";
    }
    return "No appeal filed";
  }, [
    appealDeadlinePassed,
    canSubmitAppeal,
    dispute?.appealResolution,
    dispute?.appealResolvedAt,
    dispute?.appealState,
    dispute?.isAppealed,
    dispute?.status,
    isClosedCase,
    appealTrack,
    verdict?.appealDeadline,
    verdict?.isAppealVerdict,
  ]);
  const requestDialogCopy = useMemo(() => {
    switch (requestDialogMode) {
      case "support-escalation":
        return {
          title: "Request Staff Support",
          description:
            "Request another staff member or an internal support flow for a difficult dispute case.",
          reasonLabel: "Why support is needed",
          impactLabel: "Scope / evidence context",
          submitLabel: "Submit Support Request",
        };
      case "admin-oversight":
        return {
          title: "Request Admin Oversight",
          description:
            "Escalate this dispute for direct admin oversight when the case is unusually risky or complex.",
          reasonLabel: "Why admin oversight is needed",
          impactLabel: "Risk / impact summary",
          submitLabel: "Submit Oversight Request",
        };
      case "neutral-panel":
        return {
          title: "Request Neutral Panel",
          description:
            "Ask for a neutral advisory panel to review the dispute dossier and provide a recommendation.",
          reasonLabel: "Why a neutral panel is justified",
          impactLabel: "Panel context / disputed impact",
          submitLabel: "Submit Panel Request",
        };
      default:
        return {
          title: "Submit Impact Review",
          description:
            "Explain how this dispute outcome affects you and why it should receive additional review.",
          reasonLabel: "Impact review reason",
          impactLabel: "Business / trust impact summary",
          submitLabel: "Submit Impact Review",
        };
    }
  }, [requestDialogMode]);

  if (!disputeId) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-gray-200 bg-white">
        <div className="p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-900">
            Select a dispute to review
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Open a case to view verdicts, evidence, hearings, and appeal state.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {dispute?.displayTitle || dispute?.id || "Dispute"}
                </h2>
                {dispute?.displayCode ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {dispute.displayCode}
                  </span>
                ) : null}
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-bold ${headerStatusStyle(
                    dispute?.status,
                  )}`}
                >
                  {dispute?.status?.replaceAll("_", " ") ?? "UNKNOWN"}
                </span>
                {dispute?.caseStage ? (
                  <span className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
                    {caseStageLabelMap[dispute.caseStage] ||
                      dispute.caseStage.replaceAll("_", " ")}
                  </span>
                ) : null}
                {canViewInternal &&
                complexityLevel &&
                complexityRecommendedMinutes !== null ? (
                  <DisputeComplexityBadge
                    level={complexityLevel}
                    estMinutes={complexityRecommendedMinutes}
                    confidence={complexity?.confidence ?? 0}
                  />
                ) : null}
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                Created:{" "}
                {dispute?.createdAt
                  ? format(new Date(dispute.createdAt), "MMM d, yyyy")
                  : "Unknown"}
                {dispute?.project?.title ? (
                  <span className="flex items-center gap-2">
                    <span className="text-gray-300">|</span>
                    Project: <strong>{dispute.project.title}</strong>
                  </span>
                ) : null}
                {dispute?.nextActionLabel ? (
                  <span className="flex items-center gap-2">
                    <span className="text-gray-300">|</span>
                    Next: <strong>{dispute.nextActionLabel}</strong>
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canSubmitAppeal ? (
              <button
                type="button"
                data-testid="open-appeal-dialog"
                onClick={() => setAppealDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                <Scale className="h-4 w-4" />
                {canSubmitRejectionAppeal
                  ? "Appeal Rejection"
                  : "Formal Verdict Appeal"}
              </button>
            ) : null}
            {canResolveAppeal ? (
              <button
                type="button"
                onClick={() => setAppealWizardOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <ShieldAlert className="h-4 w-4" />
                {appealWizardOpen ? "Hide Appeal Review" : "Resolve Appeal"}
              </button>
            ) : null}
            {canSubmitImpactReview ? (
              <button
                type="button"
                data-testid="open-impact-review-dialog"
                onClick={() => {
                  setRequestDialogMode("impact-review");
                  setReviewDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
              >
                <ShieldAlert className="h-4 w-4" />
                Impact Review
              </button>
            ) : null}
            {canRequestSupportEscalation ? (
              <button
                type="button"
                data-testid="open-support-escalation-dialog"
                onClick={() => {
                  setRequestDialogMode("support-escalation");
                  setReviewDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                <ShieldAlert className="h-4 w-4" />
                Request Staff Support
              </button>
            ) : null}
            {canRequestAdminOversight ? (
              <button
                type="button"
                data-testid="open-admin-oversight-dialog"
                onClick={() => {
                  setRequestDialogMode("admin-oversight");
                  setReviewDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-medium text-fuchsia-800 hover:bg-fuchsia-100"
              >
                <ShieldAlert className="h-4 w-4" />
                Request Admin Oversight
              </button>
            ) : null}
            {canRequestNeutralPanel ? (
              <button
                type="button"
                data-testid="open-neutral-panel-dialog"
                onClick={() => {
                  setRequestDialogMode("neutral-panel");
                  setReviewDialogOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100"
              >
                <ShieldAlert className="h-4 w-4" />
                Request Neutral Panel
              </button>
            ) : null}
            <button
              type="button"
              data-testid="export-dispute-dossier"
              onClick={() => void handleDossierExport()}
              disabled={dossierExporting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText className="h-4 w-4" />
              {dossierExporting ? "Exporting..." : "Export Dossier"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col bg-gray-50">
          <div className="flex-1 overflow-y-auto p-6">
            {migrationBanner ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {migrationBanner}
              </div>
            ) : null}

            {dispute?.flowGuide ? (
              <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                {dispute.flowGuide}
              </div>
            ) : null}

            {appealTrack?.kind && appealTrack.kind !== "NONE" ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950">
                      {appealTrack.kind === "REJECTION"
                        ? "Rejection Appeal Track"
                        : "Appeal Track"}
                    </h3>
                    <p className="mt-1 text-xs text-amber-900/80">
                      State: <strong>{appealStateLabel}</strong>
                      {appealTrack.requiresHearing
                        ? " • Tier 2 hearing required"
                        : " • Desk review"}
                    </p>
                  </div>
                  {appealTrack.isSlaBreached ? (
                    <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      SLA risk
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Deadline
                    </div>
                    <div className="mt-1 text-sm text-slate-800">
                      {appealTrack.deadline
                        ? format(
                            new Date(appealTrack.deadline),
                            "MMM d, yyyy h:mm a",
                          )
                        : "Not set"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Assigned Admin
                    </div>
                    <div className="mt-1 text-sm text-slate-800">
                      {appealTrack.assignedAdmin?.fullName ||
                        appealTrack.assignedAdmin?.email ||
                        appealTrack.assignedAdminId ||
                        "Pending assignment"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Resolution
                    </div>
                    <div className="mt-1 text-sm text-slate-800">
                      {appealTrack.resolution || "Awaiting review"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {isNeutralPanelReviewer ? (
              <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                <h3 className="text-sm font-semibold text-violet-950">
                  Neutral Panel Recommendation
                </h3>
                <p className="mt-1 text-xs text-violet-900/80">
                  Submit an advisory recommendation for admin review. Your
                  recommendation does not directly finalize the case.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["UPHOLD", "OVERTURN", "NEEDS_HEARING"] as const).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPanelRecommendation(option)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          panelRecommendation === option
                            ? "border-violet-700 bg-violet-700 text-white"
                            : "border-violet-200 bg-white text-violet-800"
                        }`}
                      >
                        {option.replaceAll("_", " ")}
                      </button>
                    ),
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Textarea
                    value={panelSummary}
                    onChange={(event) => setPanelSummary(event.target.value)}
                    placeholder="Optional neutral summary for admin context."
                    rows={4}
                    className="resize-none bg-white text-sm"
                  />
                  <Textarea
                    value={panelRationale}
                    onChange={(event) => setPanelRationale(event.target.value)}
                    placeholder="Required rationale. Explain the evidence basis for your recommendation."
                    rows={4}
                    className="resize-none bg-white text-sm"
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      void handleNeutralPanelRecommendationSubmit()
                    }
                    disabled={
                      panelSubmitting || panelRationale.trim().length < 50
                    }
                    className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-60"
                  >
                    {panelSubmitting
                      ? "Submitting..."
                      : "Submit Recommendation"}
                  </button>
                </div>
              </div>
            ) : null}

            {isClosedCase ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                This case is closed. Verdicts, hearings, contracts, and timeline
                are now read-only reference material.
                {canSubmitAppeal
                  ? " Appeal remains available until the deadline."
                  : ""}
              </div>
            ) : null}

            {dispute?.hearingDocket?.length ? (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Case docket
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Hearings are preserved as a chronological docket. Only one
                      hearing remains actionable at a time.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {dispute.hearingDocket.map((entry) => (
                    <div
                      key={entry.hearingId}
                      className={`rounded-xl border p-4 ${
                        entry.isActionable
                          ? "border-teal-200 bg-teal-50/70"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            Hearing #{entry.hearingNumber}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {entry.status.replaceAll("_", " ")}
                          </span>
                          {entry.tier ? (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {entry.tier.replaceAll("_", " ")}
                            </span>
                          ) : null}
                          {entry.isActionable ? (
                            <span className="rounded-full border border-teal-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                              Actionable
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-slate-500">
                          {entry.scheduledAt
                            ? format(
                                new Date(entry.scheduledAt),
                                "MMM d, yyyy h:mm a",
                              )
                            : "Unscheduled"}
                        </span>
                      </div>
                      {entry.agenda ? (
                        <p className="mt-2 text-sm text-slate-700">
                          {entry.agenda}
                        </p>
                      ) : null}
                      {entry.freezeReason ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {entry.freezeReason}
                        </p>
                      ) : null}
                      {entry.summary || entry.findings ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {entry.summary ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Minutes
                              </div>
                              <p className="mt-1 text-sm text-slate-700">
                                {entry.summary}
                              </p>
                            </div>
                          ) : null}
                          {entry.findings ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                Findings
                              </div>
                              <p className="mt-1 text-sm text-slate-700">
                                {entry.findings}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {hasRenderableVerdict && verdict ? (
              <div className="mb-6">
                <VerdictAnnouncement
                  verdict={verdict}
                  canAppealOverride={canSubmitAppeal}
                  appealDeadlinePassed={appealDeadlinePassed}
                  onAppeal={
                    canSubmitAppeal
                      ? () => setAppealDialogOpen(true)
                      : undefined
                  }
                  appealLoading={appealLoading}
                  onAccept={
                    verdict.acceptance?.currentUserCanAccept
                      ? () => setAcceptVerdictDialogOpen(true)
                      : undefined
                  }
                  acceptLoading={acceptVerdictLoading}
                />
              </div>
            ) : null}

            {dossier?.contracts?.length ? (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Contract dossier
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Use the full contract page when available; PDF remains
                      available as a fallback.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {dossier.contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {contract.title || contract.id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {(contract.status || "UNKNOWN").replaceAll("_", " ")}
                      </p>
                      {contract.termsPreview ? (
                        <p className="mt-2 line-clamp-3 text-xs text-slate-600">
                          {contract.termsPreview}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {contractBasePath ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `${contractBasePath}/contracts/${contract.id}`,
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Open contract page
                          </button>
                        ) : null}
                        {contract.contractUrl ? (
                          <a
                            href={contract.contractUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open PDF
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {appealWizardOpen &&
            canResolveAppeal &&
            disputeId &&
            verdict?.id ? (
              <div className="mb-6 rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                <VerdictWizard
                  disputeId={disputeId}
                  disputedAmount={dispute?.disputedAmount}
                  disputeCategory={dispute?.category}
                  mode="appeal"
                  existingVerdictId={verdict.id}
                  appealContext={dispute?.appealReason ?? ""}
                  onSubmitted={handleAppealResolved}
                />
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div
                className="flex space-x-1 border-b border-gray-200 bg-white px-6"
                role="tablist"
              >
                {tabs.map((tab, idx) => {
                  const isSelected = idx === activeTabIndex;
                  return (
                    <button
                      key={tab.name}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedIndex(idx)}
                      className={`group flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium outline-none transition-colors ${
                        isSelected
                          ? "border-teal-500 text-teal-600"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>

              <div className="p-6" role="tabpanel">
                {loading ? (
                  <div className="text-sm text-gray-500">
                    Loading dispute...
                  </div>
                ) : (
                  tabs.map((tab, idx) =>
                    idx === activeTabIndex ? (
                      <div key={tab.name}>{tab.component}</div>
                    ) : null,
                  )
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden w-80 overflow-y-auto border-l border-gray-200 bg-white p-6 xl:block">
          <h4 className="mb-4 text-sm font-semibold text-gray-900">
            Involved Parties
          </h4>
          <div className="space-y-4">
            {participantRoster.map((participant, index) => {
              const initials = (participant.caseRole || "P").slice(0, 1);
              const accentClass =
                participant.caseRole === "CLAIMANT"
                  ? "bg-blue-100 text-blue-700"
                  : participant.caseRole === "RESPONDENT"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-slate-100 text-slate-700";

              return (
                <div
                  key={`${participant.userId}:${participant.caseRole}:${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${accentClass}`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {profileBasePath && participant.userId ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `${profileBasePath}/discovery/profile/${participant.userId}`,
                              )
                            }
                            className="hover:underline"
                          >
                            {participant.displayName ||
                              participant.username ||
                              participant.userId}
                          </button>
                        ) : (
                          participant.displayName ||
                          participant.username ||
                          participant.userId
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {participant.caseRole.replaceAll("_", " ")}
                      </p>
                      {participant.username ? (
                        <p className="truncate text-[11px] text-slate-500">
                          {participant.username}
                        </p>
                      ) : null}
                      {participant.email ? (
                        <p className="truncate text-[11px] text-slate-400">
                          {participant.email}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-6 h-px bg-gray-100" />

          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            Escrow Details
          </h4>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-gray-500">Total Funded</p>
            <p className="text-xl font-bold text-slate-900">{escrowAmount}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600">
              <ShieldAlert className="h-3 w-3" /> Frozen due to dispute
            </p>
          </div>

          <div className="my-6 h-px bg-gray-100" />

          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            Deadlines
          </h4>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Response by{" "}
              {dispute?.responseDeadline
                ? format(new Date(dispute.responseDeadline), "MMM d, yyyy")
                : "N/A"}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              Resolution by{" "}
              {dispute?.resolutionDeadline
                ? format(new Date(dispute.resolutionDeadline), "MMM d, yyyy")
                : "N/A"}
            </div>
            {appealDeadlineSource ? (
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-gray-400" />
                Appeal window {appealDeadlineText ?? "Available"}
              </div>
            ) : null}
          </div>

          <div className="my-6 h-px bg-gray-100" />

          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            Contracts
          </h4>
          <div className="space-y-3 text-sm text-gray-600">
            {dossier?.contracts?.length ? (
              dossier.contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <p className="font-medium text-slate-900">
                    {contract.title || contract.id}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(contract.status || "UNKNOWN").replaceAll("_", " ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {contractBasePath ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `${contractBasePath}/contracts/${contract.id}`,
                          )
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Open page
                      </button>
                    ) : null}
                    {contract.contractUrl ? (
                      <a
                        href={contract.contractUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Open PDF
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                No contract records linked.
              </p>
            )}
          </div>

          <div className="my-6 h-px bg-gray-100" />

          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            Appeal State
          </h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-400">
                Status
              </span>
              <p className="font-medium text-slate-900">{appealStateLabel}</p>
            </div>
            {appealTrack?.kind && appealTrack.kind !== "NONE" ? (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  Track
                </span>
                <p className="font-medium text-slate-900">
                  {appealTrack.kind === "REJECTION"
                    ? "Rejection appeal"
                    : "Verdict appeal"}
                </p>
              </div>
            ) : null}
            {appealTrack?.filedAt ||
            dispute?.appealedAt ||
            dispute?.rejectionAppealedAt ? (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  Appealed At
                </span>
                <p>
                  {format(
                    new Date(
                      appealTrack?.filedAt ||
                        dispute?.appealedAt ||
                        dispute?.rejectionAppealedAt ||
                        "",
                    ),
                    "MMM d, yyyy h:mm a",
                  )}
                </p>
              </div>
            ) : null}
            {dispute?.appealReason || dispute?.rejectionAppealReason ? (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  Appeal Reason
                </span>
                <p className="whitespace-pre-wrap text-slate-700">
                  {dispute.appealReason || dispute.rejectionAppealReason}
                </p>
              </div>
            ) : null}
            {appealTrack?.assignedAdmin?.fullName ||
            appealTrack?.assignedAdmin?.email ||
            appealTrack?.assignedAdminId ? (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  Assigned Admin
                </span>
                <p className="text-slate-700">
                  {appealTrack?.assignedAdmin?.fullName ||
                    appealTrack?.assignedAdmin?.email ||
                    appealTrack?.assignedAdminId}
                </p>
              </div>
            ) : null}
            {appealTrack?.resolution ||
            dispute?.appealResolution ||
            dispute?.rejectionAppealResolution ? (
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  Resolution
                </span>
                <p className="whitespace-pre-wrap text-slate-700">
                  {appealTrack?.resolution ||
                    dispute?.appealResolution ||
                    dispute?.rejectionAppealResolution}
                </p>
                {appealTrack?.resolvedAt ||
                dispute?.appealResolvedAt ||
                dispute?.rejectionAppealResolvedAt ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {format(
                      new Date(
                        appealTrack?.resolvedAt ||
                          dispute?.appealResolvedAt ||
                          dispute?.rejectionAppealResolvedAt ||
                          "",
                      ),
                      "MMM d, yyyy h:mm a",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) {
            setReviewReason("");
            setReviewImpactSummary("");
            setRequestDialogMode(null);
          }
        }}
      >
        <DialogContent
          className="sm:max-w-lg"
          data-testid="review-request-dialog"
        >
          <DialogHeader>
            <DialogTitle>{requestDialogCopy.title}</DialogTitle>
            <DialogDescription>
              {requestDialogCopy.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {requestDialogCopy.reasonLabel}
              </label>
              <Textarea
                data-testid="review-request-reason"
                value={reviewReason}
                onChange={(event) => setReviewReason(event.target.value)}
                rows={5}
                placeholder="Explain the issue, the fairness concern, and the specific review or support you need."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {requestDialogCopy.impactLabel}
              </label>
              <Textarea
                data-testid="review-request-impact"
                value={reviewImpactSummary}
                onChange={(event) => setReviewImpactSummary(event.target.value)}
                rows={3}
                placeholder="Optional summary of practical impact, key evidence, or why this case needs escalation."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="cancel-review-request"
                onClick={() => setReviewDialogOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="submit-review-request"
                onClick={() => void handleReviewRequestSubmit()}
                disabled={reviewSubmitting || reviewReason.trim().length < 20}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
              >
                {reviewSubmitting
                  ? "Submitting..."
                  : requestDialogCopy.submitLabel}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AppealDialog
        open={appealDialogOpen}
        onOpenChange={setAppealDialogOpen}
        mode={appealDialogMode}
        onSubmit={handleAppealSubmit}
        deadlineText={appealDeadlineText}
      />
      <AcceptVerdictDialog
        open={acceptVerdictDialogOpen}
        onOpenChange={setAcceptVerdictDialogOpen}
        onSubmit={handleAcceptVerdictSubmit}
      />
    </div>
  );
};
