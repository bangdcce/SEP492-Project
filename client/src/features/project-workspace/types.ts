export type KanbanColumnKey = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export type Assignee = {
  id?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: KanbanColumnKey;
  milestoneId?: string;
  assignedTo?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  specFeatureId?: string | null; // Links task to spec feature (anti-scope creep)
  assignee?: Assignee | null;
  
  // Jira-style fields
  priority: TaskPriority;
  storyPoints?: number | null;
  labels?: string[] | null;
  reporterId?: string | null;
  reporter?: Assignee | null;

  // Proof of Work fields (for task submission / dispute resolution)
  submissionNote?: string | null;
  proofLink?: string | null;
  submittedAt?: string | null;
};

export type Milestone = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  amount: number;
  startDate?: string;
  dueDate?: string;
  status: string;
  sortOrder?: number | null;
  createdAt: string;
  // Progress fields (optional - calculated from tasks)
  progress?: number; // 0-100 percentage
  totalTasks?: number;
  completedTasks?: number;
};

export type KanbanBoard = Record<KanbanColumnKey, Task[]>;

/**
 * Response from PATCH /tasks/:id/status
 * Includes updated task AND milestone progress for real-time UI updates
 */
export type TaskStatusUpdateResult = {
  task: Task;
  milestoneId: string;
  milestoneProgress: number; // 0-100 percentage
  totalTasks: number;
  completedTasks: number;
};

export type TaskHistory = {
  id: string;
  taskId: string;
  actorId?: string;
  actor?: {
    id: string;
    fullName: string;
    avatarUrl?: string; // Optional if you have it
  };
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  actorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  actor?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
};
