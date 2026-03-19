import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Ban,
  CheckCircle,
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DisputeComplexityBadge } from "./DisputeComplexityBadge";
import {
  DisputeCategory,
  DisputePriority,
  DisputeStatus,
  UserRole,
} from "../../../staff/types/staff.types";
import {
  acceptDispute,
  completeDisputePreview,
  escalateDispute,
  getDisputeComplexities,
  getQueueDisputes,
  getCaseloadDisputes,
  invalidateDisputesCache,
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
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { getApiErrorDetails } from "@/shared/utils/apiError";

interface StaffDisputeBoardProps {
  mode?: "queue" | "caseload";
}

export const StaffDisputeBoard = ({
  mode = "queue",
}: StaffDisputeBoardProps) => {
  const navigate = useNavigate();
  const currentUser = useMemo(() => {
    return getStoredJson<{ id?: string; role?: UserRole }>(STORAGE_KEYS.USER);
  }, []);
  const isStaffUser = currentUser?.role === UserRole.STAFF;
  const [disputes, setDisputes] = useState<DisputeSummary[]>([]);
  const [meta, setMeta] = useState<PaginatedDisputesResponse["meta"] | null>(
    null,
  );
  const [stats, setStats] = useState<PaginatedDisputesResponse["stats"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  type ViewFilter =
    | "ACTIVE"
    | "PENDING_REVIEW"
    | "APPEALS"
    | "RESOLVED"
    | "ALL";
  const [viewFilter, setViewFilter] = useState<ViewFilter>("ACTIVE");
  const [priorityFilter, setPriorityFilter] = useState<DisputePriority | "ALL">(
    "ALL",
  );
  const [categoryFilter, setCategoryFilter] = useState<DisputeCategory | "ALL">(
    "ALL",
  );
  const [weekFilter, setWeekFilter] = useState<
    "ANY" | "THIS_WEEK" | "NEXT_WEEK" | "OVERDUE"
  >("ANY");
  const [page, setPage] = useState(1);
  const [complexityById, setComplexityById] = useState<
    Record<string, DisputeComplexity>
  >({});
  const [complexityFailedIds, setComplexityFailedIds] = useState<Set<string>>(
    new Set(),
  );
  // Refs to read current state inside useEffect without adding to deps
  const complexityByIdRef = useRef(complexityById);
  complexityByIdRef.current = complexityById;
  const complexityFailedIdsRef = useRef(complexityFailedIds);
  complexityFailedIdsRef.current = complexityFailedIds;
  const fetchingComplexityIdsRef = useRef(new Set<string>());
  const [complexityFilter, setComplexityFilter] = useState<
    DisputeComplexity["level"] | "ALL"
  >("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<
    "reject" | "request-info" | null
  >(null);
  const [dialogReason, setDialogReason] = useState("");
  const [dialogTarget, setDialogTarget] = useState<DisputeSummary | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(
    null,
  );
  const [quickViewDispute, setQuickViewDispute] = useState<DisputeSummary | null>(
    null,
  );
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const statusIn = useMemo(() => {
    if (mode === "queue") {
      return [DisputeStatus.TRIAGE_PENDING, DisputeStatus.OPEN];
    }

    // Caseload mode - scoped to staff's assigned disputes.
    switch (viewFilter) {
      case "ACTIVE":
        return [
          DisputeStatus.PREVIEW,
          DisputeStatus.PENDING_REVIEW,
          DisputeStatus.IN_MEDIATION,
          DisputeStatus.INFO_REQUESTED,
        ];
      case "APPEALS":
        return [DisputeStatus.APPEALED, DisputeStatus.REJECTION_APPEALED];
      case "RESOLVED":
        return [DisputeStatus.RESOLVED, DisputeStatus.REJECTED];
      default:
        // Caseload "All" includes all statuses in assigned scope.
        return undefined;
    }
  }, [viewFilter, mode]);

  // Tab definitions differ per mode
  const statusTabs = useMemo(() => {
    if (mode === "queue") {
      return [
        {
          value: "ACTIVE" as ViewFilter,
          label: "Pending",
          statuses: [DisputeStatus.TRIAGE_PENDING, DisputeStatus.OPEN],
        },
      ];
    }
    return [
      {
        value: "ACTIVE" as ViewFilter,
        label: "In Progress",
        statuses: [
          DisputeStatus.PREVIEW,
          DisputeStatus.PENDING_REVIEW,
          DisputeStatus.IN_MEDIATION,
          DisputeStatus.INFO_REQUESTED,
        ],
      },
      {
        value: "APPEALS" as ViewFilter,
        label: "Appeals",
        statuses: [DisputeStatus.APPEALED, DisputeStatus.REJECTION_APPEALED],
      },
      {
        value: "RESOLVED" as ViewFilter,
        label: "Closed",
        statuses: [DisputeStatus.RESOLVED, DisputeStatus.REJECTED],
      },
      {
        value: "ALL" as ViewFilter,
        label: "All",
        statuses: [],
      },
    ];
  }, [mode]);

  /** Compute per-tab count from stats.byStatus */
  const getTabCount = useCallback(
    (tab: (typeof statusTabs)[number]) => {
      if (!stats?.byStatus) return null;
      if (tab.statuses.length === 0) {
        // "All" tab  Esum all statuses
        return Object.values(stats.byStatus).reduce(
          (sum, n) => sum + (n ?? 0),
          0,
        );
      }
      return tab.statuses.reduce((sum, s) => sum + (stats.byStatus[s] ?? 0), 0);
    },
    [stats?.byStatus],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (weekFilter !== "ANY") count++;
    if (categoryFilter !== "ALL") count++;
    if (priorityFilter !== "ALL") count++;
    if (complexityFilter !== "ALL") count++;
    return count;
  }, [weekFilter, categoryFilter, priorityFilter, complexityFilter]);

  const clearAdvancedFilters = useCallback(() => {
    setWeekFilter("ANY");
    setCategoryFilter("ALL");
    setPriorityFilter("ALL");
    setComplexityFilter("ALL");
  }, []);

  const deadlineRange = useMemo(() => {
    if (weekFilter === "OVERDUE") {
      return { overdueOnly: true };
    }

    if (weekFilter === "THIS_WEEK" || weekFilter === "NEXT_WEEK") {
      const today = new Date();
      const startOfWeek = new Date(today);
      const dayIndex = (startOfWeek.getDay() + 6) % 7;
      startOfWeek.setDate(startOfWeek.getDate() - dayIndex);
      startOfWeek.setHours(0, 0, 0, 0);

      if (weekFilter === "NEXT_WEEK") {
        startOfWeek.setDate(startOfWeek.getDate() + 7);
      }

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return {
        deadlineFrom: startOfWeek.toISOString(),
        deadlineTo: endOfWeek.toISOString(),
      };
    }

    return {};
  }, [weekFilter]);

  const queryFilters = useMemo(
    () => ({
      page,
      limit: 20,
      sortBy: mode === "queue" ? "createdAt" : "urgency",
      sortOrder: "DESC" as const,
      statusIn: mode === "caseload" ? statusIn : undefined,
      priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      category: categoryFilter === "ALL" ? undefined : categoryFilter,
      search: debouncedSearch ? debouncedSearch : undefined,
      // Queue: don't filter by assignedStaffId  Eshow all unassigned disputes
      // Caseload: filter by current staff's assigned disputes
      assignedStaffId:
        mode === "caseload" && isStaffUser ? currentUser?.id : undefined,
      ...deadlineRange,
    }),
    [
      page,
      statusIn,
      priorityFilter,
      categoryFilter,
      debouncedSearch,
      isStaffUser,
      currentUser?.id,
      deadlineRange,
      mode,
    ],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    setPage(1);
  }, [viewFilter, priorityFilter, categoryFilter, weekFilter, debouncedSearch]);

  const fetchDisputes = useCallback(
    async (options?: { preferCache?: boolean }) => {
      try {
        setLoading(true);
        const data =
          mode === "queue"
            ? await getQueueDisputes(queryFilters, {
                preferCache: options?.preferCache,
                ttlMs: 30_000,
              })
            : await getCaseloadDisputes(queryFilters, {
                preferCache: options?.preferCache,
                ttlMs: 30_000,
              });
        setDisputes(data.data ?? []);
        setMeta(data.meta);
        setStats(data.stats ?? null);
      } catch (error) {
        console.error("Failed to load disputes:", error);
        toast.error(
          mode === "queue"
            ? "Could not load dispute queue"
            : "Could not load assigned caseload",
        );
      } finally {
        setLoading(false);
      }
    },
    [mode, queryFilters],
  );

  useEffect(() => {
    fetchDisputes({ preferCache: mode !== "queue" });
  }, [fetchDisputes, mode]);

  const handleRealtimeRefresh = useCallback(() => {
    fetchDisputes({ preferCache: false });
  }, [fetchDisputes]);

  useStaffDashboardRealtime({
    onDisputeCreated: handleRealtimeRefresh,
    onHearingEnded: handleRealtimeRefresh,
    onVerdictIssued: handleRealtimeRefresh,
  });

  useEffect(() => {
    if (!disputes.length) return;

    // Read current state via refs to avoid dependency-triggered re-runs
    const currentComplexity = complexityByIdRef.current;
    const currentFailed = complexityFailedIdsRef.current;
    const fetching = fetchingComplexityIdsRef.current;

    const toFetch = disputes
      .map((d) => d.id)
      .filter(
        (id) =>
          !currentComplexity[id] && !currentFailed.has(id) && !fetching.has(id),
      );
    if (!toFetch.length) return;

    // Mark as in-flight immediately to prevent duplicate requests
    toFetch.forEach((id) => fetching.add(id));

    let cancelled = false;
    getDisputeComplexities(toFetch, { preferCache: true })
      .then(({ data: resultMap, failedIds }) => {
        if (cancelled) return;
        if (Object.keys(resultMap).length) {
          setComplexityById((prev) => ({ ...prev, ...resultMap }));
        }

        // Mark failed IDs (explicit errors + orphans not in resultMap)
        const allFailed = [...failedIds];
        toFetch.forEach((id) => {
          if (!resultMap[id] && !failedIds.includes(id)) {
            allFailed.push(id);
          }
        });
        if (allFailed.length) {
          setComplexityFailedIds((prev) => {
            const next = new Set(prev);
            allFailed.forEach((id) => next.add(id));
            return next;
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load dispute complexity batch:", error);
        setComplexityFailedIds((prev) => {
          const next = new Set(prev);
          toFetch.forEach((id) => next.add(id));
          return next;
        });
      })
      .finally(() => {
        toFetch.forEach((id) => fetching.delete(id));
      });

    return () => {
      cancelled = true;
      toFetch.forEach((id) => fetching.delete(id));
    };
  }, [disputes]);

  const openDialog = (
    type: "reject" | "request-info",
    target: DisputeSummary,
  ) => {
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
      invalidateDisputesCache();
      await fetchDisputes({ preferCache: false });
    } catch (error) {
      console.error("Failed to process action:", error);
      toast.error("Action failed. Please try again.");
    } finally {
      setDialogLoading(false);
    }
  };

  const isAssignedConflictError = (details: {
    code?: string;
    message: string;
  }) => {
    return (
      details.code === "DISPUTE_ASSIGNED_TO_OTHER_STAFF" ||
      /assigned to another staff member/i.test(details.message)
    );
  };

  const handleEscalate = async (dispute: DisputeSummary) => {
    try {
      setRowActionLoadingId(dispute.id);
      if (
        [DisputeStatus.PREVIEW, DisputeStatus.PENDING_REVIEW].includes(
          dispute.status,
        )
      ) {
        await completeDisputePreview(dispute.id);
        toast.success("Preview completed and mediation schedule triggered.");
      } else {
        await escalateDispute(dispute.id);
        toast.success("Dispute escalated to mediation.");
      }
      invalidateDisputesCache();
      await fetchDisputes({ preferCache: false });
    } catch (error) {
      console.error("Failed to escalate dispute:", error);
      const details = getApiErrorDetails(error, "Could not escalate dispute.");
      if (isAssignedConflictError(details)) {
        toast.error("Case is now assigned to another staff. Refreshing queue.");
        invalidateDisputesCache();
        await fetchDisputes({ preferCache: false });
        return;
      }
      toast.error(
        details.code ? `[${details.code}] ${details.message}` : details.message,
      );
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleAccept = async (dispute: DisputeSummary) => {
    try {
      setRowActionLoadingId(dispute.id);
      await acceptDispute(dispute.id);
      toast.success("Dispute accepted into caseload.");
      invalidateDisputesCache();
      await fetchDisputes({ preferCache: false });
    } catch (error) {
      console.error("Failed to accept dispute:", error);
      const details = getApiErrorDetails(error, "Could not accept dispute.");
      if (isAssignedConflictError(details)) {
        toast.error("Case is now assigned to another staff. Refreshing queue.");
        invalidateDisputesCache();
        await fetchDisputes({ preferCache: false });
        return;
      }
      toast.error(
        details.code ? `[${details.code}] ${details.message}` : details.message,
      );
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const openQuickView = useCallback((dispute: DisputeSummary) => {
    setQuickViewDispute(dispute);
    setQuickViewOpen(true);
  }, []);

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

  const visibleDisputes = useMemo(() => {
    if (complexityFilter === "ALL") return disputes;
    return disputes.filter(
      (dispute) => complexityById[dispute.id]?.level === complexityFilter,
    );
  }, [disputes, complexityById, complexityFilter]);

  const totalLabel =
    complexityFilter === "ALL"
      ? (meta?.total ?? disputes.length)
      : `${visibleDisputes.length}/${meta?.total ?? disputes.length}`;

  const emptyState = !loading && visibleDisputes.length === 0;

  const boardTitle =
    mode === "caseload" ? "My Caseload" : "Dispute Queue (Triage)";

  const canModerate = true; // actions available in both queue and caseload modes

  // ── Helpers for per-row badges ──
  const NEW_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  const nowMs = Date.now();

  const priorityDot = (priority: DisputePriority) => {
    switch (priority) {
      case DisputePriority.CRITICAL:
        return "bg-red-500";
      case DisputePriority.HIGH:
        return "bg-orange-400";
      case DisputePriority.MEDIUM:
        return "bg-yellow-400";
      case DisputePriority.LOW:
        return "bg-emerald-400";
      default:
        return "bg-gray-300";
    }
  };

  const formatDeadline = (dispute: DisputeSummary) => {
    const hours = dispute.hoursUntilDeadline;
    if (hours == null) return null;

    if (dispute.isOverdue) {
      return {
        label: "Overdue",
        cls: "bg-red-50 text-red-600 border-red-100",
        icon: AlertTriangle,
      };
    }
    if (hours <= 48) {
      const display =
        hours < 1
          ? "< 1h left"
          : hours < 24
            ? `${Math.round(hours)}h left`
            : `${Math.round(hours / 24)}d left`;
      return {
        label: display,
        cls: "bg-amber-50 text-amber-600 border-amber-100",
        icon: Clock,
      };
    }
    const days = Math.round(hours / 24);
    return {
      label: `${days}d left`,
      cls: "bg-gray-50 text-gray-500 border-gray-100",
      icon: Clock,
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-gray-200">
        {/* Row 1: Title + Stats + Search */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 whitespace-nowrap">
              {boardTitle}
            </h3>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              {totalLabel}
            </span>
            {(stats?.urgent ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-xs font-medium whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" />
                {stats!.urgent} urgent
              </span>
            )}
            {(stats?.overdue ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-xs font-medium whitespace-nowrap">
                <Clock className="w-3 h-3" />
                {stats!.overdue} overdue
              </span>
            )}
          </div>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search IDs or users..."
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 w-64"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
        </div>

        {/* Row 2: Status tabs + Filters toggle */}
        <div className="px-4 pb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {statusTabs.map((tab) => {
              const count = getTabCount(tab);
              return (
                <button
                  key={tab.value}
                  onClick={() => setViewFilter(tab.value)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-1.5",
                    viewFilter === tab.value
                      ? "bg-teal-50 text-teal-700 border border-teal-200"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent",
                  )}
                >
                  {tab.label}
                  {count != null && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold leading-none rounded-full px-1.5 py-0.5",
                        viewFilter === tab.value
                          ? "bg-teal-100 text-teal-700"
                          : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border shrink-0",
              showAdvancedFilters
                ? "bg-teal-50 text-teal-700 border-teal-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-gray-300",
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 3: Advanced filters (collapsible) */}
        {showAdvancedFilters && (
          <div className="px-4 pb-3 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3">
            <select
              value={weekFilter}
              onChange={(event) =>
                setWeekFilter(
                  event.target.value as
                    | "ANY"
                    | "THIS_WEEK"
                    | "NEXT_WEEK"
                    | "OVERDUE",
                )
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white"
            >
              <option value="ANY">Any deadline</option>
              <option value="THIS_WEEK">This week</option>
              <option value="NEXT_WEEK">Next week</option>
              <option value="OVERDUE">Overdue</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as DisputeCategory | "ALL")
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white"
            >
              <option value="ALL">All categories</option>
              {Object.values(DisputeCategory).map((category) => (
                <option key={category} value={category}>
                  {category.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as DisputePriority | "ALL")
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white"
            >
              <option value="ALL">All priorities</option>
              {Object.values(DisputePriority).map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <select
              value={complexityFilter}
              onChange={(event) =>
                setComplexityFilter(
                  event.target.value as DisputeComplexity["level"] | "ALL",
                )
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white"
            >
              <option value="ALL">All complexity</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAdvancedFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        )}
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
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Complexity (Est.)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleDisputes.map((dispute) => {
              const complexity = complexityById[dispute.id];
              const projectTitle =
                dispute.project?.title ||
                dispute.projectId ||
                "Unknown project";
              const raiserLabel =
                dispute.raiser?.fullName ||
                dispute.raiser?.email ||
                dispute.raisedById;
              const amountLabel = dispute.disputedAmount
                ? currencyFormatter.format(dispute.disputedAmount)
                : "N/A";
              const canReview = [
                DisputeStatus.TRIAGE_PENDING,
                DisputeStatus.OPEN,
                DisputeStatus.PREVIEW,
                DisputeStatus.PENDING_REVIEW,
                DisputeStatus.INFO_REQUESTED,
              ].includes(dispute.status);
              const isAssignedToAnotherStaff =
                isStaffUser &&
                Boolean(dispute.assignedStaffId) &&
                dispute.assignedStaffId !== currentUser?.id;
              const assignmentLockedTitle = isAssignedToAnotherStaff
                ? "Assigned to another staff member"
                : undefined;

              const isNew =
                dispute.createdAt &&
                nowMs - new Date(dispute.createdAt).getTime() <
                  NEW_THRESHOLD_MS;
              const deadline = formatDeadline(dispute);

              return (
                <tr
                  key={dispute.id}
                  className="hover:bg-gray-50 group transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* Priority dot */}
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          priorityDot(dispute.priority),
                        )}
                        title={`Priority: ${dispute.priority}`}
                      />
                      <span className="font-medium text-slate-900">
                        {dispute.id}
                      </span>
                      {isNew && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-100 rounded-full text-[10px] font-semibold leading-none">
                          <Sparkles className="w-2.5 h-2.5" />
                          New
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px] ml-3.5">
                      {projectTitle}
                    </div>
                     <span
                       className={`inline-flex mt-1 ml-3.5 px-2 py-0.5 rounded text-xs font-medium border ${statusPill(
                         dispute.status,
                       )}`}
                     >
                       {dispute.status.replace("_", " ")}
                     </span>
                     {dispute.isAppealed ? (
                       <div className="ml-3.5 mt-1 text-[11px] text-amber-700">
                         Appeal filed
                         {dispute.appealedAt
                           ? ` ${new Date(dispute.appealedAt).toLocaleDateString()}`
                           : ""}
                         {dispute.appealResolvedAt
                           ? ` • resolved ${new Date(dispute.appealResolvedAt).toLocaleDateString()}`
                           : ""}
                       </div>
                     ) : null}
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
                    {deadline ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
                          deadline.cls,
                        )}
                      >
                        <deadline.icon className="w-3 h-3" />
                        {deadline.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {complexity?.level &&
                    complexity?.timeEstimation?.recommendedMinutes != null ? (
                      <DisputeComplexityBadge
                        level={complexity.level}
                        estMinutes={
                          complexity.timeEstimation.recommendedMinutes
                        }
                        confidence={complexity.confidence}
                      />
                    ) : complexityFailedIds.has(dispute.id) ? (
                      <span className="text-xs text-red-400">Unavailable</span>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Estimating...
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-md"
                        title="Quick Look"
                        onClick={() => {
                          if (mode === "queue") {
                            openQuickView(dispute);
                            return;
                          }
                          navigate(`/staff/caseload?disputeId=${dispute.id}`, {
                            state: { dispute },
                          });
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canModerate && canReview ? (
                        <>
                          {/* Queue mode: Accept / Reject for OPEN disputes */}
                          {mode === "queue" &&
                            [
                              DisputeStatus.OPEN,
                              DisputeStatus.TRIAGE_PENDING,
                            ].includes(dispute.status) && (
                              <>
                                <button
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Reject as Invalid"
                                  onClick={() => openDialog("reject", dispute)}
                                  disabled={isAssignedToAnotherStaff}
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                                <button
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={assignmentLockedTitle || "Accept to Caseload"}
                                  onClick={() => handleAccept(dispute)}
                                  disabled={
                                    rowActionLoadingId === dispute.id ||
                                    isAssignedToAnotherStaff
                                  }
                                >
                                  {rowActionLoadingId === dispute.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            )}

                          {/* Caseload mode: Escalate / Request Info for PENDING_REVIEW disputes */}
                          {mode === "caseload" &&
                            [
                              DisputeStatus.PENDING_REVIEW,
                              DisputeStatus.PREVIEW,
                            ].includes(dispute.status) && (
                              <>
                                <button
                                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={assignmentLockedTitle || "Escalate to Mediation"}
                                  onClick={() => handleEscalate(dispute)}
                                  disabled={
                                    rowActionLoadingId === dispute.id ||
                                    isAssignedToAnotherStaff
                                  }
                                >
                                  {rowActionLoadingId === dispute.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  className="px-2 py-1 text-xs text-slate-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() =>
                                    openDialog("request-info", dispute)
                                  }
                                  disabled={isAssignedToAnotherStaff}
                                  title={assignmentLockedTitle}
                                >
                                  Request Info
                                </button>
                              </>
                            )}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {emptyState && (
              <tr>
                <td
                  colSpan={6}
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

      <Dialog
        open={quickViewOpen}
        onOpenChange={(open) => {
          setQuickViewOpen(open);
          if (!open) {
            setQuickViewDispute(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {quickViewDispute
                ? `Triage Summary #${quickViewDispute.id.slice(0, 8)}`
                : "Triage Summary"}
            </DialogTitle>
            <DialogDescription>
              Queue review is limited to spam/noise screening and initial risk scoring.
            </DialogDescription>
          </DialogHeader>
          {quickViewDispute && (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Project</p>
                  <p className="font-medium text-slate-900">
                    {quickViewDispute.project?.title ||
                      quickViewDispute.projectId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Category</p>
                  <p className="font-medium text-slate-900">
                    {quickViewDispute.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Priority</p>
                  <p className="font-medium text-slate-900">
                    {quickViewDispute.priority}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="font-medium text-slate-900">
                    {quickViewDispute.status.replaceAll("_", " ")}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Raiser</p>
                <p className="font-medium text-slate-900">
                  {quickViewDispute.raiser?.fullName ||
                    quickViewDispute.raiser?.email ||
                    quickViewDispute.raisedById}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Defendant</p>
                <p className="font-medium text-slate-900">
                  {quickViewDispute.defendant?.fullName ||
                    quickViewDispute.defendant?.email ||
                    quickViewDispute.defendantId}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reason Summary</p>
                <p className="text-slate-800 whitespace-pre-wrap break-words">
                  {quickViewDispute.reason || "No reason provided."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setQuickViewOpen(false)}
            >
              Close
            </button>
            {quickViewDispute && mode === "queue" && (
              <>
                <button
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setQuickViewOpen(false);
                    openDialog("reject", quickViewDispute);
                  }}
                >
                  Reject
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                  onClick={async () => {
                    await handleAccept(quickViewDispute);
                    setQuickViewOpen(false);
                  }}
                  disabled={rowActionLoadingId === quickViewDispute.id}
                >
                  {rowActionLoadingId === quickViewDispute.id
                    ? "Accepting..."
                    : "Accept to Caseload"}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
