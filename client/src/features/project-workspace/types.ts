export type KanbanColumnKey = "TODO" | "IN_PROGRESS" | "DONE";

export type Assignee = {
  id?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: KanbanColumnKey;
  milestoneId?: string;
  assignedTo?: string | null;
  dueDate?: string | null;
  assignee?: Assignee | null;
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
};

export type KanbanBoard = Record<KanbanColumnKey, Task[]>;
