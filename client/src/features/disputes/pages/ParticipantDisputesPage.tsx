import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, FolderOpen, Gavel, Scale } from "lucide-react";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { resolveRoleBasePath } from "@/features/hearings/utils/hearingRouting";
import { DisputeStatus } from "@/features/staff/types/staff.types";
import { getMyDisputes } from "../api";
import type { DisputeSummary } from "../types/dispute.types";

const statusPill = (status?: string) => {
  switch (status) {
    case "APPEALED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "RESOLVED":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "IN_MEDIATION":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
};

const resolveAppealStateLabel = (dispute: DisputeSummary) => {
  if (dispute.appealState) {
    return dispute.appealState.replaceAll("_", " ");
  }
  if (dispute.appealResolvedAt || dispute.appealResolution) {
    return "Appeal resolved";
  }
  if (
    dispute.isAppealed ||
    [DisputeStatus.APPEALED, DisputeStatus.REJECTION_APPEALED].includes(dispute.status)
  ) {
    return "Appealed";
  }
  if (dispute.status === DisputeStatus.RESOLVED && dispute.appealDeadline) {
    return new Date(dispute.appealDeadline).getTime() > Date.now()
      ? "Appeal available"
      : "Appeal expired";
  }
  return "No appeal filed";
};

const stageLabelMap: Record<string, string> = {
  FILED: "Filed",
  TRIAGE: "Triage",
  PRE_HEARING_SUBMISSIONS: "Pre-hearing",
  HEARING_IN_PROGRESS: "Hearing active",
  DELIBERATION: "Deliberation",
  VERDICT_ISSUED: "Verdict issued",
  APPEAL_WINDOW: "Appeal window",
  APPEAL_HEARING: "Appeal hearing",
  FINAL_ARCHIVE: "Final archive",
};

export const ParticipantDisputesPage = () => {
  const navigate = useNavigate();
  const currentUser = useMemo(
    () => getStoredJson<{ role?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const roleBasePath = useMemo(
    () => resolveRoleBasePath(currentUser?.role),
    [currentUser?.role],
  );
  const [disputes, setDisputes] = useState<DisputeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<"active" | "appeals" | "closed">("active");

  const loadDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getMyDisputes(
        {
          page: 1,
          limit: 50,
          sortBy: "updatedAt",
          sortOrder: "DESC",
          asInvolved: true,
        },
        { preferCache: false },
      );
      setDisputes(response.data ?? []);
    } catch (error) {
      console.error("Failed to load participant disputes:", error);
      toast.error("Could not load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  const groupedDisputes = useMemo(() => {
    const active = disputes.filter(
      (dispute) =>
        ![
          DisputeStatus.APPEALED,
          DisputeStatus.REJECTION_APPEALED,
          DisputeStatus.RESOLVED,
          DisputeStatus.REJECTED,
          DisputeStatus.CANCELED,
        ].includes(dispute.status),
    );
    const appeals = disputes.filter((dispute) =>
      [DisputeStatus.APPEALED, DisputeStatus.REJECTION_APPEALED].includes(dispute.status),
    );
    const closed = disputes.filter((dispute) =>
      [DisputeStatus.RESOLVED, DisputeStatus.REJECTED, DisputeStatus.CANCELED].includes(
        dispute.status,
      ),
    );

    return { active, appeals, closed };
  }, [disputes]);

  const visibleDisputes = groupedDisputes[group];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Disputes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review dispute status, verdicts, hearings, and appeal activity.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`${roleBasePath}/hearings`)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open Hearings Calendar
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-slate-50 px-5 py-4">
          {([
            ["active", "Active"],
            ["appeals", "Appeals"],
            ["closed", "Closed"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setGroup(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                group === key
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label} ({groupedDisputes[key].length})
            </button>
          ))}
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading disputes...</div>
        ) : visibleDisputes.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No disputes in this group.
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {visibleDisputes.map((dispute) => (
              <button
                key={dispute.id}
                type="button"
                onClick={() => navigate(`${roleBasePath}/disputes/${dispute.id}`)}
                className="group flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {dispute.displayCode || `DSP-${dispute.id.slice(0, 8).toUpperCase()}`}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="truncate text-lg font-semibold text-slate-900">
                          {dispute.displayTitle || dispute.project?.title || dispute.id}
                        </span>
                        {dispute.latestHearing?.hearingNumber ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            H{dispute.latestHearing.hearingNumber}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusPill(
                        dispute.status,
                      )}`}
                    >
                      {dispute.status.replaceAll("_", " ")}
                    </span>
                    {dispute.caseStage ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        {stageLabelMap[dispute.caseStage] || dispute.caseStage.replaceAll("_", " ")}
                      </span>
                    ) : null}
                    {dispute.isAppealed ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Scale className="h-3 w-3" />
                        Appeal active
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <FolderOpen className="h-3.5 w-3.5" />
                        Project
                      </div>
                      <div className="mt-1 font-medium text-slate-800">
                        {dispute.project?.title || dispute.projectId}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Gavel className="h-3.5 w-3.5" />
                        Next step
                      </div>
                      <div className="mt-1 font-medium text-slate-800">
                        {dispute.nextActionLabel || "Open case record"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                    {dispute.reasonExcerpt || dispute.reason}
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        Updated
                      </div>
                      <div className="mt-1 font-medium text-slate-800">
                        {new Date(dispute.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        Appeal
                      </div>
                      <div className="mt-1 flex items-center gap-1 font-medium text-slate-800">
                        <Clock className="h-3.5 w-3.5" />
                        {resolveAppealStateLabel(dispute)}
                      </div>
                      {dispute.appealDeadline ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Window: {new Date(dispute.appealDeadline).toLocaleDateString()}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {dispute.flowGuide ? (
                    <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
                      {dispute.flowGuide}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-end text-sm text-gray-500">
                  <span className="text-xs font-medium text-teal-700">
                    Open case record
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
