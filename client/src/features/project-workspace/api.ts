import { apiClient } from "@/shared/api/client";
import type { KanbanBoard, KanbanColumnKey, Task, Milestone, TaskStatusUpdateResult } from "./types";

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
): Promise<TaskStatusUpdateResult> => {
  console.log("[API] Updating task status:", { taskId, status });

  const result = await apiClient.patch<TaskStatusUpdateResult>(`/tasks/${taskId}/status`, {
    status,
  });

  console.log("[API] Task updated:", result);
  console.log("[API] Milestone progress:", {
    milestoneId: result.milestoneId,
    progress: result.milestoneProgress,
    completed: `${result.completedTasks}/${result.totalTasks}`,
  });

  return result;
};

/**
 * Submit task with proof of work
 * Marks task as DONE with evidence (required for dispute resolution)
 */
export const submitTask = async (
  taskId: string,
  payload: { submissionNote?: string; proofLink: string }
): Promise<TaskStatusUpdateResult> => {
  console.log("[API] Submitting task with proof:", { taskId, proofLink: payload.proofLink });

  const result = await apiClient.post<TaskStatusUpdateResult>(`/tasks/${taskId}/submit`, payload);

  console.log("[API] Task submitted:", result);
  console.log("[API] Milestone progress after submission:", {
    milestoneId: result.milestoneId,
    progress: result.milestoneProgress,
    completed: `${result.completedTasks}/${result.totalTasks}`,
  });

  return result;
};

export const createTask = async (payload: {
  title: string;
  description?: string;
  projectId: string;
  milestoneId: string;
  specFeatureId?: string;
  startDate?: string;
  dueDate?: string;
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

/**
 * Response from POST /milestones/:id/approve
 */
export interface MilestoneApprovalResult {
  milestone: Milestone;
  previousStatus: string;
  fundsReleased: boolean;
  message: string;
}

/**
 * Approve a milestone and release funds
 * Only Client or Broker can call this
 * Endpoint: POST /projects/milestones/:id/approve
 */
export const approveMilestone = async (
  milestoneId: string,
  feedback?: string
): Promise<MilestoneApprovalResult> => {
  console.log("[API] Approving milestone:", { milestoneId, feedback });

  const result = await apiClient.post<MilestoneApprovalResult>(
    `/projects/milestones/${milestoneId}/approve`,
    { feedback }
  );

  console.log("[API] Milestone approved:", result);
  return result;
};

/**
 * Dispute category enum (matches backend DisputeCategory)
 */
export type DisputeCategory =
  | "QUALITY"
  | "DEADLINE"
  | "COMMUNICATION"
  | "SCOPE_CHANGE"
  | "PAYMENT";

/**
 * Payload for creating a dispute
 */
export interface CreateDisputePayload {
  projectId: string;
  milestoneId: string;
  defendantId: string; // Freelancer ID
  reason: string;
  evidence: string[];
  category?: DisputeCategory;
  disputedAmount?: number;
}

/**
 * Response from dispute creation
 */
export interface DisputeResponse {
  id: string;
  status: string;
  createdAt: string;
  reason: string;
  category?: DisputeCategory;
  milestoneId: string;
  projectId: string;
}

/**
 * Create a dispute for a milestone
 * Endpoint: POST /disputes
 */
export const createDispute = async (
  payload: CreateDisputePayload
): Promise<DisputeResponse> => {
  console.log("[API] Creating dispute:", payload);

  const result = await apiClient.post<DisputeResponse>("/disputes", payload);

  console.log("[API] Dispute created:", result);
  return result;
};
