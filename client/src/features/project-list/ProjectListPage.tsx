import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjectsByUser } from "./api";
import type { Project } from "./types";
import { Spinner } from "@/shared/components/ui";
import { cn } from "@/lib/utils";
import { STORAGE_KEYS, ROUTES } from "@/constants";
import type { User } from "@/features/auth/types";

const statusBadge = (status: string) => {
  const normalized = status?.toLowerCase();
  if (normalized === "completed" || normalized === "done") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (
    normalized === "in_progress" ||
    normalized === "in-progress" ||
    normalized === "inprogress"
  ) {
    return "bg-sky-100 text-sky-700";
  }
  return "bg-slate-100 text-slate-700";
};

// Helper to get current user from localStorage
const getCurrentUser = (): User | null => {
  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch {
    // Invalid JSON in localStorage
  }
  return null;
};

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user] = useState<User | null>(getCurrentUser);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProjectsByUser(user.id);
        setProjects(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, navigate]);

  const renderRole = (project: Project) => {
    if (!user) return "Unknown";
    if (project.freelancerId === user.id) return "Freelancer";
    if (project.clientId === user.id) return "Client";
    return "Collaborator";
  };

  // Show loading while checking auth
  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Projects</h1>
          <p className="text-gray-600">
            Select a project to open its workspace.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => navigate(`/client/workspace/${project.id}`)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {project.title}
                  </h2>
                  {project.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                      {project.description}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-semibold",
                    statusBadge(project.status)
                  )}
                >
                  {project.status}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  Role: {renderRole(project)}
                </span>
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  Budget: ${Number(project.totalBudget || 0).toLocaleString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
