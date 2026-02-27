import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Save,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  listLeavePolicies,
  listLeaveRequests,
  processLeaveRequest,
  updateLeavePolicy,
} from "@/features/leave/api";
import {
  LeaveStatus,
  type LeavePolicyItem,
  type LeaveRequest,
} from "@/features/leave/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

type TabKey = "approvals" | "policies";
type ProcessAction = "approve" | "reject";

const formatMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const statusLabel: Record<LeaveStatus, string> = {
  [LeaveStatus.PENDING]: "Pending",
  [LeaveStatus.APPROVED]: "Approved",
  [LeaveStatus.REJECTED]: "Rejected",
  [LeaveStatus.CANCELLED]: "Cancelled",
};

const statusClasses: Record<LeaveStatus, string> = {
  [LeaveStatus.PENDING]:
    "bg-amber-100 text-amber-700 border border-amber-200",
  [LeaveStatus.APPROVED]:
    "bg-emerald-100 text-emerald-700 border border-emerald-200",
  [LeaveStatus.REJECTED]: "bg-rose-100 text-rose-700 border border-rose-200",
  [LeaveStatus.CANCELLED]:
    "bg-slate-100 text-slate-700 border border-slate-200",
};

const getMonthLabel = (month: string) => {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return format(date, "MMMM yyyy");
};

const matchesSearch = (request: LeaveRequest, keyword: string) => {
  if (!keyword) return true;
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;

  const values = [
    request.staffId,
    request.staff?.fullName ?? "",
    request.staff?.email ?? "",
  ];

  return values.some((value) => value.toLowerCase().includes(normalized));
};

