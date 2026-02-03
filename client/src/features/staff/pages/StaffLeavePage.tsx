import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveBalance,
  listLeaveRequests,
} from "@/features/leave/api";
import {
  LeaveStatus,
  LeaveType,
  type LeaveBalance,
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

const STATUS_STYLES: Record<LeaveStatus, { label: string; className: string }> = {
  [LeaveStatus.PENDING]: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  [LeaveStatus.APPROVED]: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  [LeaveStatus.REJECTED]: {
    label: "Rejected",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
  },
  [LeaveStatus.CANCELLED]: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-600 border border-slate-200",
  },
};

const TYPE_STYLES: Record<LeaveType, { label: string; className: string }> = {
  [LeaveType.SHORT_TERM]: {
    label: "Short-term",
    className: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  },
  [LeaveType.LONG_TERM]: {
    label: "Long-term",
    className: "bg-teal-50 text-teal-700 border border-teal-100",
  },
};

const formatMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const getMonthLabel = (month: string) => {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return format(date, "MMMM yyyy");
};

export const StaffLeavePage = () => {
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM"),
  );
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [pendingCancel, setPendingCancel] = useState<LeaveRequest | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const timeZone = useMemo(
    () =>
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC",
    [],
  );

  const minDateTime = useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }, []);

  const loadLeaveData = useCallback(
    async (options?: { preferCache?: boolean }) => {
      setLoadingBalance(true);
      setLoadingRequests(true);
      try {
        const [balanceResult, requestResult] = await Promise.all([
          getLeaveBalance(
            { month: selectedMonth, includePending: true, timeZone },
            options,
          ),
          listLeaveRequests({ month: selectedMonth }, options),
        ]);
        setBalance(balanceResult);
        setRequests(requestResult);
      } catch (error) {
        console.error("Failed to load leave data", error);
        toast.error("Could not load leave data.");
      } finally {
        setLoadingBalance(false);
        setLoadingRequests(false);
      }
    },
    [selectedMonth, timeZone],
  );

  useEffect(() => {
    loadLeaveData({ preferCache: true });
  }, [loadLeaveData]);

  const sortedRequests = useMemo(() => {
    return [...requests].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
  }, [requests]);

  const balanceSummary = useMemo(() => {
    if (!balance) return null;
    const usageRatio =
      balance.allowanceMinutes > 0
        ? Math.min(1, balance.countedMinutes / balance.allowanceMinutes)
        : 0;
    return {
      allowance: formatMinutes(balance.allowanceMinutes),
      approved: formatMinutes(balance.approvedMinutes),
      pending: formatMinutes(balance.pendingMinutes),
      remaining: formatMinutes(balance.remainingMinutes),
      overage: formatMinutes(balance.overageMinutes),
      usagePercent: Math.round(usageRatio * 100),
    };
  }, [balance]);

  const validateLeaveInput = () => {
    if (!startTime || !endTime) {
      toast.error("Please select both start and end times.");
      return null;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error("Invalid date/time.");
      return null;
    }

    if (start >= end) {
      toast.error("End time must be after start time.");
      return null;
    }

    if (start < new Date()) {
      toast.error("Leave cannot start in the past.");
      return null;
    }

    return { start, end };
  };

  const handleSubmit = async () => {
    const result = validateLeaveInput();
    if (!result) return;

    try {
      setSubmitting(true);
      const response = await createLeaveRequest({
        type: LeaveType.LONG_TERM,
        startTime: result.start.toISOString(),
        endTime: result.end.toISOString(),
        reason: reason.trim() ? reason.trim() : undefined,
        timeZone,
      });

      const message = response.message || "Leave request submitted.";
      toast.success(message);

      setStartTime("");
      setEndTime("");
      setReason("");

      await loadLeaveData({ preferCache: false });
    } catch (error) {
      const responseData = (error as { response?: { data?: { message?: string } } })
        .response?.data;
      const message = responseData?.message ?? "Failed to submit leave request.";
      toast.error(message);
      console.error("Failed to submit leave request", error);
    } finally {
      setSubmitting(false);
    }
  };

  const openCancelDialog = (request: LeaveRequest) => {
    setPendingCancel(request);
    setCancelNote("");
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    try {
      setCancellingId(pendingCancel.id);
      await cancelLeaveRequest(pendingCancel.id, {
        note: cancelNote.trim() ? cancelNote.trim() : undefined,
      });
      toast.success("Leave request cancelled.");
      await loadLeaveData({ preferCache: false });
    } catch (error) {
      console.error("Failed to cancel leave", error);
      toast.error("Could not cancel leave request.");
    } finally {
      setCancellingId(null);
      setCancelDialogOpen(false);
      setPendingCancel(null);
      setCancelNote("");
    }
  };

  const canCancel = useCallback((request: LeaveRequest) => {
    if (
      request.status === LeaveStatus.REJECTED ||
      request.status === LeaveStatus.CANCELLED
    ) {
      return false;
    }
    return new Date(request.startTime) > new Date();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Leave Management</h2>
          <p className="text-gray-500">
            Request time off, track monthly balance, and monitor approvals.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500" htmlFor="leave-month">
            Month
          </label>
          <input
            id="leave-month"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  New leave request
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Long-term requests require admin approval.
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4" />
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-gray-500">Reason (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Brief reason"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Start</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  min={minDateTime}
                  max={endTime || undefined}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">End</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  min={startTime || minDateTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Requests for {getMonthLabel(selectedMonth)}
              </h3>
              {loadingRequests && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
            </div>

            {loadingRequests ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                Loading leave requests...
              </div>
            ) : sortedRequests.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                No leave requests for this month.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {sortedRequests.map((request) => {
                  const statusStyle = STATUS_STYLES[request.status];
                  const typeStyle = TYPE_STYLES[request.type];
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white p-3"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {format(new Date(request.startTime), "MMM d, yyyy h:mm a")}
                            {" - "}
                            {format(new Date(request.endTime), "MMM d, yyyy h:mm a")}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeStyle.className}`}
                          >
                            {typeStyle.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle.className}`}
                          >
                            {statusStyle.label}
                          </span>
                          {request.isAutoApproved && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Auto-approved
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Duration: {formatMinutes(request.durationMinutes)}
                        </div>
                        {request.reason ? (
                          <div className="text-xs text-gray-500">
                            Reason: {request.reason}
                          </div>
                        ) : null}
                      </div>
                      {canCancel(request) ? (
                        <button
                          onClick={() => openCancelDialog(request)}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3 w-3" />
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Leave balance
                </h3>
                <p className="text-xs text-gray-500">
                  {getMonthLabel(selectedMonth)} quota
                </p>
              </div>
              {loadingBalance && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
            </div>

            {loadingBalance ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                Loading balance...
              </div>
            ) : balanceSummary ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Usage</span>
                    <span>{balanceSummary.usagePercent}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${
                        balance && balance.overageMinutes > 0
                          ? "bg-rose-500"
                          : "bg-teal-500"
                      }`}
                      style={{ width: `${balanceSummary.usagePercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-gray-500">Allowance</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {balanceSummary.allowance}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-gray-500">Remaining</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {balanceSummary.remaining}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-gray-500">Approved</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {balanceSummary.approved}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-gray-500">Pending</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {balanceSummary.pending}
                    </p>
                  </div>
                </div>

                {balanceSummary.overage !== "0m" && (
                  <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                    Overage: {balanceSummary.overage} (counts toward performance)
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                No balance data yet.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <h4 className="text-sm font-semibold text-teal-900">Policy notes</h4>
            <ul className="mt-2 space-y-2 text-xs text-teal-800">
              <li>Short-term leave should be added via availability.</li>
              <li>Long-term leave requests require admin approval.</li>
              <li>All leave counts against your monthly allowance.</li>
            </ul>
          </div>
        </div>
      </div>

      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) {
            setPendingCancel(null);
            setCancelNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel leave request?</DialogTitle>
            <DialogDescription>
              This will remove the request and free the time for scheduling.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs text-gray-500">Note (optional)</label>
            <textarea
              value={cancelNote}
              onChange={(event) => setCancelNote(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
              rows={3}
            />
          </div>
          <DialogFooter>
            <button
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancellingId !== null}
            >
              Keep
            </button>
            <button
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={confirmCancel}
              disabled={cancellingId !== null}
            >
              {cancellingId ? "Cancelling..." : "Cancel request"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
