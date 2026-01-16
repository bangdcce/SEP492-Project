/**
 * DashboardPage
 * Main admin dashboard with statistics and overview
 */

import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function DashboardPage() {
  // Mock statistics
  const stats = [
    {
      label: "Total Projects",
      value: "1,234",
      change: "+12.5%",
      trend: "up",
      icon: FileText,
      color: "teal",
    },
    {
      label: "Active Freelancers",
      value: "856",
      change: "+8.2%",
      trend: "up",
      icon: Users,
      color: "blue",
    },
    {
      label: "Total Revenue",
      value: "₫2.4B",
      change: "+23.1%",
      trend: "up",
      icon: DollarSign,
      color: "green",
    },
    {
      label: "Pending Reviews",
      value: "42",
      change: "-5.3%",
      trend: "down",
      icon: AlertCircle,
      color: "yellow",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "project_completed",
      title: 'Project "E-commerce Platform" completed',
      user: "John Doe",
      time: "5 minutes ago",
      status: "success",
    },
    {
      id: 2,
      type: "review_created",
      title: "New review received from Sarah Johnson",
      user: "Sarah Johnson",
      time: "12 minutes ago",
      status: "info",
    },
    {
      id: 3,
      type: "user_registered",
      title: "New freelancer registered",
      user: "Mike Chen",
      time: "1 hour ago",
      status: "success",
    },
    {
      id: 4,
      type: "report_flagged",
      title: "Review flagged for moderation",
      user: "System",
      time: "2 hours ago",
      status: "warning",
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl text-slate-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back! Here's what's happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    stat.color === "teal"
                      ? "bg-teal-100"
                      : stat.color === "blue"
                      ? "bg-blue-100"
                      : stat.color === "green"
                      ? "bg-green-100"
                      : "bg-yellow-100"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      stat.color === "teal"
                        ? "text-teal-600"
                        : stat.color === "blue"
                        ? "text-blue-600"
                        : stat.color === "green"
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  />
                </div>
                <span
                  className={`text-sm ${
                    stat.trend === "up" ? "text-teal-600" : "text-red-600"
                  } flex items-center gap-1`}
                >
                  <TrendingUp className="w-4 h-4" />
                  {stat.change}
                </span>
              </div>
              <div className="text-gray-600 text-sm mb-1">{stat.label}</div>
              <div className="text-2xl text-slate-900">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-teal-600" />
              <h2 className="text-xl text-slate-900">Recent Activity</h2>
            </div>
            <button className="text-sm text-teal-600 hover:text-teal-700">
              View All
            </button>
          </div>

          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activity.status === "success"
                      ? "bg-teal-100"
                      : activity.status === "warning"
                      ? "bg-yellow-100"
                      : "bg-blue-100"
                  }`}
                >
                  {activity.status === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  ) : activity.status === "warning" ? (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 mb-1">
                    {activity.title}
                  </div>
                  <div className="text-xs text-gray-500">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl text-slate-900 mb-6">Quick Actions</h2>

          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-between">
              <span>Moderate Reviews</span>
              <span className="bg-white/20 px-2 py-1 rounded text-sm">
                42 pending
              </span>
            </button>

            <button className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
              View System Logs
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 text-slate-900 rounded-lg hover:bg-gray-50 transition-colors">
              Export Analytics Report
            </button>

            <button className="w-full px-4 py-3 border border-gray-200 text-slate-900 rounded-lg hover:bg-gray-50 transition-colors">
              Manage Freelancers
            </button>
          </div>

          {/* System Status */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm text-gray-600 mb-3">System Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">API Server</span>
                <span className="flex items-center gap-2 text-teal-600">
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Database</span>
                <span className="flex items-center gap-2 text-teal-600">
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></div>
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Storage</span>
                <span className="text-gray-600">78% used</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
