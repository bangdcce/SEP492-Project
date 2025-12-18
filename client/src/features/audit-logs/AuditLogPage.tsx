import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Search,
  Calendar,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { AuditLogEntry, AuditLogFilters } from "./types";
import { auditLogsApi } from "./api";
import { AuditLogTable } from "./components/AuditLogTable";
import { AuditLogDetailModal } from "./components/AuditLogDetailModal";
import { Button } from "../../shared/components/custom/Button";

export const AuditLogPage: React.FC = () => {
  // ========== STATE ==========
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filter state
  const [filters, setFilters] = useState<AuditLogFilters>({
    searchAction: "",
    dateFrom: "",
    dateTo: "",
    riskLevel: "ALL",
  });

  // ========== FETCH DATA ==========
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Chuyển đổi filters sang params cho API
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        action: filters.searchAction || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        riskLevel: filters.riskLevel !== "ALL" ? filters.riskLevel : undefined,
      };

      const response = await auditLogsApi.getAll(params);

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
  }, [pagination.page, pagination.limit, filters]);

  // Fetch khi component mount hoặc filters/pagination thay đổi
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset về page 1 khi filters thay đổi
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [
    filters.searchAction,
    filters.dateFrom,
    filters.dateTo,
    filters.riskLevel,
  ]);

  // ========== HANDLERS ==========
  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(logs, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // ========== RENDER ==========
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">System Audit Logs</h1>
          <p className="text-gray-600 mt-1">
            Monitor and track all system activities and changes
          </p>
        </div>
        <Button onClick={handleExport} variant="primary" disabled={loading}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Total Logs</p>
          <p className="text-2xl text-slate-900">
            {loading ? "..." : pagination.total}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">High Risk</p>
          <p className="text-2xl text-red-600">
            {loading
              ? "..."
              : logs.filter((log) => log.riskLevel === "HIGH").length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">
            Today's Activity
          </p>
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase mb-1">Unique Users</p>
          <p className="text-2xl text-slate-900">
            {loading ? "..." : new Set(logs.map((log) => log.actor.email)).size}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search action or entity..."
              value={filters.searchAction}
              onChange={(e) =>
                setFilters({ ...filters, searchAction: e.target.value })
              }
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Date From */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters({ ...filters, dateFrom: e.target.value })
              }
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Date To */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters({ ...filters, dateTo: e.target.value })
              }
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Risk Level */}
          <div className="relative">
            <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={filters.riskLevel}
              onChange={(e) =>
                setFilters({ ...filters, riskLevel: e.target.value as any })
              }
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm appearance-none"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="NORMAL">Normal Risk</option>
              <option value="HIGH">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <span className="ml-2 text-gray-600">Loading audit logs...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchLogs}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <AuditLogTable logs={logs} onRowClick={setSelectedLog} />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <AuditLogDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};
