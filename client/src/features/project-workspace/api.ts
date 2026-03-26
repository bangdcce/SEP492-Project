import { apiClient } from "@/shared/api/client";
import type {
  KanbanBoard,
  KanbanColumnKey,
  Task,
  Milestone,
  TaskLink,
  TaskSubmission,
  TaskStatusUpdateResult,
  PendingProjectInvite,
  ActiveSupervisedProject,
  ProjectStaffInviteStatus,
  StaffRecommendation,
  StaffSummary,
  ProjectRecentActivity,
  WorkspaceChatHistoryQuery,
  WorkspaceChatHistoryResponse,
  WorkspaceChatMutationResponse,
} from "./types";

// ============================================
// REAL API - Database Integration
// ============================================

// Response type from backend /tasks/board/:projectId
interface BoardWithMilestones {
  tasks: KanbanBoard;
  milestones: Milestone[];
}

const toIsoDateString = (value?: string | null) => {
  if (value === null) return null;
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`).toISOString()
    : value;
};

export interface WorkspaceProject {
  id: string;
  title?: string;
  status?: string;
  hasActiveDispute?: boolean;
  activeDisputeCount?: number;
  contracts?: { id: string; status: string; activatedAt?: string | null; createdAt?: string }[];
  brokerId: string;
  clientId: string;
  freelancerId?: string | null;
  staffId?: string | null;
  staffInviteStatus?: ProjectStaffInviteStatus | null;
  client?: WorkspaceProjectParticipant | null;
  broker?: WorkspaceProjectParticipant | null;
  freelancer?: WorkspaceProjectParticipant | null;
  staff?: WorkspaceProjectParticipant | null;
  currency?: string;
}

export interface WorkspaceProjectParticipant {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
}

export const fetchProject = async (projectId: string): Promise<WorkspaceProject> => {
  return apiClient.get<WorkspaceProject>(`/projects/${projectId}`);
};

export const fetchWorkspaceChatMessages = async (
  projectId: string,
  query: WorkspaceChatHistoryQuery = {},
): Promise<WorkspaceChatHistoryResponse> => {
  const searchParams = new URLSearchParams();

  if (typeof query.limit === "number") {
    searchParams.set("limit", String(query.limit));
  }
  if (typeof query.offset === "number") {
    searchParams.set("offset", String(query.offset));
  }
  if (typeof query.query === "string" && query.query.trim().length > 0) {
    searchParams.set("query", query.query.trim());
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return apiClient.get<WorkspaceChatHistoryResponse>(
    `/workspace-chat/projects/${projectId}/messages${suffix}`,
  );
};

export const toggleWorkspaceChatPin = async (
  projectId: string,
  messageId: string,
  isPinned: boolean,
): Promise<WorkspaceChatMutationResponse> => {
  return apiClient.patch<WorkspaceChatMutationResponse>(
    `/workspace-chat/projects/${projectId}/messages/${messageId}/pin`,
    { isPinned },
  );
};

export const editWorkspaceChatMessage = async (
  projectId: string,
  messageId: string,
  content: string,
): Promise<WorkspaceChatMutationResponse> => {
  return apiClient.patch<WorkspaceChatMutationResponse>(
    `/workspace-chat/projects/${projectId}/messages/${messageId}`,
    { content },
  );
};

export const deleteWorkspaceChatMessage = async (
  projectId: string,
  messageId: string,
): Promise<WorkspaceChatMutationResponse> => {
  return apiClient.delete<WorkspaceChatMutationResponse>(
    `/workspace-chat/projects/${projectId}/messages/${messageId}`,
  );
};

export const fetchStaffCandidates = async (): Promise<StaffSummary[]> => {
  return apiClient.get<StaffSummary[]>("/projects/staff-candidates");
};

export const inviteProjectStaff = async (
  projectId: string,
  staffId: string,
): Promise<WorkspaceProject> => {
  return apiClient.post<WorkspaceProject>(`/projects/${projectId}/invite-staff`, { staffId });
};

export const fetchPendingProjectInvites = async (): Promise<PendingProjectInvite[]> => {
  return apiClient.get<PendingProjectInvite[]>("/projects/pending-invites");
};

export const getActiveSupervisedProjects = async (): Promise<ActiveSupervisedProject[]> => {
  return apiClient.get<ActiveSupervisedProject[]>("/projects/staff/active");
};

export const respondToProjectStaffInvite = async (
  projectId: string,
  status: ProjectStaffInviteStatus,
): Promise<WorkspaceProject> => {
  return apiClient.post<WorkspaceProject>(`/projects/${projectId}/staff-response`, { status });
};

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

export const fetchTaskHistory = async (taskId: string): Promise<import("./types").TaskHistory[]> => {
  const result = await apiClient.get<import("./types").TaskHistory[]>(`/tasks/${taskId}/history`);
  return result;
};

export const fetchProjectRecentActivity = async (
  projectId: string,
): Promise<ProjectRecentActivity[]> => {
  return apiClient.get<ProjectRecentActivity[]>(
    `/tasks/project/${projectId}/recent-activity`,
  );
};

export const fetchTaskComments = async (taskId: string): Promise<import("./types").TaskComment[]> => {
  return apiClient.get<import("./types").TaskComment[]>(`/tasks/${taskId}/comments`);
};

export const createComment = async (taskId: string, content: string): Promise<import("./types").TaskComment> => {
  return apiClient.post<import("./types").TaskComment>(`/tasks/${taskId}/comments`, { content });
};

export const fetchTaskLinks = async (taskId: string): Promise<TaskLink[]> => {
  return apiClient.get<TaskLink[]>(`/tasks/${taskId}/links`);
};

export const createTaskLink = async (
  taskId: string,
  payload: { url: string; title?: string }
): Promise<TaskLink> => {
  return apiClient.post<TaskLink>(`/tasks/${taskId}/links`, payload);
};

export const deleteTaskLink = async (
  taskId: string,
  linkId: string
): Promise<{ success: boolean }> => {
  return apiClient.delete<{ success: boolean }>(`/tasks/${taskId}/links/${linkId}`);
};

export const fetchSubtasks = async (taskId: string): Promise<Task[]> => {
  return apiClient.get<Task[]>(`/tasks/${taskId}/subtasks`);
};

export const createSubtask = async (
  taskId: string,
  payload: {
    title: string;
    description?: string;
    priority?: Task["priority"];
    assignedTo?: string;
    dueDate?: string;
  }
): Promise<Task> => {
  return apiClient.post<Task>(`/tasks/${taskId}/subtasks`, payload);
};

export const linkSubtask = async (
  taskId: string,
  subtaskId: string
): Promise<Task> => {
  return apiClient.post<Task>(`/tasks/${taskId}/subtasks/link`, { subtaskId });
};

export const fetchTaskSubmissions = async (taskId: string): Promise<TaskSubmission[]> => {
  return apiClient.get<TaskSubmission[]>(`/tasks/${taskId}/submissions`);
};

export const createTaskSubmission = async (
  taskId: string,
  payload: { content: string; attachments?: string[] }
): Promise<TaskSubmission> => {
  return apiClient.post<TaskSubmission>(`/tasks/${taskId}/submissions`, payload);
};

/**
 * Review a task submission (Approve or Request Changes)
 * Only CLIENT or STAFF users can call this endpoint
 * 
 * @param taskId - Task ID
 * @param submissionId - Submission ID to review
 * @param payload - Review data with status and optional reviewNote
 */
export const reviewSubmission = async (
  taskId: string,
  submissionId: string,
  payload: { 
    status: 'APPROVED' | 'REQUEST_CHANGES'; 
    reviewNote?: string 
  }
): Promise<{
  submission: TaskSubmission;
  task: Task;
  milestoneId: string;
  milestoneProgress: number;
  totalTasks: number;
  completedTasks: number;
}> => {
  console.log("[API] Reviewing submission:", { taskId, submissionId, status: payload.status });

  const result = await apiClient.patch<{
    submission: TaskSubmission;
    task: Task;
    milestoneId: string;
    milestoneProgress: number;
    totalTasks: number;
    completedTasks: number;
  }>(`/tasks/${taskId}/submissions/${submissionId}/review`, payload);

  console.log("[API] Submission reviewed:", result);
  return result;
};

// Update General Task Details
export const updateTask = async (
  taskId: string,
  payload: Partial<Task>
): Promise<Task> => {
  console.log("[API] Updating task details:", { taskId, payload });

  const result = await apiClient.patch<Task>(`/tasks/${taskId}`, {
    ...payload,
    ...(Object.prototype.hasOwnProperty.call(payload, "startDate")
      ? { startDate: toIsoDateString(payload.startDate ?? null) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, "dueDate")
      ? { dueDate: toIsoDateString(payload.dueDate ?? null) }
      : {}),
  });

  console.log("[API] Task updated:", result);
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

  const result = await apiClient.post<Task>("/tasks", {
    ...payload,
    startDate: toIsoDateString(payload.startDate),
    dueDate: toIsoDateString(payload.dueDate),
  });

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
  deliverableType?: Milestone["deliverableType"];
  retentionAmount?: number;
  acceptanceCriteria?: string[];
}): Promise<Milestone> => {
  console.log("[API] Creating milestone:", payload);
  const { projectId, ...body } = payload;
  const result = await apiClient.post<Milestone>(
    `/projects/${projectId}/milestones`,
    {
      ...body,
      startDate: toIsoDateString(body.startDate),
      dueDate: toIsoDateString(body.dueDate),
    }
  );

  console.log("[API] Milestone created:", result);
  return result;
};

export const updateMilestone = async (
  milestoneId: string,
  payload: Partial<
    Pick<
      Milestone,
      | "title"
      | "description"
      | "amount"
      | "startDate"
      | "dueDate"
      | "sortOrder"
      | "deliverableType"
      | "retentionAmount"
      | "acceptanceCriteria"
    >
  >
): Promise<Milestone> => {
  return apiClient.patch<Milestone>(`/projects/milestones/${milestoneId}`, {
    ...payload,
    startDate: toIsoDateString(payload.startDate),
    dueDate: toIsoDateString(payload.dueDate),
  });
};

export const deleteMilestone = async (
  milestoneId: string
): Promise<{ success: boolean }> => {
  return apiClient.delete<{ success: boolean }>(`/projects/milestones/${milestoneId}`);
};

export const requestMilestoneReview = async (milestoneId: string): Promise<Milestone> => {
  return apiClient.post<Milestone>(`/projects/milestones/${milestoneId}/request-review`);
};

export const reviewMilestoneAsStaff = async (
  milestoneId: string,
  payload: { recommendation: StaffRecommendation; note: string },
): Promise<Milestone> => {
  return apiClient.post<Milestone>(`/projects/milestones/${milestoneId}/staff-review`, payload);
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
