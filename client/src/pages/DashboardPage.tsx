export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome to InterDev Admin Dashboard
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">
            Total Projects
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">24</p>
          <p className="text-sm text-green-600 mt-1">↑ 12% from last month</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">
            Active Users
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">156</p>
          <p className="text-sm text-green-600 mt-1">↑ 8% from last month</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 uppercase">
            Revenue
          </h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">$12,450</p>
          <p className="text-sm text-red-600 mt-1">↓ 3% from last month</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
            Create Project
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            View Reports
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            Manage Users
          </button>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Activity
        </h2>
        <div className="text-gray-500 text-center py-8">
          <p>Activity feed coming soon...</p>
          <p className="text-sm mt-1">
            Visit the{" "}
            <a href="/audit-logs" className="text-teal-600 hover:underline">
              Audit Logs
            </a>{" "}
            page to see system activities.
          </p>
        </div>
      </div>
    </div>
  );
}
