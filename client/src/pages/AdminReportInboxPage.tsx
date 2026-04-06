import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import {
  getPendingReports,
  getReportById,
  resolveReport,
} from "@/features/trust-profile/api/adminReportService";
import type {
  AdminReviewReport,
  PaginatedAdminReviewReports,
} from "@/features/trust-profile/types";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
};

const formatActor = (actor?: {
  fullName?: string | null;
  email?: string | null;
} | null) => {
  if (!actor) return "Unknown user";
  return actor.fullName || actor.email || "Unknown user";
};

const getReasonLabel = (reason: string) => reason.replaceAll("_", " ");

export default function AdminReportInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedReviewId = searchParams.get("reviewId") ?? "";
  const focusedReportId = searchParams.get("reportId") ?? "";

  const [reportPage, setReportPage] = useState<PaginatedAdminReviewReports | null>(
    null,
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<AdminReviewReport | null>(
    null,
  );
  const [adminNote, setAdminNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvingAction, setResolvingAction] = useState<
    "reject" | "resolve" | "resolve-delete" | null
  >(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getPendingReports({ page: 1, limit: 100 });
      setReportPage(response);
    } catch (error) {
      console.error("Failed to load reports:", error);
      toast.error("Could not load report inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const base = reportPage?.data ?? [];
    const query = searchQuery.trim().toLowerCase();

    return base.filter((report) => {
      if (focusedReviewId && report.review.id !== focusedReviewId) {
        return false;
      }
      if (!query) return true;

      return [
        report.id,
        report.reason,
        report.description,
        report.review.id,
        report.review.comment,
        report.reporter?.fullName,
        report.reporter?.email,
        report.review.reviewer?.fullName,
        report.review.reviewer?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [focusedReviewId, reportPage?.data, searchQuery]);

  useEffect(() => {
    if (!filteredReports.length) {
      setSelectedReportId(null);
      setSelectedReport(null);
      return;
    }

    const preferredId =
      (focusedReportId &&
        filteredReports.find((report) => report.id === focusedReportId)?.id) ||
      (selectedReportId &&
        filteredReports.find((report) => report.id === selectedReportId)?.id) ||
      filteredReports[0]?.id;

    if (preferredId && preferredId !== selectedReportId) {
      setSelectedReportId(preferredId);
    }
  }, [filteredReports, focusedReportId, selectedReportId]);

  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      setAdminNote("");
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        const detail = await getReportById(selectedReportId);
        if (cancelled) return;
        setSelectedReport(detail);
        setAdminNote(detail.adminNote || "");
      } catch (error) {
        console.error("Failed to load report detail:", error);
        if (!cancelled) {
          toast.error("Could not load report detail");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedReportId]);

  const selectReport = (reportId: string) => {
    setSelectedReportId(reportId);
    const next = new URLSearchParams(searchParams.toString());
    next.set("reportId", reportId);
    setSearchParams(next, { replace: true });
  };

  const clearReviewFocus = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("reviewId");
    if (!selectedReportId) {
      next.delete("reportId");
    }
    setSearchParams(next, { replace: true });
  };

  const handleResolve = async (
    status: "RESOLVED" | "REJECTED",
    deleteReview: boolean,
  ) => {
    if (!selectedReport) return;

    const action =
      status === "REJECTED"
        ? "reject"
        : deleteReview
          ? "resolve-delete"
          : "resolve";

    try {
      setResolvingAction(action);
      await resolveReport(selectedReport.id, {
        status,
        adminNote: adminNote.trim() || undefined,
        deleteReview: status === "RESOLVED" ? deleteReview : undefined,
      });
      toast.success(
        status === "REJECTED"
          ? "Report rejected."
          : deleteReview
            ? "Report resolved and review deleted."
            : "Report resolved.",
      );
      await loadReports();
      setSelectedReportId(null);
      setSelectedReport(null);
      setAdminNote("");
      const next = new URLSearchParams(searchParams.toString());
      next.delete("reportId");
      setSearchParams(next, { replace: true });
    } catch (error) {
      console.error("Failed to resolve report:", error);
      toast.error("Could not update report status");
    } finally {
      setResolvingAction(null);
    }
  };

  const pendingCount = reportPage?.total ?? filteredReports.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Report Inbox
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Resolve abuse reports through the dedicated report workflow so each
            reporter outcome is tracked before any review is kept, rejected, or
            removed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={ROUTES.ADMIN_REVIEW_MODERATION}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open review moderation
          </Link>
          <button
            type="button"
            onClick={() => void loadReports()}
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
            <Flag className="h-4 w-4 text-amber-600" />
            Pending reports
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {pendingCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Reports still waiting for an admin outcome.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <FileText className="h-4 w-4 text-sky-600" />
            Filtered
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {filteredReports.length}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Reports matching the current search and review filter.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <User className="h-4 w-4 text-emerald-600" />
            Focus review
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-900">
            {focusedReviewId || "All reviews"}
          </div>
          <div className="mt-3">
            {focusedReviewId ? (
              <button
                type="button"
                onClick={clearReviewFocus}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear review filter
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                Open this page from moderation to focus one flagged review.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by reason, review ID, reporter, or review content..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Pending report list
            </h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              No pending reports found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredReports.map((report) => {
                const isSelected = report.id === selectedReportId;
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => selectReport(report.id)}
                    className={`w-full px-5 py-4 text-left transition-colors ${
                      isSelected ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {report.id}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            {getReasonLabel(report.reason)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            Review {report.review.id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                          {report.description ||
                            report.review.comment ||
                            "No report description provided."}
                        </p>
                        <div className="mt-2 text-xs text-slate-500">
                          Reporter: {formatActor(report.reporter)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Reviewer: {formatActor(report.review.reviewer)}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatDateTime(report.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedReportId ? (
            <div className="flex h-full min-h-[520px] items-center justify-center px-6 text-center text-sm text-slate-500">
              Select a report to inspect evidence, review content, and apply the final outcome.
            </div>
          ) : detailLoading || !selectedReport ? (
            <div className="flex h-full min-h-[520px] items-center justify-center gap-2 px-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading report detail...
            </div>
          ) : (
            <div className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Report Detail
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                    {getReasonLabel(selectedReport.reason)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Filed {formatDateTime(selectedReport.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  {selectedReport.status}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Reporter
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatActor(selectedReport.reporter)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Reviewer
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatActor(selectedReport.review.reviewer)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Report description
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedReport.description || "No additional description provided."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Review snapshot
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {selectedReport.review.deletedAt ? "Already deleted" : "Visible"}
                  </span>
                </div>
                <div className="mt-3 text-sm text-slate-700">
                  <div className="mb-2 font-medium text-slate-900">
                    Rating: {selectedReport.review.rating ?? "N/A"}/5
                  </div>
                  <p className="whitespace-pre-wrap leading-6">
                    {selectedReport.review.comment || "No review comment stored."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="admin-report-note"
                  className="text-sm font-medium text-slate-900"
                >
                  Admin note
                </label>
                <textarea
                  id="admin-report-note"
                  rows={4}
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Explain the moderation outcome for internal traceability."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleResolve("REJECTED", false)}
                  disabled={resolvingAction !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolvingAction === "reject" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Reject report
                </button>
                <button
                  type="button"
                  onClick={() => void handleResolve("RESOLVED", false)}
                  disabled={resolvingAction !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolvingAction === "resolve" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Resolve only
                </button>
                <button
                  type="button"
                  onClick={() => void handleResolve("RESOLVED", true)}
                  disabled={resolvingAction !== null || Boolean(selectedReport.review.deletedAt)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolvingAction === "resolve-delete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Resolve and delete review
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
