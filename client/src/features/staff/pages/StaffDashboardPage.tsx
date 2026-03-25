import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  TimerReset,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { getStaffDashboardOverview } from "../api";
import { useStaffDashboardRealtime } from "../hooks/useStaffDashboardRealtime";
import type { StaffDashboardOverview, StaffDashboardRange } from "../types/staff.types";
import { getApiErrorDetails, isSchemaNotReadyErrorCode } from "@/shared/utils/apiError";
import { sendAuditBreadcrumbs } from "@/shared/api/audit-trace";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/components/ui/chart";

const rangeOptions: Array<{ value: StaffDashboardRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const throughputChartConfig = {
  newDisputes: { label: "New disputes", color: "#0f766e" },
  closed: { label: "Closed", color: "#f97316" },
};

const workloadChartConfig = {
  averageUtilizationRate: { label: "Utilization", color: "#0f172a" },
  pendingQueueCount: { label: "Pending queue", color: "#0ea5e9" },
};

const riskChartConfig = {
  overloadedStaff: { label: "Overloaded staff", color: "#dc2626" },
  conflictingEvidenceCases: { label: "Conflicting evidence", color: "#7c3aed" },
};

export const StaffDashboardPage = () => {
  const [range, setRange] = useState<StaffDashboardRange>("30d");
  const [overview, setOverview] = useState<StaffDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remediation, setRemediation] = useState<string | null>(null);
  const [schemaNotReady, setSchemaNotReady] = useState(false);
  const [isSwitching, startTransition] = useTransition();

  useEffect(() => {
    const loadOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        setRemediation(null);
        setSchemaNotReady(false);
        const data = await getStaffDashboardOverview(range);
        setOverview(data);
      } catch (err: any) {
        console.error("Failed to load staff dashboard overview:", err);
        const details = getApiErrorDetails(err, "Failed to load dashboard overview.");
        setSchemaNotReady(isSchemaNotReadyErrorCode(details.code));
        setError(details.message);
        setRemediation(details.remediation ?? null);
        setOverview(null);
      } finally {
        setLoading(false);
      }
    };

    void loadOverview();
  }, [range]);

  useEffect(() => {
    void sendAuditBreadcrumbs([
      {
        eventName: "staff-dashboard-view",
        journeyStep: "page-load",
        route: "/staff/dashboard",
        metadata: { range },
      },
    ]);
  }, []);

  useEffect(() => {
    void sendAuditBreadcrumbs([
      {
        eventName: "staff-dashboard-range-change",
        journeyStep: "range-filter",
        route: "/staff/dashboard",
        metadata: { range },
      },
    ]);
  }, [range]);

  useStaffDashboardRealtime({
    onDisputeCreated: () => void getStaffDashboardOverview(range).then(setOverview).catch(() => undefined),
    onHearingEnded: () => void getStaffDashboardOverview(range).then(setOverview).catch(() => undefined),
    onVerdictIssued: () => void getStaffDashboardOverview(range).then(setOverview).catch(() => undefined),
    onStaffOverloaded: () => void getStaffDashboardOverview(range).then(setOverview).catch(() => undefined),
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-teal-600" />
        <span className="text-sm text-slate-600">Loading dashboard overview...</span>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <Card
        className={
          schemaNotReady ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
        }
      >
        <CardHeader>
          <CardTitle className={schemaNotReady ? "text-amber-900" : "text-rose-900"}>
            {schemaNotReady ? "Schema not ready" : "Dashboard unavailable"}
          </CardTitle>
          <CardDescription className={schemaNotReady ? "text-amber-800" : "text-rose-700"}>
            {error}
          </CardDescription>
          {schemaNotReady && remediation ? (
            <p className="text-xs text-amber-800">{remediation}</p>
          ) : null}
        </CardHeader>
      </Card>
    );
  }

  const spotlight = overview.currentUser;
  const topPeers = overview.members.slice(0, 5);

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(207,250,254,0.95),_transparent_35%),linear-gradient(135deg,_#ffffff,_#f8fafc_50%,_#fff7ed)]">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr_0.95fr] xl:p-8">
          <div className="space-y-4">
            <Badge className="border-0 bg-slate-900 text-white">Staff Command Center</Badge>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Team throughput, your position, and operational risk in one place
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Monitor dispute flow, SLA pressure, queue health, and see how your own execution
                compares to the team average.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={range === option.value ? "default" : "outline"}
                  onClick={() => startTransition(() => setRange(option.value))}
                  disabled={isSwitching}
                  className={range === option.value ? "bg-slate-900 text-white" : "bg-white"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile
              icon={TrendingUp}
              title="Utilization Rate"
              value={`${overview.workload.averageUtilizationRate}%`}
              subtitle={`${overview.workload.totalStaff} active staff tracked`}
              tone="teal"
            />
            <MetricTile
              icon={AlertCircle}
              title="Pending Queue"
              value={`${overview.workload.pendingQueueCount}`}
              subtitle={`${overview.throughput.inProgress} disputes in progress`}
              tone="amber"
            />
            <MetricTile
              icon={CheckCircle2}
              title="Closed Cases"
              value={`${overview.throughput.closed}`}
              subtitle={`${overview.quality.appealRate}% appeal rate`}
              tone="slate"
            />
            <MetricTile
              icon={TimerReset}
              title="Median Verdict"
              value={`${overview.sla.medianTimeToVerdictHours}h`}
              subtitle={`${overview.sla.breachRate}% breached SLA`}
              tone="rose"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Throughput Trend</CardTitle>
            <CardDescription>New intake versus completed dispute volume.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={throughputChartConfig}
              className="h-[280px] rounded-2xl bg-teal-50/40 p-3"
            >
              <AreaChart data={overview.series.throughput}>
                <defs>
                  <linearGradient id="newDisputesFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-newDisputes)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-newDisputes)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="newDisputes"
                  stroke="var(--color-newDisputes)"
                  fill="url(#newDisputesFill)"
                  strokeWidth={2.5}
                />
                <Line type="monotone" dataKey="closed" stroke="var(--color-closed)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Workload & Queue</CardTitle>
            <CardDescription>Average utilization and queue load over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={workloadChartConfig}
              className="h-[280px] rounded-2xl bg-slate-50 p-3"
            >
              <BarChart data={overview.series.workload}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="averageUtilizationRate" fill="var(--color-averageUtilizationRate)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="pendingQueueCount" fill="var(--color-pendingQueueCount)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.2fr_0.9fr]">
        <Card className="border-teal-200 bg-teal-50/40">
          <CardHeader>
            <CardTitle className="text-slate-950">My Performance vs Team</CardTitle>
            <CardDescription>Where you sit relative to the team baseline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {spotlight ? (
              <>
                <div className="rounded-2xl border border-white bg-white/90 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-teal-600">Current Standing</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    Rank #{spotlight.rank || "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {spotlight.resolvedCases} resolved • {spotlight.currentUtilizationRate}% current utilization
                  </p>
                </div>
                <ComparisonTile label="Resolved cases" value={spotlight.resolvedCases} average={spotlight.teamAverages.resolvedCases} />
                <ComparisonTile label="Pending cases" value={spotlight.pendingCases} average={spotlight.teamAverages.pendingCases} />
                <ComparisonTile label="Average utilization" value={spotlight.utilizationRate} average={spotlight.teamAverages.utilizationRate} suffix="%" />
                <ComparisonTile label="Verdict speed" value={spotlight.avgResolutionTimeHours} average={spotlight.teamAverages.avgResolutionTimeHours} suffix="h" />
              </>
            ) : (
              <div className="rounded-2xl border border-white bg-white/90 p-4 text-sm text-slate-600">
                Team comparison is available for staff accounts only.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Peer Leaderboard</CardTitle>
            <CardDescription>Top current performers by combined case output and quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPeers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                onClick={() =>
                  void sendAuditBreadcrumbs([
                    {
                      eventName: "staff-peer-highlight-open",
                      journeyStep: "peer-leaderboard",
                      route: "/staff/dashboard",
                      metadata: { memberId: member.id, position: index + 1 },
                    },
                  ])
                }
                className="flex w-full items-start justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">#{index + 1}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">{member.resolvedCases} resolved</p>
                  <p>{member.currentUtilizationRate}% util.</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader>
            <CardTitle className="text-slate-950">Operational Risk</CardTitle>
            <CardDescription>Track overloads and quality pressure before they spill.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-white bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-rose-600">Overloaded Staff</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {overview.highlights.backlogPressure.overloadedCount}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Pending queue {overview.highlights.backlogPressure.pendingQueueCount}
              </p>
            </div>
            <ChartContainer config={riskChartConfig} className="h-[200px] rounded-2xl bg-white p-3">
              <LineChart data={overview.series.risk}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="overloadedStaff" stroke="var(--color-overloadedStaff)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="conflictingEvidenceCases" stroke="var(--color-conflictingEvidenceCases)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MetricTile = ({
  icon: Icon,
  title,
  value,
  subtitle,
  tone,
}: {
  icon: typeof TrendingUp;
  title: string;
  value: string;
  subtitle: string;
  tone: "teal" | "amber" | "slate" | "rose";
}) => {
  const tones = {
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    slate: "border-slate-200 bg-slate-100 text-slate-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const ComparisonTile = ({
  label,
  value,
  average,
  suffix = "",
}: {
  label: string;
  value: number;
  average: number;
  suffix?: string;
}) => {
  const delta = value - average;
  return (
    <div className="rounded-2xl border border-white bg-white/90 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">
        {value}
        {suffix}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {delta >= 0 ? "+" : ""}
        {delta.toFixed(2)}
        {suffix} vs team average
      </p>
    </div>
  );
};
