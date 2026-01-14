// import { apiClient } from "@/shared/api/client";
import type { KanbanBoard, KanbanColumnKey, Task, Milestone } from "./types";

// ============================================
// MOCK DATA API - For Demo Purposes
// ============================================

// Mock data store (in-memory)
const mockTasks: Task[] = [
  {
    id: "t1",
    title: "Setup Project Repository",
    description: "Initialize Git repo and project structure",
    status: "TODO",
    milestoneId: "mock-m1",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(), // 2 days from now
    assignedTo: null,
    assignee: null,
  },
  {
    id: "t2",
    title: "Design UI Mockups",
    description: "Create Figma designs for main pages",
    status: "DONE",
    milestoneId: "mock-m1",
    dueDate: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
    assignedTo: null,
    assignee: null,
  },
  {
    id: "t3",
    title: "Implement Frontend Components",
    description: "Build React components for dashboard",
    status: "IN_PROGRESS",
    milestoneId: "mock-m2",
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), // 5 days from now
    assignedTo: null,
    assignee: null,
  },
  {
    id: "t4",
    title: "Setup Backend API",
    description: "Configure NestJS backend with database",
    status: "IN_PROGRESS",
    milestoneId: "mock-m2",
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 days from now
    assignedTo: null,
    assignee: null,
  },
  {
    id: "t5",
    title: "Write API Documentation",
    description: "Document all endpoints with Swagger",
    status: "TODO",
    milestoneId: "mock-m2",
    dueDate: new Date(Date.now() + 10 * 86400000).toISOString(), // 10 days from now
    assignedTo: null,
    assignee: null,
  },
];

const mockMilestones: Milestone[] = [];

// Helper to get mock milestones for a project
const getMockMilestonesForProject = (projectId: string): Milestone[] => {
  return [
    {
      id: "mock-m1",
      projectId,
      title: "Phase 1: Design & Planning (Demo)",
      description: "Complete all design and planning tasks",
      amount: 5000000,
      status: "COMPLETED",
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), // 30 days ago
      sortOrder: 1,
    },
    {
      id: "mock-m2",
      projectId,
      title: "Phase 2: Development (Demo)",
      description: "Build core features and functionality",
      amount: 15000000,
      status: "IN_PROGRESS",
      createdAt: new Date(Date.now() - 15 * 86400000).toISOString(), // 15 days ago
      sortOrder: 2,
    },
    {
      id: "mock-m3",
      projectId,
      title: "Phase 3: Testing & Deployment (Demo)",
      description: "QA testing and production deployment",
      amount: 8000000,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      sortOrder: 3,
    },
  ];
};

export const fetchBoard = async (projectId: string): Promise<KanbanBoard> => {
  console.log("[Mock API] Fetching board for project:", projectId);

  // Real API call (commented out for mock):
  // return apiClient.get<KanbanBoard>(`/tasks/board/${projectId}`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Group tasks by status
  const board: KanbanBoard = {
    TODO: mockTasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: mockTasks.filter((t) => t.status === "IN_PROGRESS"),
    DONE: mockTasks.filter((t) => t.status === "DONE"),
  };

  console.log("[Mock API] Board data:", board);
  return board;
};

export const updateTaskStatus = async (
  taskId: string,
  status: KanbanColumnKey
): Promise<Task> => {
  console.log("[Mock API] Updating task status:", { taskId, status });

  // Real API call (commented out for mock):
  // return apiClient.patch<Task>(`/tasks/${taskId}/status`, { status });

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Update mock task
  const task = mockTasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error("Task not found");
  }

  task.status = status;
  console.log("[Mock API] Task updated:", task);
  return { ...task };
};

export const createTask = async (payload: {
  title: string;
  description?: string;
  projectId: string;
  milestoneId: string;
}): Promise<Task> => {
  console.log("[Mock API] Creating task:", payload);

  // Real API call (commented out for mock):
  // return apiClient.post<Task>("/tasks", payload);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Create new mock task
  const newTask: Task = {
    id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: payload.title,
    description: payload.description || "",
    status: "TODO",
    milestoneId: payload.milestoneId,
    dueDate: null,
    assignedTo: null,
    assignee: null,
  };

  mockTasks.push(newTask);
  console.log("[Mock API] Task created:", newTask);
  return { ...newTask };
};

export const fetchMilestones = async (
  projectId: string
): Promise<Milestone[]> => {
  console.log("[Mock API] Fetching milestones for project:", projectId);

  // Real API call (commented out for mock):
  // return apiClient.get<Milestone[]>(`/milestones/project/${projectId}`);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const milestones = getMockMilestonesForProject(projectId);
  console.log("[Mock API] Milestones:", milestones);
  return milestones;
};

export const createMilestone = async (payload: {
  projectId: string;
  title: string;
  amount?: number;
  startDate?: string;
  dueDate?: string;
  description?: string;
}): Promise<Milestone> => {
  console.log("[Mock API] Creating milestone:", payload);

  // Real API call (commented out for mock):
  // return apiClient.post<Milestone>("/milestones", payload);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Create new mock milestone
  const newMilestone: Milestone = {
    id: `mock-m-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: payload.projectId,
    title: payload.title,
    description: payload.description || "",
    amount: payload.amount || 0,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    sortOrder: null,
    startDate: payload.startDate,
    dueDate: payload.dueDate,
  };

  mockMilestones.push(newMilestone);
  console.log("[Mock API] Milestone created:", newMilestone);
  return { ...newMilestone };
};
