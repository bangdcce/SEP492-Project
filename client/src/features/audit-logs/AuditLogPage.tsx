import React, { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  AlertTriangle,
  Loader2,
  Download,
  FileJson,
  FileSpreadsheet,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { AuditLogEntry, AuditLogFilters } from "./types";
import { auditLogsApi } from "./api";
import { AuditLogTable } from "./components/AuditLogTable";
import { AuditLogDetailModal } from "./components/AuditLogDetailModal";
import { Button } from "../../shared/components/custom/Button";
import { triggerBlobDownload } from "@/shared/utils/download";

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<AuditLogFilters>({
    searchAction: "",
    dateFrom: "",
    dateTo: "",
    riskLevel: "ALL",
  });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await auditLogsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        action: filters.searchAction || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        riskLevel: filters.riskLevel !== "ALL" ? filters.riskLevel : undefined,
        entityId: filters.entityId || undefined,
      });

      setLogs(response.data);
      setPagination((prev) => ({
        ...prev,
        total: response.meta.total,
        totalPages: response.meta.totalPages,
      }));
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo, filters.entityId, filters.riskLevel, filters.searchAction, pagination.limit, pagination.page]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filters.searchAction, filters.dateFrom, filters.dateTo, filters.riskLevel, filters.entityId]);

  const handleExport = useCallback(
    async (format: "json" | "csv") => {
      try {
        setExportingFormat(format);
        const exported = await auditLogsApi.export({
          action: filters.searchAction || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          riskLevel: filters.riskLevel !== "ALL" ? filters.riskLevel : undefined,
          entityId: filters.entityId || undefined,
          format,
        });
        triggerBlobDownload(exported.blob, exported.fileName);
        toast.success(`Audit logs exported as ${format.toUpperCase()}`);
      } catch (err) {
        console.error("Export failed:", err);
        toast.error("Could not export audit logs");
      } finally {
        setExportingFormat(null);
      }
    },
    [filters.dateFrom, filters.dateTo, filters.entityId, filters.riskLevel, filters.searchAction],
  );

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-slate-900">System Audit Logs</h1>
          <p className="mt-1 text-gray-600">
            Export filtered records and trace dispute-linked activity with consistent evidence metadata.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleExport("json")}
            variant="secondary"
            disabled={loading || exportingFormat !== null}
          >
            {exportingFormat === "json" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="mr-2 h-4 w-4" />
            )}
            Export JSON
          </Button>
          <Button
            onClick={() => void handleExport("csv")}
            variant="primary"
            disabled={loading || exportingFormat !== null}
          >
            {exportingFormat === "csv" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs uppercase text-gray-500">Total Logs</p>
          <p className="text-2xl text-slate-900">{loading ? "..." : pagination.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs uppercase text-gray-500">High Risk</p>
          <p className="text-2xl text-red-600">
            {loading ? "..." : logs.filter((log) => log.riskLevel === "HIGH").length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs uppercase text-gray-500">Today's Activity</p>
          <p className="text-2xl text-slate-900">
            {loading
              ? "..."
              : logs.filter((log) => {
                  const logDate = new Date(log.timestamp);
                  const today = new Date();
                  return logDate.toDateString() === today.toDateString();
                }).length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-xs uppercase text-gray-500">Unique Users</p>
          <p className="text-2xl text-slate-900">
            {loading ? "..." : new Set(logs.map((log) => log.actor.email)).size}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Action, entity, or user..."
                value={filters.searchAction}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchAction: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Dispute ID</label>
            <input
              type="text"
              placeholder="Optional dispute/entity id"
              value={filters.entityId || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, entityId: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">From Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">To Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Risk Level</label>
            <div className="relative">
              <AlertTriangle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={filters.riskLevel}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    riskLevel: e.target.value as AuditLogFilters["riskLevel"],
                  }))
                }
                className="w-full appearance-none rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="LOW">Low Risk</option>
                <option value="NORMAL">Normal Risk</option>
                <option value="HIGH">High Risk</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <span className="ml-2 text-gray-600">Loading audit logs...</span>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => void fetchLogs()}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <AuditLogTable logs={logs} onRowClick={setSelectedLog} />

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
};
