import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FolderKanban,
  Loader2,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { generatePath, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ROUTES } from "@/constants";
import {
  fetchPendingProjectInvites,
  getActiveSupervisedProjects,
  respondToProjectStaffInvite,
} from "@/features/project-workspace/api";
import type {
  ActiveSupervisedProject,
  PendingProjectInvite,
} from "@/features/project-workspace/types";
import { getApiErrorDetails } from "@/shared/utils/apiError";

const formatDate = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

const formatProjectStatus = (status?: string | null) => {
  if (!status) {
    return "Unknown";
  }

  return status
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const StaffProjectsPage = () => {
  const navigate = useNavigate();
  const [pendingInvites, setPendingInvites] = useState<PendingProjectInvite[]>([]);
  const [activeProjects, setActiveProjects] = useState<ActiveSupervisedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingInviteId, setActingInviteId] = useState<string | null>(null);

  const loadProjects = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    const setBusy = mode === "initial" ? setLoading : setRefreshing;

    try {
      setBusy(true);
      setError(null);

      const [invites, projects] = await Promise.all([
        fetchPendingProjectInvites(),
        getActiveSupervisedProjects(),
      ]);

      setPendingInvites(invites ?? []);
      setActiveProjects(projects ?? []);
    } catch (error) {
      console.error("Failed to load staff projects:", error);
      const details = getApiErrorDetails(error, "Failed to load staff project data.");
      setError(details.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects("initial");
  }, [loadProjects]);

  const handleInviteAction = useCallback(
    async (projectId: string, status: "ACCEPTED" | "REJECTED") => {
      try {
        setActingInviteId(projectId);
        await respondToProjectStaffInvite(projectId, status);
        toast.success(
          status === "ACCEPTED"
            ? "Project invite accepted successfully."
            : "Project invite rejected.",
        );
        await loadProjects();
      } catch (error) {
        console.error(`Failed to ${status.toLowerCase()} project invite:`, error);
        const details = getApiErrorDetails(
          error,
          status === "ACCEPTED"
            ? "Failed to accept the project invite."
            : "Failed to reject the project invite.",
        );
        toast.error(details.message);
      } finally {
        setActingInviteId(null);
      }
    },
    [loadProjects],
  );

  const handleOpenWorkspace = useCallback(
    (projectId: string) => {
      navigate(generatePath(ROUTES.STAFF_WORKSPACE, { projectId }));
    },
    [navigate],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Projects</h2>
          <p className="text-gray-500">
            Review supervision invites and continue work inside active project workspaces.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadProjects()}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          title="Pending Invites"
          value={pendingInvites.length}
          subtitle="Projects waiting for your response"
          accent="bg-blue-50 text-blue-700"
          icon={Mail}
        />
        <SummaryCard
          title="Active Supervised Projects"
          value={activeProjects.length}
          subtitle="Accepted projects you are currently monitoring"
          accent="bg-emerald-50 text-emerald-700"
          icon={FolderKanban}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Projects unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-teal-600" />
          <span className="text-sm text-gray-600">Loading staff projects...</span>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Pending Project Invites</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Accept or reject client requests for staff supervision.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {pendingInvites.length} pending
              </span>
            </div>

            {pendingInvites.length === 0 ? (
              <EmptyState
                title="No pending invites"
                description="New project supervision requests will appear here."
              />
            ) : (
              <div className="space-y-4">
                {pendingInvites.map((invite) => {
                  const busy = actingInviteId === invite.id;

                  return (
                    <article
                      key={invite.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Mail className="h-4 w-4" />
                        <span>{invite.clientName || "Client"}</span>
                        <span className="text-slate-300">&bull;</span>
                        <span>Received {formatDate(invite.createdAt)}</span>
                      </div>

                      <h4 className="mt-2 text-base font-semibold text-slate-900">
                        {invite.title}
                      </h4>

                      {invite.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {invite.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm italic text-slate-400">
                          No project description provided.
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleInviteAction(invite.id, "ACCEPTED")}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleInviteAction(invite.id, "REJECTED")}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Active Supervised Projects
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Open accepted assignments and continue inside the workspace.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {activeProjects.length} active
              </span>
            </div>

            {activeProjects.length === 0 ? (
              <EmptyState
                title="No active supervised projects"
                description="Accepted project invites will move here automatically."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeProjects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <FolderKanban className="h-4 w-4" />
                          <span>{project.clientName || "Client"}</span>
                        </div>
                        <h4 className="mt-2 text-base font-semibold text-slate-900">
                          {project.title}
                        </h4>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {formatProjectStatus(project.status)}
                      </span>
                    </div>

                    {project.description ? (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                        {project.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm italic text-slate-400">
                        No project description provided.
                      </p>
                    )}

                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Budget</dt>
                        <dd className="font-medium text-slate-900">{formatBudget(project)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Last updated</dt>
                        <dd className="font-medium text-slate-900">
                          {formatDate(project.updatedAt)}
                        </dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      onClick={() => handleOpenWorkspace(project.id)}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100"
                    >
                      Go to Workspace
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  subtitle,
  accent,
  icon: Icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  accent: string;
  icon: typeof FolderKanban;
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className={`rounded-lg p-3 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const EmptyState = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
);
