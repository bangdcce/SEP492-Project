import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Loader2,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { getAdminDashboardOverview } from "./admin.api";
import type {
  AdminDashboardOverview,
  AdminTeamMember,
  DashboardRange,
  StaffAnalyticsMember,
} from "./admin.types";
import { sendAuditBreadcrumbs } from "@/shared/api/audit-trace";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger, Badge } from "@/shared/components/ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/components/ui/chart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";

const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const revenueChartConfig = {
  revenue: { label: "Platform fee", color: "#0f766e" },
};

const growthChartConfig = {
  newUsers: { label: "New users", color: "#ea580c" },
  completedProjects: { label: "Completed projects", color: "#0f172a" },
};

type SelectedPanel =
  | { type: "admin"; member: AdminTeamMember }
  | { type: "staff"; member: StaffAnalyticsMember }
  | null;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value || 0,
  );

const formatDelta = (delta: number) =>
  `${delta >= 0 ? "+" : ""}${delta.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;

export function AdminDashboard() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel>(null);
  const [isSwitching, startTransition] = useTransition();

  useEffect(() => {
    const loadOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminDashboardOverview(range);
        setOverview(data);
      } catch (err: any) {
        console.error("Failed to load admin dashboard overview:", err);
        setError(err.message || "Failed to load admin analytics.");
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
        eventName: "admin-dashboard-view",
        journeyStep: "page-load",
        route: "/admin/dashboard",
        metadata: { range },
      },
    ]);
  }, []);

  useEffect(() => {
    void sendAuditBreadcrumbs([
      {
        eventName: "admin-dashboard-range-change",
        journeyStep: "range-filter",
        route: "/admin/dashboard",
        metadata: { range },
      },
    ]);
  }, [range]);

  const topAdmins = overview?.adminTeam.members.slice(0, 5) || [];
  const topStaff = overview?.staffTeam.members.slice(0, 5) || [];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-teal-600" />
        <span className="text-sm text-slate-600">Loading analytics workspace...</span>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardHeader>
          <CardTitle className="text-rose-900">Dashboard unavailable</CardTitle>
          <CardDescription className="text-rose-700">
            {error || "Admin analytics could not be loaded."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,237,213,0.9),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#ffffff_55%,_#ecfeff)]">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.25fr_0.9fr] xl:p-8">
          <div className="space-y-4">
            <Badge className="border-0 bg-slate-900 text-white">UC-87 • UC-101 Analytics</Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Platform control room with team-wide and per-person visibility
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Revenue, user acquisition, completed delivery throughput, admin operating
                activity, and staff execution quality in one view.
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
            <HeroMetricCard
              icon={Wallet}
              title="Platform Revenue"
              value={formatCurrency(overview.summary.revenue.value)}
              delta={formatDelta(overview.summary.revenue.delta)}
              tone="teal"
            />
            <HeroMetricCard
              icon={Users}
              title="New Users"
              value={formatCompact(overview.summary.newUsers.value)}
              delta={formatDelta(overview.summary.newUsers.delta)}
              tone="amber"
            />
            <HeroMetricCard
              icon={TrendingUp}
              title="Completed Projects"
              value={formatCompact(overview.summary.completedProjects.value)}
              delta={formatDelta(overview.summary.completedProjects.delta)}
              tone="slate"
            />
            <HeroMetricCard
              icon={ShieldAlert}
              title="Active Admins / Staff"
              value={`${overview.summary.activeAdmins.value} / ${overview.summary.activeStaff.value}`}
              delta={`${formatDelta(overview.summary.activeAdmins.delta)} | ${formatDelta(
                overview.summary.activeStaff.delta,
              )}`}
              tone="rose"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Revenue Trend</CardTitle>
            <CardDescription>Platform fee released across the selected window.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={revenueChartConfig}
              className="h-[280px] w-full rounded-2xl bg-slate-50/70 p-3"
            >
              <AreaChart data={overview.series}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  fill="url(#revenueFill)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-950">Growth Snapshot</CardTitle>
            <CardDescription>Acquisition and delivery velocity side by side.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={growthChartConfig}
              className="h-[280px] w-full rounded-2xl bg-gradient-to-br from-orange-50 via-white to-slate-50 p-3"
            >
              <BarChart data={overview.series}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="newUsers" fill="var(--color-newUsers)" radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="completedProjects"
                  fill="var(--color-completedProjects)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1.2fr_0.9fr]">
        <TeamPanel
          title="Admin Team"
          description={`${overview.adminTeam.activeMembers}/${overview.adminTeam.totalMembers} active in the selected range`}
          members={topAdmins}
          accent="teal"
          onSelect={(member) => {
            setSelectedPanel({ type: "admin", member });
            void sendAuditBreadcrumbs([
              {
                eventName: "admin-member-detail-open",
                journeyStep: "team-drilldown",
                route: "/admin/dashboard",
                metadata: { memberId: member.id, team: "admin" },
              },
            ]);
          }}
          renderValue={(member) => `${member.totalActions} actions`}
          renderMeta={(member) => `${member.highRiskActions} high-risk • ${member.reviewAudit} audit`}
        />

        <TeamPanel
          title="Staff Team"
          description={`${overview.staffTeam.activeMembers}/${overview.staffTeam.totalMembers} active across workload + performance`}
          members={topStaff}
          accent="amber"
          onSelect={(member) => {
            setSelectedPanel({ type: "staff", member });
            void sendAuditBreadcrumbs([
              {
                eventName: "staff-member-detail-open",
                journeyStep: "team-drilldown",
                route: "/admin/dashboard",
                metadata: { memberId: member.id, team: "staff" },
              },
            ]);
          }}
          renderValue={(member) => `${member.resolvedCases} resolved`}
          renderMeta={(member) => `${member.currentUtilizationRate}% util. • ${member.pendingCases} pending`}
        />

        <Card className="border-rose-200 bg-rose-50/70">
          <CardHeader>
            <CardTitle className="text-slate-950">Risk Focus</CardTitle>
            <CardDescription>Jump from anomalies into the audit workspace fast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-rose-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-rose-500">Backlog Pressure</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {overview.riskHighlights.backlogPressure.pendingCases}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {overview.riskHighlights.backlogPressure.overloadedCount} staff currently overloaded
              </p>
            </div>

            <div className="space-y-3">
              {overview.riskHighlights.highRiskAdminActions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  No recent high-risk admin events.
                </div>
              ) : (
                overview.riskHighlights.highRiskAdminActions.map((item) => (
                  <Link
                    key={item.id}
                    to={`/admin/audit-logs?requestId=${encodeURIComponent(item.requestId || "")}`}
                    className="flex items-start gap-3 rounded-2xl border border-white bg-white/90 p-4 transition hover:border-rose-200 hover:bg-white"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.actorName}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {item.action} • {item.entity}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                ))
              )}
            </div>

            <Button asChild variant="outline" className="w-full bg-white">
              <Link to="/admin/audit-logs">
                <Download className="mr-2 h-4 w-4" />
                Open Audit Workspace
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-950">Team Breakdown</CardTitle>
          <CardDescription>
            Switch between admin operating patterns and staff execution quality.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin">
            <TabsList>
              <TabsTrigger value="admin">Admin Activity</TabsTrigger>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
            </TabsList>
            <TabsContent value="admin" className="mt-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {overview.adminTeam.members.map((member) => (
                  <ListCard
                    key={member.id}
                    title={member.name}
                    subtitle={member.email}
                    stats={[
                      `${member.totalActions} actions`,
                      `${member.exports} exports`,
                      `${member.reviewAudit} audits`,
                      `${member.highRiskActions} high-risk`,
                    ]}
                    badge={member.isActive ? "Active" : "Idle"}
                    onClick={() => setSelectedPanel({ type: "admin", member })}
                  />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="staff" className="mt-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {overview.staffTeam.members.map((member) => (
                  <ListCard
                    key={member.id}
                    title={member.name}
                    subtitle={member.email}
                    stats={[
                      `${member.resolvedCases} resolved`,
                      `${member.pendingCases} pending`,
                      `${member.currentUtilizationRate}% current util.`,
                      `${member.avgResolutionTimeHours}h avg verdict`,
                    ]}
                    badge={member.isOverloaded ? "Overloaded" : "Balanced"}
                    onClick={() => setSelectedPanel({ type: "staff", member })}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedPanel)} onOpenChange={(open) => !open && setSelectedPanel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {selectedPanel?.type === "admin" ? "Admin drill-down" : "Staff drill-down"}
            </SheetTitle>
            <SheetDescription>
              {selectedPanel?.member.name} • {selectedPanel?.member.email}
            </SheetDescription>
          </SheetHeader>
          {selectedPanel?.type === "admin" ? (
            <AdminDetailPanel member={selectedPanel.member} />
          ) : selectedPanel?.type === "staff" ? (
            <StaffDetailPanel
              member={selectedPanel.member}
              averages={overview.staffTeam.averages}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HeroMetricCard({
  icon: Icon,
  title,
  value,
  delta,
  tone,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  delta: string;
  tone: "teal" | "amber" | "slate" | "rose";
}) {
  const tones = {
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-orange-200 bg-orange-50 text-orange-700",
    slate: "border-slate-200 bg-slate-100 text-slate-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-600">{delta} vs previous period</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TeamPanel<T extends { id: string; name: string; email: string }>({
  title,
  description,
  members,
  accent,
  onSelect,
  renderValue,
  renderMeta,
}: {
  title: string;
  description: string;
  members: T[];
  accent: "teal" | "amber";
  onSelect: (member: T) => void;
  renderValue: (member: T) => string;
  renderMeta: (member: T) => string;
}) {
  return (
    <Card className={accent === "teal" ? "border-teal-200" : "border-orange-200"}>
      <CardHeader>
        <CardTitle className="text-slate-950">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member)}
            className="flex w-full items-start justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950">{member.name}</p>
              <p className="truncate text-xs text-slate-500">{member.email}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-950">{renderValue(member)}</p>
              <p className="mt-1 text-xs text-slate-500">{renderMeta(member)}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function ListCard({
  title,
  subtitle,
  stats,
  badge,
  onClick,
}: {
  title: string;
  subtitle: string;
  stats: string[];
  badge: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-950">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <Badge variant="outline">{badge}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {stats.map((stat) => (
          <span
            key={stat}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
          >
            {stat}
          </span>
        ))}
      </div>
    </button>
  );
}

function AdminDetailPanel({ member }: { member: AdminTeamMember }) {
  return (
    <div className="space-y-4 px-4 pb-6">
      <DetailStatGrid
        items={[
          ["Total actions", member.totalActions],
          ["Exports", member.exports],
          ["Approvals / rejections", member.approvals],
          ["User moderation", member.userModeration],
          ["Review / spec audit", member.reviewAudit],
          ["High-risk actions", member.highRiskActions],
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Operating profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>Last active: {member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleString() : "No activity in the selected range"}</p>
          <p>Contribution score: {member.score.toFixed(2)}</p>
          <p>Other actions: {member.other}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StaffDetailPanel({
  member,
  averages,
}: {
  member: StaffAnalyticsMember;
  averages: AdminDashboardOverview["staffTeam"]["averages"];
}) {
  return (
    <div className="space-y-4 px-4 pb-6">
      <DetailStatGrid
        items={[
          ["Resolved cases", member.resolvedCases],
          ["Pending cases", member.pendingCases],
          ["Current utilization", `${member.currentUtilizationRate}%`],
          ["Average utilization", `${member.utilizationRate}%`],
          ["Appeal rate", `${member.appealRate}%`],
          ["Overturn rate", `${member.overturnRate}%`],
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-slate-950">Team comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <ComparisonRow label="Resolved cases" value={member.resolvedCases} average={averages.resolvedCases} />
          <ComparisonRow label="Pending cases" value={member.pendingCases} average={averages.pendingCases} />
          <ComparisonRow label="Utilization" value={member.utilizationRate} average={averages.utilizationRate} suffix="%" />
          <ComparisonRow label="Verdict time" value={member.avgResolutionTimeHours} average={averages.avgResolutionTimeHours} suffix="h" />
          <ComparisonRow label="Appeal rate" value={member.appealRate} average={averages.appealRate} suffix="%" />
          <ComparisonRow label="Overturn rate" value={member.overturnRate} average={averages.overturnRate} suffix="%" />
        </CardContent>
      </Card>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  average,
  suffix = "",
}: {
  label: string;
  value: number;
  average: number;
  suffix?: string;
}) {
  const delta = value - average;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">
        {value}
        {suffix}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {delta >= 0 ? "+" : ""}
        {delta.toFixed(2)}
        {suffix} vs team avg
      </p>
    </div>
  );
}

function DetailStatGrid({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  );
}
