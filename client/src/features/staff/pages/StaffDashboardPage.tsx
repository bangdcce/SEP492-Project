import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { getStaffDashboardOverview } from "../api";
import { useStaffDashboardRealtime } from "../hooks/useStaffDashboardRealtime";
import type { StaffDashboardOverview, StaffDashboardRange } from "../types/staff.types";
import { getApiErrorDetails, isSchemaNotReadyErrorCode } from "@/shared/utils/apiError";

const rangeOptions: Array<{ value: StaffDashboardRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export const StaffDashboardPage = () => {
  const [range, setRange] = useState<StaffDashboardRange>("30d");
  const [overview, setOverview] = useState<StaffDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remediation, setRemediation] = useState<string | null>(null);
  const [schemaNotReady, setSchemaNotReady] = useState(false);

  const loadOverview = useCallback(async () => {
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
  }, [range]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useStaffDashboardRealtime({
    onDisputeCreated: () => void loadOverview(),
    onHearingEnded: () => void loadOverview(),
    onVerdictIssued: () => void loadOverview(),
    onStaffOverloaded: () => void loadOverview(),
  });

  const statCards = useMemo(() => {
    if (!overview) return [];
    return [
      {
        title: "Utilization Rate",
        value: `${overview.workload.averageUtilizationRate}%`,
        icon: TrendingUp,
        color: "bg-blue-50 text-blue-600",
        subtitle: `${overview.workload.totalStaff} active staff`,
      },
      {
        title: "In Progress",
        value: overview.throughput.inProgress,
        icon: AlertCircle,
        color: "bg-amber-50 text-amber-600",
        subtitle: `${overview.workload.pendingQueueCount} waiting in queue`,
      },
      {
        title: "Closed Cases",
        value: overview.throughput.closed,
        icon: CheckCircle2,
        color: "bg-green-50 text-green-600",
        subtitle: `${overview.quality.appealRate}% appeal rate`,
      },
      {
        title: "Median Verdict",
        value: `${overview.sla.medianTimeToVerdictHours}h`,
        icon: Clock,
        color: "bg-slate-100 text-slate-700",
        subtitle: `${overview.sla.breachRate}% breached SLA`,
      },
    ];
  }, [overview]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-gray-500">
            Live dispute throughput, SLA pressure, scheduling health, and risk signals.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                range === option.value
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-teal-600" />
          <span className="text-sm text-gray-600">Loading dashboard overview...</span>
        </div>
      ) : error ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
            schemaNotReady
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-semibold">
            {schemaNotReady ? "Schema not ready" : "Dashboard unavailable"}
          </p>
          <p className="mt-1">{error}</p>
          {schemaNotReady && remediation ? (
            <p className="mt-2 text-xs text-amber-800">{remediation}</p>
          ) : null}
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard
                key={card.title}
                title={card.title}
                value={card.value}
                subtitle={card.subtitle}
                icon={card.icon}
                color={card.color}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <MetricGroup
              title="Throughput"
              items={[
                ["New disputes", overview.throughput.newDisputes],
                ["In progress", overview.throughput.inProgress],
                ["Closed", overview.throughput.closed],
              ]}
            />
            <MetricGroup
              title="SLA"
              items={[
                ["Median first response", `${overview.sla.medianTimeToFirstResponseHours}h`],
                ["Median verdict", `${overview.sla.medianTimeToVerdictHours}h`],
                ["Breach rate", `${overview.sla.breachRate}%`],
              ]}
            />
            <MetricGroup
              title="Scheduling"
              items={[
                ["Auto-schedule success", `${overview.scheduling.autoScheduleSuccessRate}%`],
                ["Reschedules", overview.scheduling.rescheduleCount],
                ["No-show rate", `${overview.scheduling.noShowRate}%`],
              ]}
            />
            <MetricGroup
              title="Quality"
              items={[
                ["Appeal rate", `${overview.quality.appealRate}%`],
                ["Overturned verdicts", `${overview.quality.overturnedVerdictRate}%`],
                ["Feedback score", overview.quality.feedbackScore || "N/A"],
              ]}
            />
            <MetricGroup
              title="Workload"
              items={[
                ["Avg cases/staff", overview.workload.averageCasesPerStaff],
                ["Avg utilization", `${overview.workload.averageUtilizationRate}%`],
                ["Pending queue", overview.workload.pendingQueueCount],
              ]}
            />
            <MetricGroup
              title="Risk Signals"
              items={[
                ["Prolonged cases", overview.riskSignals.prolongedCases],
                ["Multi-party cases", overview.riskSignals.multiPartyCases],
                ["Conflicting evidence", overview.riskSignals.conflictingEvidenceCases],
              ]}
              accent="border-amber-200 bg-amber-50"
              icon={ShieldAlert}
            />
          </div>
        </>
      ) : null}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof TrendingUp;
  color: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {subtitle ? <p className="mt-2 text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      <div className={`rounded-lg p-3 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);

const MetricGroup = ({
  title,
  items,
  accent,
  icon: Icon,
}: {
  title: string;
  items: Array<[string, string | number]>;
  accent?: string;
  icon?: typeof ShieldAlert;
}) => (
  <div className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${accent || ""}`}>
    <div className="mb-4 flex items-center gap-2">
      {Icon ? <Icon className="h-4 w-4 text-amber-700" /> : null}
      <h3 className="font-semibold text-slate-900">{title}</h3>
    </div>
    <div className="space-y-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-500">{label}</span>
          <span className="font-semibold text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  </div>
);