export default function AdminLeaveManagementPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("approvals");

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [statusFilter, setStatusFilter] = useState<LeaveStatus>(LeaveStatus.PENDING);
  const [approvalsSearch, setApprovalsSearch] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<ProcessAction>("approve");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [processNote, setProcessNote] = useState("");

  const [policySearch, setPolicySearch] = useState("");
  const [policyPage, setPolicyPage] = useState(1);
  const [policyLimit] = useState(10);
  const [policies, setPolicies] = useState<LeavePolicyItem[]>([]);
  const [policyMeta, setPolicyMeta] = useState({
    page: 1,
    limit: policyLimit,
    total: 0,
    totalPages: 0,
  });
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, string>>({});
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null);

  const loadApprovals = useCallback(
    async (options?: { preferCache?: boolean }) => {
      setLoadingRequests(true);
      try {
        const data = await listLeaveRequests(
          {
            month: selectedMonth,
            status: statusFilter,
          },
          options,
        );
        setRequests(data);
      } catch (error) {
        console.error("Failed to load leave requests", error);
        toast.error("Could not load leave requests.");
      } finally {
        setLoadingRequests(false);
      }
    },
    [selectedMonth, statusFilter],
  );

  const loadPolicies = useCallback(
    async (options?: { preferCache?: boolean }) => {
      setLoadingPolicies(true);
      try {
        const response = await listLeavePolicies(
          {
            page: policyPage,
            limit: policyLimit,
            search: policySearch.trim() || undefined,
          },
          options,
        );
        setPolicies(response.data);
        setPolicyMeta(response.meta);
        setPolicyDrafts((prev) => {
          const next = { ...prev };
          response.data.forEach((item) => {
            next[item.staffId] = next[item.staffId] ?? String(item.monthlyAllowanceMinutes);
          });
          return next;
        });
      } catch (error) {
        console.error("Failed to load leave policies", error);
        toast.error("Could not load leave policies.");
      } finally {
        setLoadingPolicies(false);
      }
    },
    [policyLimit, policyPage, policySearch],
  );

  useEffect(() => {
    void loadApprovals({ preferCache: true });
  }, [loadApprovals]);

  useEffect(() => {
    void loadPolicies({ preferCache: true });
  }, [loadPolicies]);

  const filteredRequests = useMemo(
    () =>
      requests
        .filter((request) => matchesSearch(request, approvalsSearch))
        .sort(
          (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        ),
    [approvalsSearch, requests],
  );

  const openProcessDialog = (request: LeaveRequest, action: ProcessAction) => {
    setSelectedRequest(request);
    setDialogAction(action);
    setProcessNote("");
    setDialogOpen(true);
  };

  const handleProcessRequest = async () => {
    if (!selectedRequest) return;
    try {
      setProcessingId(selectedRequest.id);
      const response = await processLeaveRequest(selectedRequest.id, {
        action: dialogAction,
        note: processNote.trim() || undefined,
      });
      toast.success(response.message ?? "Leave request updated.");
      await loadApprovals({ preferCache: false });
    } catch (error) {
      const responseData = (
        error as {
          response?: { data?: { message?: string } };
        }
      ).response?.data;
      toast.error(responseData?.message ?? "Failed to process leave request.");
    } finally {
      setProcessingId(null);
      setDialogOpen(false);
      setSelectedRequest(null);
      setProcessNote("");
    }
  };

  const updatePolicyDraft = (staffId: string, value: string) => {
    setPolicyDrafts((prev) => ({
      ...prev,
      [staffId]: value,
    }));
  };

  const handleSavePolicy = async (item: LeavePolicyItem) => {
    const rawValue = policyDrafts[item.staffId] ?? String(item.monthlyAllowanceMinutes);
    const normalized = rawValue.trim();
    if (!/^\d+$/.test(normalized)) {
      toast.error("Allowance must be a non-negative integer.");
      return;
    }
    const minutes = Number.parseInt(normalized, 10);

    try {
      setSavingPolicyId(item.staffId);
      const response = await updateLeavePolicy(item.staffId, minutes);
      toast.success(response.message ?? "Policy updated.");
      await loadPolicies({ preferCache: false });
    } catch (error) {
      const responseData = (
        error as {
          response?: { data?: { message?: string } };
        }
      ).response?.data;
      toast.error(responseData?.message ?? "Failed to update policy.");
    } finally {
      setSavingPolicyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leave Approvals</h2>
          <p className="text-gray-500">
            Review leave requests and manage monthly allowance policies.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "approvals"
                ? "bg-teal-50 text-teal-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("approvals")}
          >
            Approvals
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "policies"
                ? "bg-teal-50 text-teal-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("policies")}
          >
            Quota Policies
          </button>
        </div>
      </div>

      {activeTab === "approvals" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-1">
                <label className="text-xs text-gray-500">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-1">
                <label className="text-xs text-gray-500">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as LeaveStatus)
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value={LeaveStatus.PENDING}>Pending</option>
                  <option value={LeaveStatus.APPROVED}>Approved</option>
                  <option value={LeaveStatus.REJECTED}>Rejected</option>
                  <option value={LeaveStatus.CANCELLED}>Cancelled</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500">Search staff</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={approvalsSearch}
                    onChange={(event) => setApprovalsSearch(event.target.value)}
                    placeholder="Name, email, or staff ID"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Showing {statusLabel[statusFilter]} requests for{" "}
              {getMonthLabel(selectedMonth)}.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {loadingRequests ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading leave requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No leave requests matched your filters.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => {
                  const staffName = request.staff?.fullName ?? "Unknown staff";
                  const staffEmail = request.staff?.email ?? "N/A";
                  const isPending = request.status === LeaveStatus.PENDING;
                  const processedByName =
                    request.processedBy?.fullName ?? request.processedById ?? null;
                  const processedByEmail = request.processedBy?.email ?? null;
                  return (
                    <div
                      key={request.id}
                      className="rounded-lg border border-gray-100 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {staffName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[request.status]}`}
                            >
                              {statusLabel[request.status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {staffEmail} | {request.staffId}
                          </p>
                          <p className="text-xs text-gray-500">
                            <CalendarDays className="mr-1 inline h-3 w-3" />
                            {format(new Date(request.startTime), "MMM d, yyyy h:mm a")} -{" "}
                            {format(new Date(request.endTime), "MMM d, yyyy h:mm a")}
                          </p>
                          <p className="text-xs text-gray-500">
                            Duration: {formatMinutes(request.durationMinutes)}
                          </p>
                          {processedByName ? (
                            <p className="text-xs text-gray-500">
                              Processed by:{" "}
                              {processedByEmail
                                ? `${processedByName} (${processedByEmail})`
                                : processedByName}
                            </p>
                          ) : null}
                          {request.processedAt ? (
                            <p className="text-xs text-gray-500">
                              Processed at:{" "}
                              {format(new Date(request.processedAt), "MMM d, yyyy h:mm a")}
                            </p>
                          ) : null}
                          {request.reason ? (
                            <p className="text-xs text-gray-500">
                              Reason: {request.reason}
                            </p>
                          ) : null}
                          {request.processedNote ? (
                            <p className="text-xs text-gray-500">
                              Processed note: {request.processedNote}
                            </p>
                          ) : null}
                        </div>
                        {isPending ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openProcessDialog(request, "approve")}
                              disabled={processingId === request.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => openProcessDialog(request, "reject")}
                              disabled={processingId === request.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500">Search staff</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={policySearch}
                    onChange={(event) => {
                      setPolicySearch(event.target.value);
                      setPolicyPage(1);
                    }}
                    placeholder="Name, email, or staff ID"
                    className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>
              <div className="md:col-span-1 flex items-end">
                <button
                  onClick={() => loadPolicies({ preferCache: false })}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {loadingPolicies ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading policy data...
              </div>
            ) : policies.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No staff matched your filters.
              </div>
            ) : (
              <div className="space-y-3">
                {policies.map((item) => {
                  const saving = savingPolicyId === item.staffId;
                  return (
                    <div
                      key={item.staffId}
                      className="rounded-lg border border-gray-100 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.staff.fullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.staff.email} | {item.staffId}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={
                              policyDrafts[item.staffId] ??
                              String(item.monthlyAllowanceMinutes)
                            }
                            onChange={(event) =>
                              updatePolicyDraft(item.staffId, event.target.value)
                            }
                            className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => handleSavePolicy(item)}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Current allowance: {formatMinutes(item.monthlyAllowanceMinutes)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
              <span className="text-gray-500">
                Total: {policyMeta.total} staff | Page {policyMeta.page} of{" "}
                {Math.max(policyMeta.totalPages, 1)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPolicyPage((prev) => Math.max(prev - 1, 1))}
                  disabled={policyPage <= 1}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPolicyPage((prev) =>
                      policyMeta.totalPages > 0
                        ? Math.min(prev + 1, policyMeta.totalPages)
                        : prev,
                    )
                  }
                  disabled={
                    policyMeta.totalPages === 0 ||
                    policyPage >= policyMeta.totalPages
                  }
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedRequest(null);
            setProcessNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve leave request?" : "Reject leave request?"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? `${selectedRequest.staff?.fullName ?? selectedRequest.staffId} | ${
                    statusLabel[selectedRequest.status]
                  }`
                : "Confirm this action."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs text-gray-500">Note (optional)</label>
            <textarea
              value={processNote}
              onChange={(event) => setProcessNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              disabled={processingId !== null}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleProcessRequest}
              disabled={processingId !== null}
              className={`rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${
                dialogAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {processingId ? "Processing..." : dialogAction === "approve" ? "Approve" : "Reject"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
