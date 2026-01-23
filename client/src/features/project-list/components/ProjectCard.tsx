import { AlertTriangle, ArrowRight, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "../types";

interface ProjectCardProps {
  project: Project;
  userRole: string;
  onNavigate: () => void;
}

/**
 * Status badge styling based on project status
 */
const getStatusBadgeStyle = (status: string) => {
  const normalized = status?.toUpperCase();
  
  switch (normalized) {
    case "COMPLETED":
    case "PAID":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "IN_PROGRESS":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "TESTING":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "DISPUTED":
      return "bg-red-100 text-red-700 border-red-200";
    case "CANCELED":
      return "bg-gray-100 text-gray-500 border-gray-200";
    case "PLANNING":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

/**
 * Format status for display
 */
const formatStatus = (status: string) => {
  return status?.replace(/_/g, " ") || "Unknown";
};

export function ProjectCard({ project, userRole, onNavigate }: ProjectCardProps) {
  const isDisputed = project.status?.toUpperCase() === "DISPUTED" || project.hasActiveDispute;
  const activeDisputeCount = project.activeDisputeCount || 0;

  return (
    <div
      className={cn(
        "relative bg-white rounded-xl shadow-sm transition-all duration-200 overflow-hidden",
        "hover:shadow-md hover:-translate-y-0.5",
        // Dispute styling - Red border and subtle red background
        isDisputed
          ? "border-2 border-red-400 ring-2 ring-red-100"
          : "border border-gray-200"
      )}
    >
      {/* Dispute Alert Banner */}
      {isDisputed && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
          <span className="text-sm font-medium text-red-700">
            🚨 Dispute Active
            {activeDisputeCount > 0 && (
              <span className="ml-1 text-red-600">
                ({activeDisputeCount} {activeDisputeCount === 1 ? "issue" : "issues"})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Card Content */}
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {project.title}
            </h2>
            {project.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                {project.description}
              </p>
            )}
          </div>
          
          {/* Status Badge */}
          <span
            className={cn(
              "flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border",
              getStatusBadgeStyle(project.status)
            )}
          >
            {formatStatus(project.status)}
          </span>
        </div>

        {/* Meta Info */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {/* Role Badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-100">
            <User className="h-3 w-3" />
            {userRole}
          </span>
          
          {/* Budget Badge */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            <DollarSign className="h-3 w-3" />
            {Number(project.totalBudget || 0).toLocaleString()} VND
          </span>
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onNavigate}
            disabled={isDisputed}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isDisputed
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-teal-600 text-white hover:bg-teal-700"
            )}
          >
            {isDisputed ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                Workspace Locked
              </>
            ) : (
              <>
                View Workspace
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          
          {/* Dispute Help Text */}
          {isDisputed && (
            <p className="mt-2 text-xs text-center text-red-600">
              Project workspace is locked during dispute resolution
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
