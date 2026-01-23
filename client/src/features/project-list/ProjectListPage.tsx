import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { fetchProjectsByUser } from "./api";
import type { Project } from "./types";
import { ProjectCard } from "./components/ProjectCard";
import { Spinner } from "@/shared/components/ui";
import { STORAGE_KEYS, ROUTES } from "@/constants";
import type { User } from "@/features/auth/types";

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

  // Determine user's role in a specific project
  const getUserRoleInProject = (project: Project): string => {
    if (!user) return "Unknown";
    if (project.clientId === user.id) return "Client";
    if (project.brokerId === user.id) return "Broker";
    if (project.freelancerId === user.id) return "Freelancer";
    return "Collaborator";
  };

  // Get workspace path based on user role
  const getWorkspacePath = (projectId: string) => {
    if (!user) return `/client/workspace/${projectId}`;
    
    const role = user.role?.toUpperCase();
    if (role === "BROKER") return `/broker/workspace/${projectId}`;
    if (role === "FREELANCER") return `/freelancer/workspace/${projectId}`;
    return `/client/workspace/${projectId}`;
  };

  // Count disputed projects for summary
  const disputedProjectsCount = useMemo(() => {
    return projects.filter(
      (p) => p.status?.toUpperCase() === "DISPUTED" || p.hasActiveDispute
    ).length;
  }, [projects]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Projects</h1>
          <p className="text-gray-600">
            Select a project to open its workspace.
          </p>
        </div>
        
        {/* Dispute Alert Summary */}
        {disputedProjectsCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {disputedProjectsCount} project{disputedProjectsCount > 1 ? "s" : ""} with active disputes
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-600">No projects found.</p>
          <p className="text-sm text-gray-500 mt-1">
            Projects you're involved in will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              userRole={getUserRoleInProject(project)}
              onNavigate={() => navigate(getWorkspacePath(project.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
