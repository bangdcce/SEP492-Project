import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  MessageSquare,
  History,
  Scale,
  ShieldAlert,
  ChevronLeft,
  Clock,
  User,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { DisputeComplexityBadge } from "./DisputeComplexityBadge";
import { EvidenceVault } from "../evidence/EvidenceVault";
import { DiscussionPanel } from "./DiscussionPanel";
import { VerdictWizard } from "../wizard/VerdictWizard";
import { DisputeHearingPanel } from "../hearings/DisputeHearingPanel";
import { useDisputeRealtime } from "@/features/disputes/hooks/useDisputeRealtime";
import { STORAGE_KEYS } from "@/constants";
import {
  getDisputeActivities,
  getDisputeComplexity,
  getDisputeDetail,
} from "../../api";
import type {
  DisputeActivity,
  DisputeComplexity,
  DisputeSummary,
} from "../../types/dispute.types";
import { DisputeStatus, UserRole } from "../../../staff/types/staff.types";

interface DisputeDetailHubProps {
  disputeId?: string;
  initialDispute?: DisputeSummary;
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
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {activity.action}
                </p>
                <p className="text-xs text-gray-500 mt-1">{actorLabel}</p>
                {activity.description && (
                  <p className="text-sm text-gray-700 mt-2">
                    {activity.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {timestamp}
                </div>
                {activity.isInternal && (
                  <span className="mt-2 inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">
                    Internal
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const DisputeDetailHub = ({
  disputeId,
  initialDispute,
}: DisputeDetailHubProps) => {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dispute, setDispute] = useState<DisputeSummary | null>(
    initialDispute ?? null,
  );
  const [activities, setActivities] = useState<DisputeActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [complexity, setComplexity] = useState<DisputeComplexity | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const currentUser = useMemo(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { role?: UserRole };
    } catch {
      return null;
    }
  }, []);

  const canViewInternal = useMemo(() => {
    return currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.STAFF;
  }, [currentUser]);

  const fetchDetail = useCallback(async () => {
    if (!disputeId) return;
    try {
      setLoading(true);
      const detail = await getDisputeDetail(disputeId);
      setDispute((prev) => ({ ...(prev ?? ({} as DisputeSummary)), ...detail }));
    } catch (error) {
      console.error("Failed to load dispute detail:", error);
      toast.error("Could not load dispute details");
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  const fetchActivities = useCallback(async () => {
    if (!disputeId) return;
    try {
      setActivityLoading(true);
      const data = await getDisputeActivities(disputeId, canViewInternal);
      setActivities(data ?? []);
    } catch (error) {
      console.error("Failed to load dispute activities:", error);
    } finally {
      setActivityLoading(false);
    }
  }, [disputeId, canViewInternal]);

  const fetchComplexity = useCallback(async () => {
    if (!disputeId) return;
    try {
      const data = await getDisputeComplexity(disputeId);
      setComplexity(data.data);
    } catch (error) {
      console.error("Failed to load dispute complexity:", error);
    }
  }, [disputeId]);

  useEffect(() => {
    if (initialDispute?.id && initialDispute.id === disputeId) {
      setDispute(initialDispute);
    }
  }, [initialDispute, disputeId]);

  useEffect(() => {
    if (!disputeId) {
      setDispute(initialDispute ?? null);
      return;
    }

    fetchDetail();
    fetchActivities();
    fetchComplexity();
  }, [disputeId, initialDispute, fetchDetail, fetchActivities, fetchComplexity]);

  const handleRealtimeRefresh = useCallback(() => {
    fetchDetail();
    fetchActivities();
    fetchComplexity();
    setRefreshToken((prev) => prev + 1);
  }, [fetchDetail, fetchActivities, fetchComplexity]);

  useDisputeRealtime(disputeId, {
    onEvidenceUploaded: handleRealtimeRefresh,
    onMessageSent: handleRealtimeRefresh,
    onVerdictIssued: handleRealtimeRefresh,
    onHearingEnded: handleRealtimeRefresh,
  });

  const headerStatusStyle = (status?: DisputeStatus) => {
    switch (status) {
      case DisputeStatus.PENDING_REVIEW:
        return "bg-amber-50 text-amber-700 border-amber-200";
      case DisputeStatus.INFO_REQUESTED:
        return "bg-blue-50 text-blue-700 border-blue-200";
      case DisputeStatus.IN_MEDIATION:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
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

  if (!disputeId) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-xl border border-gray-200">
        <div className="text-center p-8">
          <ShieldAlert className="w-10 h-10 text-teal-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900">
            Select a dispute to review
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            Open a case from the queue to view timeline, evidence, and actions.
          </p>
          <button
            onClick={() => navigate("/staff/queue")}
            className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800"
          >
            Back to queue
          </button>
        </div>
      </div>
    );
  }

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
        />
      ) : null,
    },
    {
      name: "Evidence Vault",
      icon: FileText,
      component: disputeId ? (
        <EvidenceVault disputeId={disputeId} refreshToken={refreshToken} />
      ) : null,
    },
    {
      name: "Discussion",
      icon: MessageSquare,
      component: disputeId ? <DiscussionPanel disputeId={disputeId} /> : null,
    },
    {
      name: "Resolution",
      icon: Scale,
      component: disputeId ? (
        <VerdictWizard
          disputeId={disputeId}
          disputedAmount={dispute?.disputedAmount}
        />
      ) : null,
    },
  ];

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
  const escrowAmount = dispute?.disputedAmount
    ? currencyFormatter.format(dispute.disputedAmount)
    : "N/A";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white">
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">
                {dispute?.id || "Dispute"}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${headerStatusStyle(
                  dispute?.status,
                )}`}
              >
                {dispute?.status?.replace("_", " ") ?? "UNKNOWN"}
              </span>
              {complexity && (
                <DisputeComplexityBadge
                  level={complexity.level}
                  estMinutes={complexity.timeEstimation.recommendedMinutes}
                  confidence={complexity.confidence}
                />
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4" />
              Created:{" "}
              {dispute?.createdAt
                ? format(new Date(dispute.createdAt), "MMM d, yyyy")
                : "Unknown"}
              {dispute?.project?.title && (
                <span className="flex items-center gap-2">
                  <span className="text-gray-300">|</span>
                  Project: <strong>{dispute.project.title}</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 shadow-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Case Actions
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
          <div
            className="flex space-x-1 border-b border-gray-200 bg-white px-6"
            role="tablist"
          >
            {tabs.map((tab, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={tab.name}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedIndex(idx)}
                  className={`group flex items-center gap-2 whitespace-nowrap py-4 px-4 text-sm font-medium border-b-2 outline-none transition-colors ${
                    isSelected
                      ? "border-teal-500 text-teal-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-6" role="tabpanel">
            {loading ? (
              <div className="text-sm text-gray-500">Loading dispute...</div>
            ) : (
              tabs.map((tab, idx) =>
                idx === selectedIndex ? (
                  <div key={tab.name}>{tab.component}</div>
                ) : null,
              )
            )}
          </div>
        </main>

        <aside className="w-80 bg-white border-l border-gray-200 p-6 hidden xl:block overflow-y-auto">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Involved Parties
          </h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                R
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {raiserLabel}
                </p>
                <p className="text-xs text-gray-500">Raiser</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
                D
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {defendantLabel}
                </p>
                <p className="text-xs text-gray-500">Defendant</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-6" />

          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Escrow Details
          </h4>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-xs text-gray-500">Total Funded</p>
            <p className="text-xl font-bold text-slate-900">{escrowAmount}</p>
            <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Frozen due to dispute
            </p>
          </div>

          <div className="h-px bg-gray-100 my-6" />

          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Deadlines
          </h4>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Response by{" "}
              {dispute?.responseDeadline
                ? format(new Date(dispute.responseDeadline), "MMM d, yyyy")
                : "N/A"}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              Resolution by{" "}
              {dispute?.resolutionDeadline
                ? format(new Date(dispute.resolutionDeadline), "MMM d, yyyy")
                : "N/A"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
