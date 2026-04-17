import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  Scale,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import {
  assignAppealOwner,
  getAppealOwners,
  getCaseloadDisputes,
} from "../api";
import { useStaffDashboardRealtime } from "@/features/staff/hooks/useStaffDashboardRealtime";
import type {
  AppealOwnerSummary,
  DisputeSummary,
} from "../types/dispute.types";
import { DisputeStatus } from "@/features/staff/types/staff.types";

type AppealScope = "all" | "mine" | "unassigned";

const getAssignedAdminId = (dispute: DisputeSummary) =>
  dispute.appealTrack?.assignedAdminId ?? dispute.escalatedToAdminId ?? "";

const getAppealKindLabel = (dispute: DisputeSummary) => {
  if (dispute.appealTrack?.kind === "REJECTION") {
    return "Dismissal appeal";
  }
  return "Verdict appeal";
};

const getAppealFiledAt = (dispute: DisputeSummary) =>
  dispute.appealTrack?.filedAt ??
  dispute.appealedAt ??
  dispute.rejectionAppealedAt ??
  null;

const getAppealDeadline = (dispute: DisputeSummary) =>
  dispute.appealTrack?.deadline ?? dispute.appealDeadline ?? null;

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
};

export function AdminAppealQueuePage() {
  const navigate = useNavigate();
  const currentUser = useMemo(
    () => getStoredJson<{ id?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const currentUserId = currentUser?.id ?? "";

  const [appeals, setAppeals] = useState<DisputeSummary[]>([]);
  const [owners, setOwners] = useState<AppealOwnerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<AppealScope>("all");
  const [assigningDisputeId, setAssigningDisputeId] = useState<string | null>(
    null,
  );
  const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({});
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  const loadAppealQueue = useCallback(async () => {
    try {
      setLoading(true);
      const [response, ownerList] = await Promise.all([
        getCaseloadDisputes(
          {
            page: 1,
            limit: 80,
            sortBy: "updatedAt",
            sortOrder: "DESC",
            statusIn: [
              DisputeStatus.APPEALED,
              DisputeStatus.REJECTION_APPEALED,
            ],
          },
          { preferCache: false },
        ),
        getAppealOwners(),
      ]);

      const nextAppeals = response.data ?? [];
      setAppeals(nextAppeals);
      setOwners(ownerList ?? []);
      setOwnerDrafts(
        Object.fromEntries(
          nextAppeals.map((dispute) => [
            dispute.id,
            getAssignedAdminId(dispute),
          ]),
        ),
      );
    } catch (error) {
      console.error("Failed to load appeal queue:", error);
      toast.error("Could not load appeal queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppealQueue();
  }, [loadAppealQueue]);

  const scheduleQueueRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
      realtimeRefreshTimerRef.current = null;
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadAppealQueue();
    }, 500);
  }, [loadAppealQueue]);

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
    };
  }, []);

  useStaffDashboardRealtime({
    onAppealSubmitted: scheduleQueueRefresh,
    onAppealResolved: scheduleQueueRefresh,
    onDisputeStatusChanged: scheduleQueueRefresh,
    onDisputeAssigned: scheduleQueueRefresh,
    onDisputeReassigned: scheduleQueueRefresh,
  });

  const counts = useMemo(() => {
    const mine = currentUserId
      ? appeals.filter(
          (dispute) => getAssignedAdminId(dispute) === currentUserId,
        ).length
      : 0;
    const unassigned = appeals.filter(
      (dispute) => !getAssignedAdminId(dispute),
    ).length;
    return {
      all: appeals.length,
      mine,
      unassigned,
    };
  }, [appeals, currentUserId]);

  const filteredAppeals = useMemo(() => {
    if (scope === "mine") {
      return currentUserId
        ? appeals.filter(
            (dispute) => getAssignedAdminId(dispute) === currentUserId,
          )
        : [];
    }
    if (scope === "unassigned") {
      return appeals.filter((dispute) => !getAssignedAdminId(dispute));
    }
    return appeals;
  }, [appeals, currentUserId, scope]);

  const handleAssignOwner = useCallback(
    async (dispute: DisputeSummary) => {
      const adminId = ownerDrafts[dispute.id];
      if (!adminId) {
        toast.error("Select an owner before assigning");
        return;
      }

      if (adminId === getAssignedAdminId(dispute)) {
        return;
      }

      try {
        setAssigningDisputeId(dispute.id);
        await assignAppealOwner(dispute.id, { adminId });
        toast.success("Appeal owner updated");
        await loadAppealQueue();
      } catch (error) {
        console.error("Failed to assign appeal owner:", error);
        toast.error("Could not assign appeal owner");
      } finally {
        setAssigningDisputeId(null);
      }
    },
    [loadAppealQueue, ownerDrafts],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Appeal Queue
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Route open appeals to an admin owner, then continue the review from
            the dispute record. This keeps ownership explicit before the appeal
            is upheld or overturned through desk review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={ROUTES.ADMIN_DISPUTES}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open dispute board
          </Link>
          <button
            type="button"
            onClick={() => void loadAppealQueue()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Scale className="h-4 w-4 text-teal-600" />
            Open appeals
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {counts.all}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            All disputes currently waiting for appeal review.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <UserRoundCheck className="h-4 w-4 text-emerald-600" />
            Assigned to me
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {counts.mine}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Appeals already assigned to your admin seat.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Users className="h-4 w-4 text-amber-600" />
            Unassigned
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {counts.unassigned}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Appeals that still need an accountable owner.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${counts.all})`],
            ["mine", `Mine (${counts.mine})`],
            ["unassigned", `Unassigned (${counts.unassigned})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              scope === value
                ? "border-teal-300 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading appeal queue...
          </div>
        ) : filteredAppeals.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            No appeals found for this filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAppeals.map((dispute) => {
              const assignedAdminId = getAssignedAdminId(dispute);
              const assignedAdmin =
                dispute.appealTrack?.assignedAdmin ??
                owners.find((owner) => owner.id === assignedAdminId) ??
                null;
              const ownerDraft = ownerDrafts[dispute.id] ?? assignedAdminId;
              const isAssigning = assigningDisputeId === dispute.id;

              return (
                <div
                  key={dispute.id}
                  className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {dispute.displayCode ||
                            `DSP-${dispute.id.slice(0, 8).toUpperCase()}`}
                        </div>
                        <h2 className="mt-1 text-lg font-semibold text-slate-900">
                          {dispute.displayTitle ||
                            dispute.project?.title ||
                            dispute.id}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {dispute.project?.title || dispute.projectId}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          {dispute.status.replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                          {getAppealKindLabel(dispute)}
                        </span>
                        {dispute.appealTrack?.state ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {dispute.appealTrack.state.replaceAll("_", " ")}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Filed
                        </div>
                        <div className="mt-1 font-medium text-slate-800">
                          {formatDateTime(getAppealFiledAt(dispute))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Deadline
                        </div>
                        <div className="mt-1 font-medium text-slate-800">
                          {formatDateTime(getAppealDeadline(dispute))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Latest hearing
                        </div>
                        <div className="mt-1 font-medium text-slate-800">
                          {dispute.latestHearing?.hearingNumber
                            ? `Hearing #${dispute.latestHearing.hearingNumber}`
                            : "No hearing docket"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Next step
                        </div>
                        <div className="mt-1 font-medium text-slate-800">
                          {dispute.nextActionLabel || "Open dispute record"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
                      {dispute.flowGuide ||
                        dispute.reasonExcerpt ||
                        dispute.reason}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Appeal owner
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                      {assignedAdmin?.fullName ||
                        assignedAdmin?.email ||
                        "Unassigned"}
                    </div>
                    {assignedAdminId ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Current owner workload:{" "}
                        {owners.find((owner) => owner.id === assignedAdminId)
                          ?.pendingAppeals ?? 0}{" "}
                        appeals
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-amber-700">
                        Assign an owner before moving the review forward.
                      </p>
                    )}

                    <div className="mt-4 space-y-3">
                      <select
                        value={ownerDraft}
                        onChange={(event) =>
                          setOwnerDrafts((prev) => ({
                            ...prev,
                            [dispute.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
                      >
                        <option value="">Select appeal owner</option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {(owner.fullName || owner.email || owner.id) +
                              ` (${owner.pendingAppeals})`}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleAssignOwner(dispute)}
                        disabled={
                          !ownerDraft ||
                          ownerDraft === assignedAdminId ||
                          isAssigning
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isAssigning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserRoundCheck className="h-4 w-4" />
                        )}
                        Assign owner
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/admin/disputes/${dispute.id}`)
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Open dispute record
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAppealQueuePage;
