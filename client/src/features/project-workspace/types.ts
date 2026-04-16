import type { DeliverableType } from "@/features/project-specs/types";
import type { MilestoneEscrowSummary } from "@/features/payments/types";
import type { DisputeCategory } from "@/features/staff/types/staff.types";

export type KanbanColumnKey = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export type Assignee = {
  id?: string;
  fullName?: string;
  email?: string;
  avatarUrl?: string;
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskAttachment = {
  id: string;
  taskId: string;
  uploaderId: string;
  url: string;
  fileName: string;
  fileType: string;
  createdAt: string;
};

export type TaskLink = {
  id: string;
  taskId: string;
  url: string;
  title?: string | null;
  createdAt: string;
};

export type TaskSubmissionStatus =
  | "PENDING"
  | "PENDING_CLIENT_REVIEW"
  | "APPROVED"
  | "AUTO_APPROVED"
  | "REJECTED"
  | "REQUEST_CHANGES";

export type ProjectStaffInviteStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type StaffRecommendation = "ACCEPT" | "REJECT";

export type StaffSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type PendingProjectInvite = {
  id: string;
  title: string;
  description?: string | null;
  clientId: string;
  clientName?: string | null;
  createdAt: string;
  staffInviteStatus?: ProjectStaffInviteStatus | null;
};

export type ActiveSupervisedProject = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  totalBudget: number;
  currency: string;
  clientId: string;
  clientName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceChatMentionRole = "CLIENT" | "BROKER" | "FREELANCER";

export type WorkspaceChatSender = {
  id: string;
  fullName: string;
  role: string | null;
};

export type WorkspaceChatAttachment = {
  url: string;
  name: string;
  type: string;
};

export type WorkspaceChatEditHistoryEntry = {
  content: string;
  editedAt: string;
  editorId: string | null;
};

export type WorkspaceChatMessageType = "USER" | "SYSTEM";

export type WorkspaceChatMentionMember = {
  id: string;
  fullName: string;
  role: WorkspaceChatMentionRole;
};

export type WorkspaceChatReplySummary = {
  id: string;
  messageType: WorkspaceChatMessageType;
  content: string;
  attachments: WorkspaceChatAttachment[];
  isDeleted: boolean;
  createdAt: string;
  sender: WorkspaceChatSender | null;
};

export type WorkspaceChatMessage = {
  id: string;
  projectId: string;
  senderId: string | null;
  taskId: string | null;
  replyToId: string | null;
  messageType: WorkspaceChatMessageType;
  content: string;
  attachments: WorkspaceChatAttachment[];
  isPinned: boolean;
  isEdited: boolean;
  editHistory: WorkspaceChatEditHistoryEntry[];
  isDeleted: boolean;
  riskFlags: string[];
  createdAt: string;
  updatedAt: string;
  sender: WorkspaceChatSender | null;
  replyTo: WorkspaceChatReplySummary | null;
};

export type WorkspaceChatHistoryQuery = {
  limit?: number;
  offset?: number;
  query?: string;
};

export type WorkspaceChatHistoryResponse = {
  success: boolean;
  data: WorkspaceChatMessage[];
  pagination?: {
    limit: number;
    offset: number;
    count: number;
  };
};

export type WorkspaceChatMutationResponse = {
  success: boolean;
  data: WorkspaceChatMessage;
};

export type WorkspaceChatExportEmailResponse = {
  success: boolean;
  message: string;
  data: {
    recipientEmail: string;
    fileName: string;
  };
};

export type TaskSubmission = {
  id: string;
  taskId: string;
  submitterId?: string | null;
  submitter?: Assignee | null;
  content: string;
  attachments?: string[];
  version: number;
  status: TaskSubmissionStatus;
  createdAt: string;
  // Review fields (populated when reviewed by Client)
  reviewNote?: string | null;
  reviewerId?: string | null;
  reviewer?: Assignee | null;
  reviewedAt?: string | null;
  brokerReviewNote?: string | null;
  brokerReviewerId?: string | null;
  brokerReviewer?: Assignee | null;
  brokerReviewedAt?: string | null;
  clientReviewNote?: string | null;
  clientReviewerId?: string | null;
  clientReviewer?: Assignee | null;
  clientReviewedAt?: string | null;
  clientReviewDueAt?: string | null;
  autoApprovedAt?: string | null;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: KanbanColumnKey;
  projectId?: string;
  milestoneId?: string;
  assignedTo?: string | null;
  parentTaskId?: string | null;
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

  // Legacy completion metadata kept for dispute and overview surfaces.
  submissionNote?: string | null;
  proofLink?: string | null;
  submittedAt?: string | null;
  attachments?: TaskAttachment[];
  links?: TaskLink[];
  subtasks?: Task[];
  submissions?: TaskSubmission[];
};

export type Milestone = {
  id: string;
  projectId: string;
  projectSpecId?: string | null;
  sourceContractMilestoneKey?: string | null;
  title: string;
  description?: string;
  amount: number;
  startDate?: string;
  dueDate?: string;
  deliverableType?: DeliverableType | null;
  retentionAmount?: number | null;
  acceptanceCriteria?: string[] | null;
  status: string;
  sortOrder?: number | null;
  createdAt: string;
  submittedAt?: string | null;
  reviewedByStaffId?: string | null;
  staffRecommendation?: StaffRecommendation | null;
  staffReviewNote?: string | null;
  // Progress fields (optional - calculated from tasks)
  progress?: number; // 0-100 percentage
  totalTasks?: number;
  completedTasks?: number;
  escrow?: MilestoneEscrowSummary | null;
  disputePolicy?: MilestoneDisputePolicy | null;
};

export type MilestoneDisputePhase =
  | "PRE_DELIVERY"
  | "REVIEW"
  | "POST_DELIVERY"
  | "CLOSED";

export type MilestoneDisputePolicy = {
  canRaise: boolean;
  phase: MilestoneDisputePhase;
  allowedCategories: DisputeCategory[];
  blockedCategories: Partial<Record<DisputeCategory, string>>;
  reason: string | null;
  warrantyEndsAt: string | null;
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

export type ProjectTaskRealtimeEvent = {
  action: "CREATED" | "UPDATED" | "DELETED";
  projectId: string;
  task?: Task | null;
  taskId?: string;
  milestoneId?: string | null;
  milestoneProgress?: number;
  totalTasks?: number;
  completedTasks?: number;
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

export type ProjectRecentActivity = TaskHistory & {
  task: Pick<Task, "id" | "title" | "status">;
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

export type TaskCommentMutationResult = {
  comment: TaskComment;
  task?: Task | null;
};
