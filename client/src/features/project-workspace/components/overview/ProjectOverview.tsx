import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  TrendingDown,
  ChevronsUp,
  ChevronUp,
  Minus,
  ChevronDown,
} from "lucide-react";
import type { Milestone, Task } from "../../types";
import {
  formatDistanceToNow,
  isWithinInterval,
  subDays,
  addDays,
} from "date-fns";
import { formatCurrency } from "@/shared/utils/formatters";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectOverviewProps {
  milestones: Milestone[];
  tasks: Task[];
}

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

// Custom SVG Donut Chart
function StatusDonutChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  let accumulatedOffset = 25; // Start at 12 o'clock

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

          {data.map((slice) => {
            const percent = total > 0 ? (slice.value / total) * 100 : 0;
            const strokeDasharray = `${percent} ${100 - percent}`;
            const offset = accumulatedOffset;
            accumulatedOffset -= percent; // Move clockwise

            if (percent === 0) return null;

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
                strokeDashoffset={offset}
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

function RecentActivityList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm border border-dashed border-gray-300 rounded-[3px]">
        No recent activity
      </div>
    );
  }

  return (
    <ul className="space-y-0">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="group flex items-center gap-3 py-2.5 px-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-[3px] transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
            {task.assignee?.avatarUrl ? (
              <img
                src={task.assignee.avatarUrl}
                className="w-8 h-8 rounded-full"
                alt=""
              />
            ) : (
              <span className="text-xs font-bold">
                {task.assignee?.fullName?.charAt(0) || "U"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800">
              <span className="font-semibold text-blue-700 hover:underline">
                {task.assignee?.fullName || "Unassigned"}
              </span>
              <span className="text-slate-600 mx-1">
                {task.status === "DONE" ? "completed" : "updated"}
              </span>
              <span className="font-medium text-slate-900 truncate">
                {task.title}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {task.submittedAt
                ? formatDistanceToNow(new Date(task.submittedAt)) + " ago"
                : "Recently"}
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

export function ProjectOverview({ milestones, tasks }: ProjectOverviewProps) {
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

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return dateB - dateA; // Descending
      })
      .slice(0, 5);
  }, [tasks]);

  // Mock Workload Data
  const teamWorkload = useMemo(() => {
    const assigneeCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      const name = t.assignee?.fullName || "Unassigned";
      assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
    });
    return Object.entries(assigneeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          <RecentActivityList tasks={recentTasks} />
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

        {/* Team Workload */}
        <div className="bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
          <SectionHeader title="Team Workload" />
          <div className="space-y-4">
            {teamWorkload.map((member) => (
              <div
                key={member.name}
                className="flex items-center justify-between group hover:bg-gray-50 p-2 rounded-md -mx-2 transition-colors cursor-default"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200 group-hover:border-slate-300 transition-colors">
                    {member.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                    {member.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-100 group-hover:bg-blue-100 transition-colors">
                    {member.count} tasks
                  </div>
                </div>
              </div>
            ))}
            {teamWorkload.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No tasks assigned yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectOverview;
