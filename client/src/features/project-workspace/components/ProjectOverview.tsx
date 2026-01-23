import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  TrendingDown,
} from "lucide-react";
import type { Milestone, Task } from "../types";
import { formatDistanceToNow, isWithinInterval, subDays, addDays } from "date-fns";

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
};

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
          {trend === "up" && <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-red-600 mr-1" />}
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
           {total === 0 && <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#DFE1E6" strokeWidth="5" />}
           
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
                    filter: isHovered ? 'brightness(1.1)' : 'none'
                 }}
                 onMouseEnter={() => setHoveredLabel(slice.label)}
                 onMouseLeave={() => setHoveredLabel(null)}
               />
             );
           })}
           {/* Center Text */}
           <g fill="#172B4D">
             <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="text-[0.5rem] font-bold">
               {total}
             </text>             <text x="50%" y="65%" dominantBaseline="central" textAnchor="middle" className="text-[0.2rem] fill-gray-500">
               Issues
             </text>
           </g>
         </svg>
      </div>
      
      {/* Legend */}
      <div className="space-y-2 flex-1">
        {data.map((item) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
            const isDimmed = hoveredLabel && hoveredLabel !== item.label;
            const isHovered = hoveredLabel === item.label;

            return (
                <div 
                    key={item.label} 
                    className={`flex items-center justify-between text-sm p-1.5 rounded transition-colors cursor-pointer ${isHovered ? 'bg-gray-50' : ''}`}
                    onMouseEnter={() => setHoveredLabel(item.label)}
                    onMouseLeave={() => setHoveredLabel(null)}
                    style={{ opacity: isDimmed ? 0.4 : 1 }}
                >
                  <div className="flex items-center gap-2">
                    <span 
                        className={`w-3 h-3 rounded-sm transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`} 
                        style={{ backgroundColor: item.color }} 
                    />
                    <span className={`text-slate-700 font-medium ${isHovered ? 'text-slate-900 underline' : ''}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono">{percent}%</span>
                    <span className="text-slate-900 font-semibold w-6 text-right">{item.value}</span>
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
                 <img src={task.assignee.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
             ) : (
                 <span className="text-xs font-bold">{task.assignee?.fullName?.charAt(0) || "U"}</span>
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
                    : "Recently"
                }
            </p>
          </div>
        </li>
      ))}
    </ul>
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
        isWithinInterval(new Date(t.submittedAt), last7Days)
    ).length;
    
    // Mocking CreatedAt since it's not in Task type yet (using submittedAt or random for demo)
    // Ideally we would check 'createdAt'
    const createdLast7Days = Math.floor(tasks.length * 0.2); // Mock for now

    const dueSoon = tasks.filter(
      (t) =>
        t.status !== "DONE" &&
        t.dueDate &&
        isWithinInterval(new Date(t.dueDate), next7Days)
    ).length;
    
    // Budget
    const totalBudget = milestones.reduce((sum, m) => sum + Number(m.amount), 0);
    const releasedAmount = milestones
      .filter((m) => m.status === "COMPLETED" || m.status === "PAID")
      .reduce((sum, m) => sum + Number(m.amount), 0);
    const percentDisbursed = totalBudget > 0 ? Math.round((releasedAmount / totalBudget) * 100) : 0;

    return {
      completedLast7Days,
      createdLast7Days,
      dueSoon,
      budget: {
          percent: percentDisbursed,
          info: `${formatCurrency(releasedAmount)} of ${formatCurrency(totalBudget)}`
      }
    };
  }, [tasks, milestones]);

  // ─────────────────────────────────────────────────────────────────────────
  // CHART DATA
  // ─────────────────────────────────────────────────────────────────────────

  const statusData = useMemo(() => {
      const counts = {
          TODO: tasks.filter(t => t.status === 'TODO').length,
          IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
          IN_REVIEW: tasks.filter(t => t.status === 'IN_REVIEW').length,
          DONE: tasks.filter(t => t.status === 'DONE').length,
      };
      
      return [
          { label: "Done", value: counts.DONE, color: "#00875A" },     // Jira Green
          { label: "In Review", value: counts.IN_REVIEW, color: "#FFAB00" }, // Jira Amber
          { label: "In Progress", value: counts.IN_PROGRESS, color: "#0052CC" }, // Jira Blue
          { label: "To Do", value: counts.TODO, color: "#DFE1E6" },    // Jira Gray
      ];
  }, [tasks]);

  const recentTasks = useMemo(() => {
      return [...tasks]
        .sort((a,b) => {
            const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
            const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
            return dateB - dateA; // Descending
        })
        .slice(0, 5);
  }, [tasks]);

  // Mock Workload Data
  const teamWorkload = useMemo(() => {
      const assigneeCounts: Record<string, number> = {};
      tasks.forEach(t => {
          const name = t.assignee?.fullName || "Unassigned";
          assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
      });
      return Object.entries(assigneeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));
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
        {/* Priority Breakdown (Mock) */}
        <div className="bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
            <SectionHeader title="Priority Breakdown" />
            <div className="space-y-4 mt-2">
                {/* Mock Bars */}
                {[
                    { label: "High", count: 3, percent: 15, color: "bg-red-500" },
                    { label: "Medium", count: 12, percent: 60, color: "bg-amber-400" },
                    { label: "Low", count: 5, percent: 25, color: "bg-blue-400" },
                ].map((item) => (
                    <div key={item.label}>
                         <div className="flex justify-between text-sm mb-1 text-slate-700">
                             <span className="font-medium">{item.label}</span>
                             <span>{item.count}</span>
                         </div>
                         <div className="w-full bg-gray-100 rounded-full h-2">
                             <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                         </div>
                    </div>
                ))}
            </div>
        </div>

         {/* Team Workload */}
         <div className="bg-white border border-gray-300 rounded-[3px] p-5 shadow-sm">
            <SectionHeader title="Team Workload" />
            <div className="space-y-4">
                {teamWorkload.map((member) => (
                    <div key={member.name} className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200">
                                 {member.name.charAt(0)}
                             </div>
                             <span className="text-sm font-medium text-slate-700">{member.name}</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <div className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                 {member.count} tasks
                             </div>
                         </div>
                    </div>
                ))}
                {teamWorkload.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No tasks assigned yet.</p>
                )}
            </div>
        </div>
      </div>

    </div>
  );
}

export default ProjectOverview;
