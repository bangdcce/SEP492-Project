import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  TrendingDown,
  ChevronsUp,
  ChevronUp,
  Minus,
  ChevronDown,
} from "lucide-react";
import { fetchProjectRecentActivity } from "../../api";
import type { Milestone, ProjectRecentActivity, Task } from "../../types";
import {
  formatDistanceToNow,
  isWithinInterval,
  subDays,
  addDays,
} from "date-fns";
import { formatCurrency } from "@/shared/utils/formatters";
import {
  getTaskActionLaneLabel,
  getTaskActionOwner,
  type TaskActionOwner,
} from "../../utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectOverviewProps {
  projectId?: string;
  milestones: Milestone[];
  tasks: Task[];
  onOpenBoardFocus?: (focus: ProjectOverviewBoardFocus) => void;
}

export type ProjectOverviewBoardFocus = {
  actionOwner: TaskActionOwner | "ALL";
  overdueOnly: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtext,
  trend,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white border border-gray-300 rounded-[3px] p-4 shadow-sm flex flex-col justify-between h-32 hover:border-gray-400 transition-colors cursor-default">
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </h4>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-800">{value}</span>
        </div>
      </div>
      {subtext && (
        <div className="flex items-center text-xs text-slate-500 mt-2">
          {trend === "up" && (
            <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
          )}
          {trend === "down" && (
            <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
          )}
          {subtext}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {action && (
        <button className="text-blue-700 text-sm hover:underline font-medium">
          {action}
        </button>
      )}
    </div>
  );
}

function ActionRequiredButton({
  label,
  value,
  detail,
  tone = "slate",
  onClick,
  disabled = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "slate" | "amber" | "blue" | "red";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const toneClasses = {
    slate: "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100/80",
    amber: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/70",
    blue: "border-blue-200 bg-blue-50/80 hover:border-blue-300 hover:bg-blue-100/70",
    red: "border-red-200 bg-red-50/80 hover:border-red-300 hover:bg-red-100/70",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${
        disabled
          ? "cursor-default border-slate-200 bg-slate-50/60 text-slate-400"
          : `${toneClasses[tone]} text-slate-900`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <div className="mt-3 min-w-0">{value}</div>
        </div>
        {!disabled && onClick ? (
          <span className="shrink-0 rounded-full border border-white/70 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
            Open board
          </span>
        ) : null}
      </div>
      {detail ? (
        <div className="mt-3 text-sm leading-5 text-slate-600">{detail}</div>
      ) : null}
    </button>
  );
}

const ACTIVITY_LIMIT = 5;

const getTaskTimelineValue = (task: Pick<Task, "dueDate" | "startDate">) => {
  const rawValue = task.dueDate ?? task.startDate ?? null;
  if (!rawValue) {
    return Number.MAX_SAFE_INTEGER;
  }

  const parsedValue = new Date(rawValue).getTime();
  return Number.isNaN(parsedValue) ? Number.MAX_SAFE_INTEGER : parsedValue;
};

const formatTaskTimelineDate = (task: Pick<Task, "dueDate" | "startDate">) => {
  const rawValue = task.dueDate ?? task.startDate ?? null;
  if (!rawValue) {
    return "No due date";
  }

  const parsedValue = new Date(rawValue);
  return Number.isNaN(parsedValue.getTime())
    ? rawValue
    : parsedValue.toLocaleDateString();
};

const isTaskOverdue = (task: Pick<Task, "status" | "dueDate" | "startDate">) => {
  if (task.status === "DONE") {
    return false;
  }

  const dueDate = new Date(task.dueDate ?? task.startDate ?? "");
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate.getTime() < today.getTime();
};

const humanizeActivityValue = (value?: string) => {
  if (!value) return "";
  if (/^[A-Z0-9_ -]+$/.test(value)) {
    return value
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return value;
};

const getActivityVerb = (activity: ProjectRecentActivity) => {
  if (activity.fieldChanged === "status") {
    if (activity.newValue === "DONE") return "completed";
    if (activity.newValue === "IN_REVIEW") return "submitted";
    if (activity.oldValue === "DONE") return "reopened";
  }

  if (activity.fieldChanged === "assignee") {
    return "reassigned";
  }

  return "updated";
};

const getActivityDetail = (activity: ProjectRecentActivity) => {
  const fieldLabel =
    activity.fieldChanged.charAt(0).toUpperCase() + activity.fieldChanged.slice(1);
  const oldValue = humanizeActivityValue(activity.oldValue);
  const newValue = humanizeActivityValue(activity.newValue);

  if (oldValue && newValue) {
    return `${fieldLabel}: ${oldValue} -> ${newValue}`;
  }

  if (newValue) {
    return `${fieldLabel}: ${newValue}`;
  }

  return fieldLabel;
};

// Custom SVG Donut Chart
function StatusDonutChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const chartSegments = useMemo(() => {
    return data.reduce<
      Array<
        (typeof data)[number] & {
          percent: number;
          offset: number;
        }
      >
    >((segments, slice, index) => {
      const percent = total > 0 ? (slice.value / total) * 100 : 0;
      if (percent <= 0) {
        return segments;
      }

      const offset =
        25 -
        data
          .slice(0, index)
          .reduce(
            (accumulatedPercent, currentSlice) =>
              accumulatedPercent +
              (total > 0 ? (currentSlice.value / total) * 100 : 0),
            0,
          );

      return [
        ...segments,
        {
          ...slice,
          percent,
          offset,
        },
      ];
    }, []);
  }, [data, total]);

  return (
    <div className="flex items-center gap-8">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg viewBox="0 0 42 42" className="w-full h-full">
          {/* Background Circle */}
          {total === 0 && (
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="transparent"
              stroke="#DFE1E6"
              strokeWidth="5"
            />
          )}

          {chartSegments.map((slice) => {
            const strokeDasharray = `${slice.percent} ${100 - slice.percent}`;
            const isDimmed = hoveredLabel && hoveredLabel !== slice.label;
            const isHovered = hoveredLabel === slice.label;

            return (
              <circle
                key={slice.label}
                cx="21"
                cy="21"
                r="15.9155"
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? "6" : "5"}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={slice.offset}
                className="transition-all duration-300 ease-in-out cursor-pointer"
                style={{
                  opacity: isDimmed ? 0.3 : 1,
                  filter: isHovered ? "brightness(1.1)" : "none",
                }}
                onMouseEnter={() => setHoveredLabel(slice.label)}
                onMouseLeave={() => setHoveredLabel(null)}
              />
            );
          })}
          {/* Center Text */}
          <g fill="#172B4D">
            <text
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              className="text-[0.5rem] font-bold"
            >
              {total}
            </text>{" "}
            <text
              x="50%"
              y="65%"
              dominantBaseline="central"
              textAnchor="middle"
              className="text-[0.2rem] fill-gray-500"
            >
              Issues
            </text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-2 flex-1">
        {data.map((item) => {
          const percent =
            total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isDimmed = hoveredLabel && hoveredLabel !== item.label;
          const isHovered = hoveredLabel === item.label;

          return (
            <div
              key={item.label}
              className={`flex items-center justify-between text-sm p-1.5 rounded transition-colors cursor-pointer ${isHovered ? "bg-gray-50" : ""}`}
              onMouseEnter={() => setHoveredLabel(item.label)}
              onMouseLeave={() => setHoveredLabel(null)}
              style={{ opacity: isDimmed ? 0.4 : 1 }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-sm transition-transform duration-200 ${isHovered ? "scale-110" : ""}`}
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className={`text-slate-700 font-medium ${isHovered ? "text-slate-900 underline" : ""}`}
                >
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-mono">
                  {percent}%
                </span>
                <span className="text-slate-900 font-semibold w-6 text-right">
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivityList({
  activities,
  isLoading,
}: {
  activities: ProjectRecentActivity[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm border border-dashed border-gray-300 rounded-[3px]">
        Loading recent activity...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm border border-dashed border-gray-300 rounded-[3px]">
        No recent activity
      </div>
    );
  }

  return (
    <ul className="space-y-0">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="group flex items-center gap-3 py-2.5 px-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-[3px] transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
            {activity.actor?.avatarUrl ? (
              <img
                src={activity.actor.avatarUrl}
                className="w-8 h-8 rounded-full"
                alt=""
              />
            ) : (
              <span className="text-xs font-bold">
                {activity.actor?.fullName?.charAt(0) || "S"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800">
              <span className="font-semibold text-blue-700 hover:underline">
                {activity.actor?.fullName || "System"}
              </span>
              <span className="text-slate-600 mx-1">{getActivityVerb(activity)}</span>
              <span className="font-medium text-slate-900 truncate">
                {activity.task.title}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {getActivityDetail(activity)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDistanceToNow(new Date(activity.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Bar Chart (Vertical)
// ─────────────────────────────────────────────────────────────────────────────

function PriorityBarChart({
  data,
}: {
  data: {
    label: string;
    count: number;
    color: string;
    icon: React.ReactNode;
  }[];
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 5); // Minimum scale of 5
  // Calculate handy y-axis ticks. Round up to nearest integer.
  const yAxisMax = Math.ceil(maxCount);

  const chartHeight = 160;
  const chartWidth = 300; // viewBox width
  const barWidth = 40;
  // Calculate gap dynamically to center bars if fewer items, or separate them evenly
  // Available width for gaps = Total Width - (Number of bars * Bar Width)
  // Number of gaps = Number of bars + 1 (one on left, one on right, and between)
  const totalBarWidth = data.length * barWidth;
  const remainingSpace = chartWidth - totalBarWidth;
  const gap = remainingSpace / (data.length + 1);

  // Y-axis grid lines (0, 50%, 100%)
  const gridLines = [0, 0.5, 1];

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-sm text-slate-500 mb-1">
          Get a holistic view of how work is being prioritized.
        </h4>
      </div>

      <div className="relative w-full aspect-[2/1] min-h-[200px]">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
          className="w-full h-full text-slate-600"
        >
          {/* Grid Lines */}
          {gridLines.map((percent, i) => {
            const y = chartHeight - percent * chartHeight;
            const value = Math.round(percent * yAxisMax);
            return (
              <g key={i}>
                <line
                  x1="25"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
                <text
                  x="20"
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-400"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, i) => {
            const height = (item.count / yAxisMax) * chartHeight;
            const x = gap + i * (barWidth + gap);
            const y = chartHeight - height;

            return (
              <g key={i} className="group cursor-pointer">
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill="#94A3B8" // Slate-400 equivalent for "Unselected" look, user image has grey bars
                  className="hover:fill-slate-600 transition-colors duration-300"
                />
                {/* Tooltip text (simple) */}
                <title>{`${item.label}: ${item.count}`}</title>

                {/* X-Axis Icon & Label - Positioned below the chart */}
                <foreignObject
                  x={x - 10}
                  y={chartHeight + 10}
                  width={barWidth + 20}
                  height="40"
                >
                  <div className="flex flex-col items-center justify-start gap-1">
                    <div className="flex items-center gap-1">
                      {item.icon}
                      <span className="text-[10px] font-medium text-slate-700 truncate">
                        {item.label}
                      </span>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* X-Axis Line */}
          <line
            x1="25"
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#94A3B8"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectOverview({
  projectId,
  milestones,
  tasks,
  onOpenBoardFocus,
}: ProjectOverviewProps) {
  const [recentActivity, setRecentActivity] = useState<ProjectRecentActivity[]>([]);
  const [isLoadingRecentActivity, setIsLoadingRecentActivity] = useState(
    Boolean(projectId),
  );

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let cancelled = false;

    fetchProjectRecentActivity(projectId)
      .then((activity) => {
        if (!cancelled) {
          setRecentActivity(activity.slice(0, ACTIVITY_LIMIT));
        }
      })
      .catch((error) => {
        console.error("Failed to load recent activity", error);
        if (!cancelled) {
          setRecentActivity([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRecentActivity(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, tasks]);
  // ─────────────────────────────────────────────────────────────────────────
  // METRICS CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const today = new Date();
    const last7Days = { start: subDays(today, 7), end: today };
    const next7Days = { start: today, end: addDays(today, 7) };

    const completedLast7Days = tasks.filter(
      (t) =>
        t.status === "DONE" &&
        t.submittedAt &&
        isWithinInterval(new Date(t.submittedAt), last7Days),
    ).length;

    // Mocking CreatedAt since it's not in Task type yet (using submittedAt or random for demo)
    // Ideally we would check 'createdAt'
    const createdLast7Days = Math.floor(tasks.length * 0.2); // Mock for now

    const dueSoon = tasks.filter(
      (t) =>
        t.status !== "DONE" &&
        t.dueDate &&
        isWithinInterval(new Date(t.dueDate), next7Days),
    ).length;

    // Budget
    const totalBudget = milestones.reduce(
      (sum, m) => sum + Number(m.amount),
      0,
    );
    const releasedAmount = milestones
      .filter((m) => m.status === "COMPLETED" || m.status === "PAID")
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const percentDisbursed =
      totalBudget > 0 ? Math.round((releasedAmount / totalBudget) * 100) : 0;

    return {
      completedLast7Days,
      createdLast7Days,
      dueSoon,
      budget: {
        percent: percentDisbursed,
        info: `${formatCurrency(releasedAmount)} of ${formatCurrency(totalBudget)}`,
      },
    };
  }, [tasks, milestones]);

  // ─────────────────────────────────────────────────────────────────────────
  // CHART DATA
  // ─────────────────────────────────────────────────────────────────────────

  const statusData = useMemo(() => {
    const counts = {
      TODO: tasks.filter((t) => t.status === "TODO").length,
      IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      IN_REVIEW: tasks.filter((t) => t.status === "IN_REVIEW").length,
      DONE: tasks.filter((t) => t.status === "DONE").length,
    };

    return [
      { label: "Done", value: counts.DONE, color: "#00875A" }, // Jira Green
      { label: "In Review", value: counts.IN_REVIEW, color: "#FFAB00" }, // Jira Amber
      { label: "In Progress", value: counts.IN_PROGRESS, color: "#0052CC" }, // Jira Blue
      { label: "To Do", value: counts.TODO, color: "#DFE1E6" }, // Jira Gray
    ];
  }, [tasks]);

  const actionRequired = useMemo(() => {
    let waitingForFreelancer = 0;
    let waitingForBroker = 0;
    let waitingForClient = 0;
    let overdue = 0;
    let nextDueTask: Task | null = null;

    for (const task of tasks) {
      if (task.status === "DONE") {
        continue;
      }

      const actionOwner = getTaskActionOwner(task);
      if (actionOwner === "FREELANCER") {
        waitingForFreelancer += 1;
      } else if (actionOwner === "BROKER") {
        waitingForBroker += 1;
      } else if (actionOwner === "CLIENT") {
        waitingForClient += 1;
      }

      const taskIsOverdue = isTaskOverdue(task);
      if (taskIsOverdue) {
        overdue += 1;
      }

      if (
        taskIsOverdue ||
        getTaskTimelineValue(task) === Number.MAX_SAFE_INTEGER
      ) {
        continue;
      }

      if (
        !nextDueTask ||
        getTaskTimelineValue(task) < getTaskTimelineValue(nextDueTask)
      ) {
        nextDueTask = task;
      }
    }

    return {
      waitingForFreelancer,
      waitingForBroker,
      waitingForClient,
      overdue,
      nextDueTask,
    };
  }, [tasks]);

  const priorityData = useMemo(() => {
    const counts = {
      URGENT: tasks.filter((t) => t.priority === "URGENT").length,
      HIGH: tasks.filter((t) => t.priority === "HIGH").length,
      MEDIUM: tasks.filter((t) => t.priority === "MEDIUM").length,
      LOW: tasks.filter((t) => t.priority === "LOW").length,
    };
    const total = tasks.length;

    // Config for each priority
    const config = [
      {
        key: "URGENT",
        label: "Urgent",
        color: "bg-red-600",
        dotColor: "bg-red-600",
      },
      {
        key: "HIGH",
        label: "High",
        color: "bg-orange-500",
        dotColor: "bg-orange-500",
      },
      {
        key: "MEDIUM",
        label: "Medium",
        color: "bg-blue-500",
        dotColor: "bg-blue-500",
      },
      {
        key: "LOW",
        label: "Low",
        color: "bg-slate-400",
        dotColor: "bg-slate-400",
      },
    ];

    return config.map((c) => {
      const count = counts[c.key as keyof typeof counts] || 0;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        ...c,
        count,
        percent,
      };
    });
    // Optional: sort by count descending so biggest bars are first?
    // .sort((a,b) => b.count - a.count);
    // For now, let's keep them in Severity order (Urgent first) as that's more useful for "Risk" assessment.
  }, [tasks]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ROW 1: KEY METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="In the last 7 days"
          value={metrics.completedLast7Days}
          subtext="issues completed"
          trend="up"
        />
        <MetricCard
          label="New issues"
          value={metrics.createdLast7Days}
          subtext="created last 7 days"
        />
        <MetricCard
          label="Due soon"
          value={metrics.dueSoon}
          subtext="issues due next 7 days"
          trend={metrics.dueSoon > 0 ? "down" : "neutral"}
        />
        <MetricCard
          label="Budget Released"
          value={`${metrics.budget.percent}%`}
          subtext={metrics.budget.info}
        />
      </div>

      {/* ROW 2: INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Overview (Left) */}
        <div className="lg:col-span-5 bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
          <SectionHeader title="Status Overview" action="View all tasks" />
          <div className="py-4">
            <StatusDonutChart data={statusData} />
          </div>
        </div>

        {/* Recent Activity (Right) */}
        <div className="lg:col-span-7 bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
          <SectionHeader title="Recent Activity" />
          <RecentActivityList
            activities={recentActivity}
            isLoading={isLoadingRecentActivity}
          />
        </div>
      </div>

      {/* ROW 3: WORK BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
          <SectionHeader title="Priority Breakdown" />
          <PriorityBarChart
            data={priorityData.map((p) => ({
              label: p.label,
              count: p.count,
              color: p.dotColor,
              icon: (
                <span className="flex items-center">
                  {p.key === "URGENT" && (
                    <ChevronsUp className="w-4 h-4 text-red-600" />
                  )}
                  {p.key === "HIGH" && (
                    <ChevronUp className="w-4 h-4 text-red-500" />
                  )}
                  {p.key === "MEDIUM" && (
                    <Minus className="w-4 h-4 text-amber-500" />
                  )}
                  {p.key === "LOW" && (
                    <ChevronDown className="w-4 h-4 text-blue-500" />
                  )}
                </span>
              ),
            }))}
          />
        </div>

        {/* Action Required */}
        <div className="bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
          <SectionHeader title="Action Required" />
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionRequiredButton
              label="Waiting for freelancer"
              value={
                <p className="text-3xl font-bold text-slate-900">
                  {actionRequired.waitingForFreelancer}
                </p>
              }
              detail="Open tasks not yet submitted for review."
              onClick={() =>
                onOpenBoardFocus?.({
                  actionOwner: "FREELANCER",
                  overdueOnly: false,
                })
              }
              disabled={
                actionRequired.waitingForFreelancer === 0 || !onOpenBoardFocus
              }
            />
            <ActionRequiredButton
              label="Waiting for broker"
              value={
                <p className="text-3xl font-bold text-slate-900">
                  {actionRequired.waitingForBroker}
                </p>
              }
              detail="Tasks waiting for broker review."
              tone="amber"
              onClick={() =>
                onOpenBoardFocus?.({
                  actionOwner: "BROKER",
                  overdueOnly: false,
                })
              }
              disabled={actionRequired.waitingForBroker === 0 || !onOpenBoardFocus}
            />
            <ActionRequiredButton
              label="Waiting for client"
              value={
                <p className="text-3xl font-bold text-slate-900">
                  {actionRequired.waitingForClient}
                </p>
              }
              detail="Tasks broker-approved and pending client sign-off."
              tone="blue"
              onClick={() =>
                onOpenBoardFocus?.({
                  actionOwner: "CLIENT",
                  overdueOnly: false,
                })
              }
              disabled={actionRequired.waitingForClient === 0 || !onOpenBoardFocus}
            />
            <ActionRequiredButton
              label="Overdue"
              value={
                <p className="text-3xl font-bold text-slate-900">
                  {actionRequired.overdue}
                </p>
              }
              detail="Open tasks already past their deadline."
              tone="red"
              onClick={() =>
                onOpenBoardFocus?.({
                  actionOwner: "ALL",
                  overdueOnly: true,
                })
              }
              disabled={actionRequired.overdue === 0 || !onOpenBoardFocus}
            />
          </div>
          <div className="mt-3">
            <ActionRequiredButton
              label="Next due"
              value={
                actionRequired.nextDueTask ? (
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {actionRequired.nextDueTask.title}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {getTaskActionLaneLabel(
                        getTaskActionOwner(actionRequired.nextDueTask),
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-base font-semibold text-slate-500">
                    No open deadlines
                  </p>
                )
              }
              detail={
                actionRequired.nextDueTask ? (
                  <span>
                    Due {formatTaskTimelineDate(actionRequired.nextDueTask)}
                  </span>
                ) : (
                  "Every open task is done or has no deadline yet."
                )
              }
              onClick={() =>
                actionRequired.nextDueTask
                  ? onOpenBoardFocus?.({
                      actionOwner:
                        getTaskActionOwner(actionRequired.nextDueTask) ?? "ALL",
                      overdueOnly: false,
                    })
                  : undefined
              }
              disabled={!actionRequired.nextDueTask || !onOpenBoardFocus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectOverview;
