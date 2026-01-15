import { apiClient } from "@/shared/api/client";
import type { KanbanBoard, KanbanColumnKey, Task, Milestone } from "./types";

// ============================================
// REAL API - Database Integration
// ============================================

// Response type from backend /tasks/board/:projectId
interface BoardWithMilestones {
  tasks: KanbanBoard;
  milestones: Milestone[];
}

export const fetchBoard = async (projectId: string): Promise<KanbanBoard> => {
  console.log("[API] Fetching board for project:", projectId);

  const response = await apiClient.get<BoardWithMilestones>(
    `/tasks/board/${projectId}`
  );

  console.log("[API] Board data:", response.tasks);
  return response.tasks;
};

export const updateTaskStatus = async (
  taskId: string,
  status: KanbanColumnKey
): Promise<Task> => {
  console.log("[API] Updating task status:", { taskId, status });

  const result = await apiClient.patch<Task>(`/tasks/${taskId}/status`, {
    status,
  });

  console.log("[API] Task updated:", result);
  return result;
};

export const createTask = async (payload: {
  title: string;
  description?: string;
  projectId: string;
  milestoneId: string;
}): Promise<Task> => {
  console.log("[API] Creating task:", payload);

  const result = await apiClient.post<Task>("/tasks", payload);

  console.log("[API] Task created:", result);
  return result;
};

export const fetchMilestones = async (
  projectId: string
): Promise<Milestone[]> => {
  console.log("[API] Fetching milestones for project:", projectId);

  // We use the same endpoint as fetchBoard to get milestones
  // This avoids creating a separate MilestonesController
  const response = await apiClient.get<BoardWithMilestones>(
    `/tasks/board/${projectId}`
  );

  console.log("[API] Milestones:", response.milestones);
  return response.milestones;
};

export const createMilestone = async (payload: {
  projectId: string;
  title: string;
  amount?: number;
  startDate?: string;
  dueDate?: string;
  description?: string;
}): Promise<Milestone> => {
  console.log("[API] Creating milestone:", payload);

  // Note: This endpoint may need to be implemented separately
  // For now, we'll make the call to /milestones if available
  const result = await apiClient.post<Milestone>("/milestones", payload);

  console.log("[API] Milestone created:", result);
  return result;
};
