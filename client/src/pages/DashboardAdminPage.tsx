import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Loader2,
  ShieldAlert,
  Siren,
  Users,
  Workflow,
} from "lucide-react";
import { getAdminDashboardOverview } from "@/features/dashboard/admin.api";
import type {
  AdminDashboardOverview,
  DashboardRange,
} from "@/features/dashboard/admin.types";
import { ROUTES } from "@/constants";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui";

const rangeOptions: Array<{ label: string; value: DashboardRange }> = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

export default function DashboardAdminPage() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await getAdminDashboardOverview(range);
        if (!cancelled) {
          setOverview(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load admin dashboard.",
          );
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !overview) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-slate-700" />
        <span className="text-sm text-slate-600">
          Loading admin dashboard...
        </span>
      </div>
    );
  }

  if (!overview) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardHeader>
          <CardTitle className="text-rose-900">
            Admin dashboard unavailable
          </CardTitle>
          <CardDescription className="text-rose-700">
            {error || "Admin dashboard data could not be loaded."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const incidentSummary = overview.systemIncidentHub.summary;
  const hasIncidents = incidentSummary.activeCount > 0;

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(254,240,138,0.45),_transparent_30%),linear-gradient(135deg,_#ffffff,_#f8fafc_55%,_#eef2ff)]">
        <div className="space-y-5 p-6 xl:p-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <Badge className="border-0 bg-slate-900 text-white">
                Admin operations
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Operations command center
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Serious system incidents surface here first, then business
                  risk and team pressure.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={range === option.value ? "default" : "outline"}
                  onClick={() => setRange(option.value)}
                  className={
                    range === option.value
                      ? "bg-slate-900 text-white"
                      : "bg-white"
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <Alert
            className={
              hasIncidents
                ? "border-rose-200 bg-rose-50 text-rose-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-950"
            }
          >
            {hasIncidents ? (
              <Siren className="h-4 w-4 text-rose-700" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-emerald-700" />
            )}
            <AlertTitle>
              {hasIncidents
                ? `${incidentSummary.activeCount} active system incident group(s) in the last 24 hours`
                : "No critical system incidents detected in the last 24 hours"}
            </AlertTitle>
            <AlertDescription
              className={hasIncidents ? "text-rose-800" : "text-emerald-800"}
            >
              {hasIncidents
                ? `Affected components: ${incidentSummary.affectedComponents}. Latest incident ${formatRelative(incidentSummary.lastOccurredAt)}.`
                : "The backend is not currently surfacing any severe or critical system failures into the incident hub."}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="Revenue"
              value={formatMetricValue(
                overview.summary.revenue.value,
                overview.summary.revenue.currency || "USD",
              )}
              delta={overview.summary.revenue.delta}
              icon={CircleDollarSign}
            />
            <MetricCard
              title="New users"
              value={String(overview.summary.newUsers.value)}
              delta={overview.summary.newUsers.delta}
              icon={Users}
            />
            <MetricCard
              title="Completed projects"
              value={String(overview.summary.completedProjects.value)}
              delta={overview.summary.completedProjects.delta}
              icon={Workflow}
            />
            <MetricCard
              title="Active admins"
              value={String(overview.summary.activeAdmins.value)}
              delta={overview.summary.activeAdmins.delta}
              icon={ShieldAlert}
            />
            <MetricCard
              title="Active staff"
              value={String(overview.summary.activeStaff.value)}
              delta={overview.summary.activeStaff.delta}
              icon={Activity}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              System Incident Hub
            </CardTitle>
            <CardDescription>
              Severe technical failures grouped by fingerprint so admins see
              recurring breakage fast.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.systemIncidentHub.items.length ? (
              overview.systemIncidentHub.items.map((item) => (
                <div
                  key={item.fingerprint}
                  className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={incidentBadgeClass(item.severity)}>
                          {item.severity}
                        </Badge>
                        <Badge variant="outline">{item.category}</Badge>
                        <Badge variant="outline">{item.component}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {item.message}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Operation: {item.operation}
                          {item.errorCode ? ` • ${item.errorCode}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-[180px] space-y-2 text-sm text-slate-600">
                      <p>{item.occurrences} occurrence(s)</p>
                      <p>Last seen {formatRelative(item.lastSeenAt)}</p>
                      <Button
                        asChild
                        size="sm"
                        className="w-full bg-slate-900 text-white"
                      >
                        <Link
                          to={`${item.actionUrl}${
                            item.actionUrl.includes("?") ? "&" : "?"
                          }openLogId=${encodeURIComponent(item.latestAuditLogId)}`}
                        >
                          Inspect logs
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                No severe or critical incidents were aggregated from audit logs
                in the last 24 hours.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">
              Business-critical alerts
            </CardTitle>
            <CardDescription>
              Existing operational risk signals remain separate from the
              technical incident hub.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.criticalAlerts.length ? (
              overview.criticalAlerts.slice(0, 5).map((alert) => (
                <Link
                  key={`${alert.source}-${alert.title}`}
                  to={alert.actionUrl}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge className={businessAlertBadgeClass(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {alert.source}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{alert.summary}</p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No business-risk alerts are currently active.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">
              High-risk admin activity
            </CardTitle>
            <CardDescription>
              Latest high-risk admin actions recorded by the audit workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.riskHighlights.highRiskAdminActions.length ? (
              overview.riskHighlights.highRiskAdminActions.map((entry) => (
                <Link
                  key={entry.id}
                  to={`${ROUTES.ADMIN_AUDIT_LOGS}?requestId=${encodeURIComponent(entry.requestId || "")}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {entry.actorName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.eventName}
                      </p>
                    </div>
                    <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                      {entry.riskLevel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {entry.action} on {entry.entity}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatRelative(entry.timestamp)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No recent high-risk admin actions.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">
              Staff capacity pressure
            </CardTitle>
            <CardDescription>
              Team members currently carrying the most operational load.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.riskHighlights.overloadedStaff.length ? (
              overview.riskHighlights.overloadedStaff.map((member) => (
                <div
                  key={member.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {member.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {member.pendingCases} pending case(s)
                      </p>
                    </div>
                    <Badge className="border-amber-200 bg-white text-amber-700">
                      {member.utilizationRate}%
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                No overloaded staff members in the current range.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TeamCard
          title="Admin team"
          description="Most active governance operators in the selected range."
          rows={overview.adminTeam.members.slice(0, 5).map((member) => ({
            id: member.id,
            name: member.name,
            detail: `${member.totalActions} action(s) • ${member.highRiskActions} high-risk`,
            badge: member.isActive ? "Active" : "Quiet",
          }))}
        />
        <TeamCard
          title="Staff team"
          description="Current workload and dispute throughput snapshot."
          rows={overview.staffTeam.members.slice(0, 5).map((member) => ({
            id: member.id,
            name: member.name,
            detail: `${member.pendingCases} pending • ${member.resolvedCases} resolved • ${member.currentUtilizationRate}% util.`,
            badge: member.isOverloaded ? "Overloaded" : "Stable",
          }))}
        />
      </div>
    </div>
  );
}

const MetricCard = ({
  title,
  value,
  delta,
  icon: Icon,
}: {
  title: string;
  value: string;
  delta: number;
  icon: typeof Users;
}) => (
  <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
          {title}
        </p>
        <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
        <p
          className={`mt-2 text-sm ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}
        >
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs previous window
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const TeamCard = ({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{
    id: string;
    name: string;
    detail: string;
    badge: string;
  }>;
}) => (
  <Card className="border-slate-200">
    <CardHeader>
      <CardTitle className="text-slate-950">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {rows.length ? (
        rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div>
              <p className="text-sm font-semibold text-slate-950">{row.name}</p>
              <p className="mt-1 text-sm text-slate-600">{row.detail}</p>
            </div>
            <Badge variant="outline">{row.badge}</Badge>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-600">
          No activity recorded for this range.
        </p>
      )}
    </CardContent>
  </Card>
);

const formatMetricValue = (value: number, currency?: string) => {
  if (currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US").format(value);
};

const formatRelative = (timestamp: string | null) => {
  if (!timestamp) {
    return "just now";
  }

  return `${formatDistanceToNow(new Date(timestamp), { addSuffix: true })}`;
};

const incidentBadgeClass = (severity: "HIGH" | "CRITICAL" | "SEVERE") => {
  if (severity === "SEVERE") {
    return "border-red-700 bg-red-700 text-white";
  }

  if (severity === "CRITICAL") {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  return "border-amber-200 bg-amber-100 text-amber-800";
};

const businessAlertBadgeClass = (
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SEVERE",
) => {
  if (severity === "SEVERE") {
    return "border-red-700 bg-red-700 text-white";
  }
  if (severity === "CRITICAL") {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }
  if (severity === "HIGH") {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }
  if (severity === "MEDIUM") {
    return "border-sky-200 bg-sky-100 text-sky-800";
  }

  return "border-emerald-200 bg-emerald-100 text-emerald-800";
};
