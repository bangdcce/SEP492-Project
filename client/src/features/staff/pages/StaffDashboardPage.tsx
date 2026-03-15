import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  Mail,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Link, generatePath } from "react-router-dom";
import { ROUTES } from "@/constants";
import type { StaffStats } from "../types/staff.types";
import {
  fetchPendingProjectInvites,
  getActiveSupervisedProjects,
  respondToProjectStaffInvite,
} from "@/features/project-workspace/api";
import type {
  ActiveSupervisedProject,
  PendingProjectInvite,
} from "@/features/project-workspace/types";

// Mock Data (matches StaffStats interface)
const staffStats: StaffStats = {
  utilizationRate: 78,
  activeCases: 12,
  resolvedThisMonth: 8,
  avgResolutionTimeHours: 42,
  tier: 1,
};

export const StaffDashboardPage = () => {
  const [pendingInvites, setPendingInvites] = useState<PendingProjectInvite[]>([]);
  const [activeSupervisedProjects, setActiveSupervisedProjects] = useState<
    ActiveSupervisedProject[]
  >([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingActiveProjects, setLoadingActiveProjects] = useState(true);
  const [respondingProjectId, setRespondingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([fetchPendingProjectInvites(), getActiveSupervisedProjects()])
      .then(([invites, activeProjects]) => {
        if (isCancelled) {
          return;
        }
        setPendingInvites(invites);
        setActiveSupervisedProjects(activeProjects);
      })
      .catch((error) => {
        console.error("Failed to load staff project panels:", error);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingInvites(false);
          setLoadingActiveProjects(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleInviteResponse = async (
    projectId: string,
    status: "ACCEPTED" | "REJECTED",
  ) => {
    try {
      setRespondingProjectId(projectId);
      await respondToProjectStaffInvite(projectId, status);
      setPendingInvites((prev) => prev.filter((invite) => invite.id !== projectId));
      if (status === "ACCEPTED") {
        setLoadingActiveProjects(true);
        const activeProjects = await getActiveSupervisedProjects();
        setActiveSupervisedProjects(activeProjects);
      }
    } catch (error) {
      console.error(`Failed to ${status.toLowerCase()} invite`, error);
    } finally {
      setLoadingActiveProjects(false);
      setRespondingProjectId(null);
    }
  };

  const formatBudget = (project: ActiveSupervisedProject) => {
    const amount = Number(project.totalBudget ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Budget TBD";
    }

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: project.currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatProjectStatus = (status: string) =>
    status
      .toLowerCase()
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Pending Project Invites</h3>
            <p className="text-sm text-gray-500">
              Review invitations from clients who want you to supervise delivery.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {pendingInvites.length} pending
          </div>
        </div>

        {loadingInvites ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading invites...
          </div>
        ) : pendingInvites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No pending project invites right now.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="h-4 w-4" />
                    {invite.clientName || "Client"}
                  </div>
                  <h4 className="mt-1 text-base font-semibold text-slate-900">
                    {invite.title}
                  </h4>
                  {invite.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {invite.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleInviteResponse(invite.id, "ACCEPTED")}
                    disabled={respondingProjectId === invite.id}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {respondingProjectId === invite.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Accept
                  </button>
                  <button
                    onClick={() => handleInviteResponse(invite.id, "REJECTED")}
                    disabled={respondingProjectId === invite.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Active Supervised Projects</h3>
            <p className="text-sm text-gray-500">
              Open any accepted supervision assignment and continue directly in the workspace.
            </p>
          </div>
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {activeSupervisedProjects.length} active
          </div>
        </div>

        {loadingActiveProjects ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading supervised projects...
          </div>
        ) : activeSupervisedProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No active supervised projects yet. Accepted invites will appear here.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeSupervisedProjects.map((project) => (
              <Link
                key={project.id}
                to={generatePath(ROUTES.STAFF_WORKSPACE, { projectId: project.id })}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <FolderKanban className="h-4 w-4" />
                      {project.clientName || "Client"}
                    </div>
                    <h4 className="mt-1 text-base font-semibold text-slate-900">
                      {project.title}
                    </h4>
                    {project.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {project.description}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {formatProjectStatus(project.status)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Budget
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatBudget(project)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                    Open workspace
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
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
