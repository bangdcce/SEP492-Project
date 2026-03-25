import { useDeferredValue, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { auditLogsApi } from "./api";
import type { AuditLogEntry, AuditLogFilters, AuditLogTimelineResponse } from "./types";
import { AuditLogTable } from "./components/AuditLogTable";
import { AuditLogDetailModal } from "./components/AuditLogDetailModal";
import { sendAuditBreadcrumbs } from "@/shared/api/audit-trace";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/shared/components/ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/components/ui/chart";

const activityChartConfig = {
  total: { label: "Total activity", color: "#0f766e" },
  breadcrumbs: { label: "Client breadcrumbs", color: "#7c3aed" },
};

const riskChartConfig = {
  errors: { label: "Errors", color: "#dc2626" },
  highRisk: { label: "High risk", color: "#ea580c" },
};

export const AuditLogPage = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [timeline, setTimeline] = useState<AuditLogTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [summary, setSummary] = useState({
    totalLogs: 0,
    highRisk: 0,
    errorCount: 0,
    clientBreadcrumbs: 0,
    uniqueActors: 0,
    correlatedRequests: 0,
  });
  const [series, setSeries] = useState<
    Array<{
      label: string;
      total: number;
      errors: number;
      highRisk: number;
      breadcrumbs: number;
    }>
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<AuditLogFilters>({
    searchAction: "",
    requestId: "",
    sessionId: "",
    dateFrom: "",
    dateTo: "",
    riskLevel: "ALL",
    source: "ALL",
    eventCategory: "ALL",
    errorOnly: false,
  });

  const deferredSearch = useDeferredValue(filters.searchAction || "");

  useEffect(() => {
    void sendAuditBreadcrumbs([
      {
        eventName: "audit-workspace-view",
        journeyStep: "page-load",
        route: "/admin/audit-logs",
      },
    ]);
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await auditLogsApi.getAll({
          page: pagination.page,
          limit: pagination.limit,
          action: deferredSearch || undefined,
          requestId: filters.requestId || undefined,
          sessionId: filters.sessionId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          riskLevel: filters.riskLevel !== "ALL" ? filters.riskLevel : undefined,
          source: filters.source !== "ALL" ? filters.source : undefined,
          eventCategory:
            filters.eventCategory !== "ALL" ? filters.eventCategory : undefined,
          errorOnly: filters.errorOnly || undefined,
        });

        setLogs(response.data);
        setSummary(response.summary);
        setSeries(response.series);
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
    };

    void fetchLogs();
  }, [
    pagination.page,
    pagination.limit,
    deferredSearch,
    filters.requestId,
    filters.sessionId,
    filters.dateFrom,
    filters.dateTo,
    filters.riskLevel,
    filters.source,
    filters.eventCategory,
    filters.errorOnly,
  ]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [
    deferredSearch,
    filters.requestId,
    filters.sessionId,
    filters.dateFrom,
    filters.dateTo,
    filters.riskLevel,
    filters.source,
    filters.eventCategory,
    filters.errorOnly,
  ]);

  const handleOpenLog = async (log: AuditLogEntry) => {
    setSelectedLog(log);
    try {
      const timelineData = await auditLogsApi.getTimeline(log.id);
      setTimeline(timelineData);
      void sendAuditBreadcrumbs([
        {
          eventName: "audit-log-detail-open",
          journeyStep: "timeline-drilldown",
          route: "/admin/audit-logs",
          metadata: { logId: log.id, requestId: log.requestId, sessionId: log.sessionId },
        },
      ]);
    } catch (err) {
      console.error("Failed to load audit timeline:", err);
      setTimeline(null);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      setExporting(format);
      const response = await auditLogsApi.export(format, {
        action: deferredSearch || undefined,
        requestId: filters.requestId || undefined,
        sessionId: filters.sessionId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        riskLevel: filters.riskLevel !== "ALL" ? filters.riskLevel : undefined,
        source: filters.source !== "ALL" ? filters.source : undefined,
        eventCategory:
          filters.eventCategory !== "ALL" ? filters.eventCategory : undefined,
        errorOnly: filters.errorOnly || undefined,
      });

      const blob = response.data;
      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename=\"([^\"]+)\"/i);
      const fileName = match?.[1] || `audit-logs.${format}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);

      void sendAuditBreadcrumbs([
        {
          eventName: "audit-log-export",
          journeyStep: "export",
          route: "/admin/audit-logs",
          metadata: { format },
        },
      ]);

      setExportOpen(false);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(224,231,255,0.95),_transparent_35%),linear-gradient(135deg,_#ffffff,_#f8fafc_55%,_#eff6ff)]">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr_0.95fr] xl:p-8">
          <div className="space-y-4">
            <Badge className="border-0 bg-slate-900 text-white">UC-86 Audit Export</Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Trace user journeys, risky changes, and failure context before things break
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Correlated request IDs, browser session breadcrumbs, DB-change diffs, and export
                flows now live in one audit workspace.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Total Logs" value={summary.totalLogs} icon={Workflow} tone="teal" />
            <SummaryTile label="High Risk" value={summary.highRisk} icon={ShieldAlert} tone="amber" />
            <SummaryTile label="Errors" value={summary.errorCount} icon={AlertTriangle} tone="rose" />
            <SummaryTile label="Breadcrumbs" value={summary.clientBreadcrumbs} icon={Search} tone="slate" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Activity Curve</CardTitle>
            <CardDescription>Total activity volume and captured user breadcrumbs.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={activityChartConfig} className="h-[280px] rounded-2xl bg-slate-50 p-3">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="auditActivityFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="total" stroke="var(--color-total)" fill="url(#auditActivityFill)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="breadcrumbs" stroke="var(--color-breadcrumbs)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Error & Risk Pressure</CardTitle>
            <CardDescription>Where faults and risky actions concentrate over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={riskChartConfig} className="h-[280px] rounded-2xl bg-rose-50/40 p-3">
              <BarChart data={series}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="errors" fill="var(--color-errors)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="highRisk" fill="var(--color-highRisk)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b">
          <CardTitle className="text-slate-950">Filters & Export</CardTitle>
          <CardDescription>Search across actors, route, request/session correlation, and risk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              icon={Search}
              placeholder="Action, route, user, request..."
              value={filters.searchAction || ""}
              onChange={(value) => setFilters((prev) => ({ ...prev, searchAction: value }))}
            />
            <FilterInput
              icon={Workflow}
              placeholder="Request ID"
              value={filters.requestId || ""}
              onChange={(value) => setFilters((prev) => ({ ...prev, requestId: value }))}
            />
            <FilterInput
              icon={Workflow}
              placeholder="Session ID"
              value={filters.sessionId || ""}
              onChange={(value) => setFilters((prev) => ({ ...prev, sessionId: value }))}
            />
            <div className="flex gap-2">
              <DateInput
                value={filters.dateFrom || ""}
                onChange={(value) => setFilters((prev) => ({ ...prev, dateFrom: value }))}
              />
              <DateInput
                value={filters.dateTo || ""}
                onChange={(value) => setFilters((prev) => ({ ...prev, dateTo: value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {["ALL", "LOW", "NORMAL", "HIGH"].map((item) => (
              <Button
                key={item}
                variant={filters.riskLevel === item ? "default" : "outline"}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, riskLevel: item as AuditLogFilters["riskLevel"] }))
                }
              >
                {item === "ALL" ? "All risk" : item}
              </Button>
            ))}
            {["ALL", "SERVER", "CLIENT"].map((item) => (
              <Button
                key={item}
                variant={filters.source === item ? "secondary" : "outline"}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, source: item as AuditLogFilters["source"] }))
                }
              >
                {item}
              </Button>
            ))}
            {["ALL", "ERROR", "DB_CHANGE", "UI_BREADCRUMB", "AUTH", "EXPORT"].map((item) => (
              <Button
                key={item}
                variant={filters.eventCategory === item ? "secondary" : "outline"}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    eventCategory: item as AuditLogFilters["eventCategory"],
                  }))
                }
              >
                {item}
              </Button>
            ))}
            <Button
              variant={filters.errorOnly ? "default" : "outline"}
              onClick={() => setFilters((prev) => ({ ...prev, errorOnly: !prev.errorOnly }))}
            >
              Errors only
            </Button>
            <Button variant="default" className="ml-auto" onClick={() => setExportOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white py-16">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-teal-600" />
          <span className="text-sm text-slate-600">Loading audit logs...</span>
        </div>
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader>
            <CardTitle className="text-rose-900">Failed to load audit logs</CardTitle>
            <CardDescription className="text-rose-700">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <AuditLogTable logs={logs} onRowClick={handleOpenLog} />
          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <AuditLogDetailModal
        log={selectedLog}
        timeline={timeline}
        onClose={() => {
          setSelectedLog(null);
          setTimeline(null);
        }}
      />

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export audit workspace</DialogTitle>
            <DialogDescription>
              Server-side export includes filters, flattened logs, and timeline context.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button onClick={() => void handleExport("csv")} disabled={Boolean(exporting)}>
              {exporting === "csv" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExport("xlsx")}
              disabled={Boolean(exporting)}
            >
              {exporting === "xlsx" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Excel Workbook
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryTile = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Workflow;
  tone: "teal" | "amber" | "rose" | "slate";
}) => {
  const tones = {
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-100 text-slate-800",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const FilterInput = ({
  icon: Icon,
  placeholder,
  value,
  onChange,
}: {
  icon: typeof Search;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="pl-9"
    />
  </div>
);

const DateInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="relative flex-1">
    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" />
  </div>
);
