import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  Ban,
  CheckCircle,
  Filter,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DisputeComplexityBadge } from "./DisputeComplexityBadge";
import {
  DisputeCategory,
  DisputePriority,
  DisputeStatus,
} from "../../../staff/types/staff.types";
import {
  escalateDispute,
  getDisputeComplexity,
  getDisputes,
  rejectDispute,
  requestDisputeInfo,
} from "../../api";
import type {
  DisputeComplexity,
  DisputeSummary,
  PaginatedDisputesResponse,
} from "../../types/dispute.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useStaffDashboardRealtime } from "@/features/staff/hooks/useStaffDashboardRealtime";

export const StaffDisputeBoard = () => {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<DisputeSummary[]>([]);
  const [meta, setMeta] = useState<PaginatedDisputesResponse["meta"] | null>(
    null,
  );
  const [stats, setStats] =
    useState<PaginatedDisputesResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "ALL">(
    DisputeStatus.PENDING_REVIEW,
  );
  const [priorityFilter, setPriorityFilter] = useState<
    DisputePriority | "ALL"
  >("ALL");
  const [page, setPage] = useState(1);
  const [complexityById, setComplexityById] = useState<
    Record<string, DisputeComplexity>
  >({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"reject" | "request-info" | null>(
    null,
  );
  const [dialogReason, setDialogReason] = useState("");
  const [dialogTarget, setDialogTarget] = useState<DisputeSummary | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(
    null,
  );

  const queryFilters = useMemo(
    () => ({
      page,
      limit: 20,
      sortBy: "urgency",
      sortOrder: "DESC" as const,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      search: debouncedSearch ? debouncedSearch : undefined,
    }),
    [page, statusFilter, priorityFilter, debouncedSearch],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, debouncedSearch]);

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDisputes(queryFilters);
      setDisputes(data.data ?? []);
      setMeta(data.meta);
      setStats(data.stats ?? null);
    } catch (error) {
      console.error("Failed to load disputes:", error);
      toast.error("Could not load dispute queue");
    } finally {
      setLoading(false);
    }
  }, [queryFilters]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleRealtimeRefresh = useCallback(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  useStaffDashboardRealtime({
    onDisputeCreated: handleRealtimeRefresh,
    onHearingEnded: handleRealtimeRefresh,
    onVerdictIssued: handleRealtimeRefresh,
  });

  useEffect(() => {
    if (!disputes.length) return;
    const missing = disputes
      .map((dispute) => dispute.id)
      .filter((id) => !complexityById[id]);
    if (!missing.length) return;

    let cancelled = false;
    Promise.allSettled(missing.map((id) => getDisputeComplexity(id))).then(
      (results) => {
        if (cancelled) return;
        setComplexityById((prev) => {
          const next = { ...prev };
          results.forEach((result, index) => {
            if (result.status === "fulfilled") {
              next[missing[index]] = result.value.data;
            }
          });
          return next;
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [disputes, complexityById]);

  const openDialog = (type: "reject" | "request-info", target: DisputeSummary) => {
    setDialogType(type);
    setDialogTarget(target);
    setDialogReason("");
    setDialogOpen(true);
  };

  const handleDialogSubmit = async () => {
    if (!dialogTarget || !dialogType) return;
    if (!dialogReason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }

    try {
      setDialogLoading(true);
      if (dialogType === "reject") {
        await rejectDispute(dialogTarget.id, dialogReason.trim());
        toast.success("Dispute rejected.");
      } else {
        await requestDisputeInfo(dialogTarget.id, dialogReason.trim());
        toast.success("Info request sent.");
      }
      setDialogOpen(false);
      await fetchDisputes();
    } catch (error) {
      console.error("Failed to process action:", error);
      toast.error("Action failed. Please try again.");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleEscalate = async (dispute: DisputeSummary) => {
    try {
      setRowActionLoadingId(dispute.id);
      await escalateDispute(dispute.id);
      toast.success("Dispute accepted for mediation.");
      await fetchDisputes();
    } catch (error) {
      console.error("Failed to escalate dispute:", error);
      toast.error("Could not accept dispute.");
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const statusPill = (status: DisputeStatus) => {
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

  const categoryPill = (category: DisputeCategory) => {
    if (category === DisputeCategory.FRAUD) {
      return "bg-red-50 text-red-700 border-red-100";
    }
    if (category === DisputeCategory.PAYMENT) {
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const emptyState = !loading && disputes.length === 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900">
            Dispute Queue (Triage)
          </h3>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            {meta?.total ?? disputes.length}
          </span>
          {stats?.urgent ? (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {stats.urgent} urgent
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search IDs or users..."
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 w-64"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
          <button className="p-1.5 text-gray-500 hover:bg-gray-50 border border-gray-300 rounded-lg">
            <Filter className="w-4 h-4" />
          </button>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as DisputeStatus | "ALL")
            }
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-600"
          >
            <option value="ALL">All statuses</option>
            {Object.values(DisputeStatus).map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value as DisputePriority | "ALL")
            }
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-600"
          >
            <option value="ALL">All priorities</option>
            {Object.values(DisputePriority).map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Dispute ID / Project</th>
              <th className="px-4 py-3">Raiser</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Complexity (Est.)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {disputes.map((dispute) => {
              const complexity = complexityById[dispute.id];
              const projectTitle =
                dispute.project?.title || dispute.projectId || "Unknown project";
              const raiserLabel =
                dispute.raiser?.fullName ||
                dispute.raiser?.email ||
                dispute.raisedById;
              const amountLabel = dispute.disputedAmount
                ? currencyFormatter.format(dispute.disputedAmount)
                : "N/A";

              return (
              <tr
                key={dispute.id}
                className="hover:bg-gray-50 group transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{dispute.id}</div>
                  <div className="text-xs text-gray-500 truncate max-w-[200px]">
                    {projectTitle}
                  </div>
                  <span
                    className={`inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium border ${statusPill(
                      dispute.status,
                    )}`}
                  >
                    {dispute.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {raiserLabel}
                  <div className="text-xs text-slate-400">
                    {amountLabel} in Escrow
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border
                                        ${categoryPill(dispute.category)}
                                    `}
                  >
                    {dispute.category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {complexity ? (
                    <DisputeComplexityBadge
                      level={complexity.level}
                      estMinutes={complexity.timeEstimation.recommendedMinutes}
                      confidence={complexity.confidence}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Estimating...</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-md"
                      title="Quick Look"
                      onClick={() =>
                        navigate(`/staff/caseload?disputeId=${dispute.id}`, {
                          state: { dispute },
                        })
                      }
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                      title="Reject as Invalid"
                      onClick={() => openDialog("reject", dispute)}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
                      title="Accept to Caseload"
                      onClick={() => handleEscalate(dispute)}
                      disabled={rowActionLoadingId === dispute.id}
                    >
                      {rowActionLoadingId === dispute.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="px-2 py-1 text-xs text-slate-600 border border-gray-200 rounded-md hover:bg-gray-50"
                      onClick={() => openDialog("request-info", dispute)}
                    >
                      Request Info
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
            {emptyState && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  No disputes found for the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
        <div>
          Page {meta?.page ?? page} of {meta?.totalPages ?? 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-50"
            disabled={!meta?.hasPrevPage}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <button
            className="px-3 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-50"
            disabled={!meta?.hasNextPage}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "reject"
                ? "Reject dispute"
                : "Request additional info"}
            </DialogTitle>
            <DialogDescription>
              Provide a clear reason so all parties understand the decision.
            </DialogDescription>
          </DialogHeader>
          <div>
            <textarea
              rows={4}
              value={dialogReason}
              onChange={(event) => setDialogReason(event.target.value)}
              placeholder="Write a concise reason..."
              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setDialogOpen(false)}
              disabled={dialogLoading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={handleDialogSubmit}
              disabled={dialogLoading}
            >
              {dialogLoading ? "Submitting..." : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
