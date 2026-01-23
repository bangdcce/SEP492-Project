import { AlertCircle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import type { StaffStats } from "../types/staff.types";

// Mock Data (matches StaffStats interface)
const staffStats: StaffStats = {
  utilizationRate: 78,
  activeCases: 12,
  resolvedThisMonth: 8,
  avgResolutionTimeHours: 42,
  tier: 1,
};

export const StaffDashboardPage = () => {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Dashboard Overview
        </h2>
        <p className="text-gray-500">
          Welcome back, get ready for your triage session.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Utilization Rate"
          value={`${staffStats.utilizationRate}%`}
          icon={TrendingUp}
          trend={+2.4}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Active Cases"
          value={staffStats.activeCases}
          icon={AlertCircle}
          trend={-1}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          title="Resolved (Month)"
          value={staffStats.resolvedThisMonth}
          icon={CheckCircle2}
          trend={+4}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Avg Resolution"
          value={`${staffStats.avgResolutionTimeHours}h`}
          icon={Clock}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Activity (Placeholder for Phase 2.5 Triage) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">
              Incoming Disputes (Triage)
            </h3>
            <button className="text-sm text-teal-600 font-medium hover:underline">
              View Queue
            </button>
          </div>

          <div className="space-y-4">
            {/* Creating placeholder skeletons for Triage rows */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse mr-4"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
            <div className="text-center text-sm text-gray-500 py-4">
              Connects to <code>StaffAssignmentService</code> (Phase 2.5) for
              real data.
            </div>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700">
              Check Availability
            </button>
            <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Update Skills Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple internal Stat Card Component
const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    {trend !== undefined && (
      <div
        className={`mt-2 text-xs font-medium ${trend > 0 ? "text-green-600" : "text-red-600"}`}
      >
        {trend > 0 ? "+" : ""}
        {trend} from last week
      </div>
    )}
  </div>
);
