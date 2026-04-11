import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  X,
  Layers,
  User,
  Link2,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  ChevronDown,
  Plus,
  Flag,
  AlertTriangle,
  Circle,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import RichTextEditor from "../editor/RichTextEditor";
import AttachmentGallery from "./AttachmentGallery";
import { WorkspaceDatePicker } from "../shared/WorkspaceDatePicker";
import "highlight.js/styles/github.css";
import type {
  Task,
  TaskComment,
  TaskHistory,
  TaskLink,
  TaskPriority,
  TaskSubmission,
  TaskSubmissionStatus,
  KanbanColumnKey,
} from "../../types";
import type { SpecFeatureOption } from "./CreateTaskModal";
import {
  updateTask,
  updateTaskStatus,
  fetchTaskHistory,
  fetchTaskLinks,
  createTaskLink,
  deleteTaskLink,
  fetchSubtasks,
  createSubtask,
  linkSubtask,
  fetchTaskSubmissions,
  createTaskSubmission,
  reviewSubmission,
} from "../../api";
import {
  getLatestApprovedSubmission,
  getSubmissionEvidenceUrl,
  getSubmissionPreviewText,
} from "../../utils";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { toast } from "sonner";

// Helper for robust date parsing (force UTC if naked ISO)
const normalizeToUTC = (d: string | Date | undefined): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  const s = String(d);
  // Simpler, more aggressive check: if no Z and no +, assume it's a naked UTC string
  const safeDate = s.endsWith('Z') || s.includes('+') ? s : s + 'Z';
  return new Date(safeDate);
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type TaskDetailModalProps = {
  isOpen: boolean;
  task: Task | null;
  specFeatures?: SpecFeatureOption[];
  canReviewSubmissions?: boolean;
  canActAsBrokerReviewer?: boolean;
  canActAsClientReviewer?: boolean;
  allowTaskMutations?: boolean;
  taskMutationLockReason?: string | null;
  allowTaskStatusEditing?: boolean;
  onClose: () => void;
  onUpdate?: (updatedTask: Task) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: string }> = {
  LOW: { color: "text-blue-500", icon: "Low" },
  MEDIUM: { color: "text-amber-500", icon: "Medium" },
  HIGH: { color: "text-orange-500", icon: "High" },
  URGENT: { color: "text-red-500", icon: "Urgent" },
};

const STATUS_OPTIONS: { value: KanbanColumnKey; label: string; color: string }[] = [
  { value: "TODO", label: "To Do", color: "bg-slate-100 text-slate-700" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "IN_REVIEW", label: "In Review", color: "bg-amber-100 text-amber-700" },
  { value: "DONE", label: "Done", color: "bg-emerald-100 text-emerald-700" },
];

const SUBTASK_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) =>
  ["TODO", "IN_PROGRESS", "DONE"].includes(option.value)
);

const SUBMISSION_STATUS_CONFIG: Record<
  TaskSubmissionStatus,
  { label: string; color: string }
> = {
  PENDING: { label: "Waiting for broker review", color: "bg-amber-100 text-amber-700" },
  PENDING_CLIENT_REVIEW: {
    label: "Waiting for client review",
    color: "bg-blue-100 text-blue-700",
  },
  APPROVED: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
  AUTO_APPROVED: { label: "Auto-approved", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
  REQUEST_CHANGES: { label: "Request changes", color: "bg-purple-100 text-purple-700" },
};

const mergeTaskSnapshot = (currentTask: Task, incomingTask: Partial<Task>): Task => ({
  ...currentTask,
  ...incomingTask,
  attachments: incomingTask.attachments ?? currentTask.attachments,
  submissions: incomingTask.submissions ?? currentTask.submissions,
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
      {title}
    </h3>
  );
}

function EditableText({
  value,
  onSave,
  className,
  placeholder = "Click to edit...",
  multiline = false,
  disabled = false,
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (disabled) {
      setIsEditing(false);
    }
  }, [disabled]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onSave(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      handleBlur();
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className={cn(
            "w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-2 bg-white min-h-[100px]",
            className
          )}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        autoFocus
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm p-1 bg-white",
          className
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => {
        if (!disabled) {
          setIsEditing(true);
        }
      }}
      className={cn(
        disabled
          ? "rounded px-1 -ml-1 min-h-[24px] text-gray-700"
          : "cursor-text hover:bg-gray-100 rounded px-1 -ml-1 transition-colors min-h-[24px] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
        className
      )}
      data-placeholder={placeholder}
    >
      {value}
    </div>
  );
}


// Helper for "All" tab sorting
type TimelineItem =
  | { type: "history"; data: TaskHistory; date: Date }
  | { type: "comment"; data: TaskComment; date: Date };

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TaskDetailModal({
  isOpen,
  task: initialTask,
  specFeatures = [],
  canReviewSubmissions = false,
  canActAsBrokerReviewer,
  canActAsClientReviewer,
  allowTaskMutations = true,
  taskMutationLockReason = null,
  allowTaskStatusEditing = false,
  onClose,
  onUpdate,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(initialTask);
  const [activeTab, setActiveTab] = useState<"all" | "comments" | "history">("all");

  // History State
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(null);
  const [commentPendingDelete, setCommentPendingDelete] = useState<TaskComment | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);

  // Web Links State
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ url: "", title: "" });
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);

  // Subtasks State
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isLoadingSubtasks, setIsLoadingSubtasks] = useState(false);
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);
  const [isCreateSubtaskOpen, setIsCreateSubtaskOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<TaskPriority>("MEDIUM");
  const [linkExistingSubtaskId, setLinkExistingSubtaskId] = useState("");
  const [isLinkExistingOpen, setIsLinkExistingOpen] = useState(false);
  const [isLinkingSubtask, setIsLinkingSubtask] = useState(false);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null);

  // Submission History State
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isSubmittingSubmission, setIsSubmittingSubmission] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});

  // Review State
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [isReviewNotePopoverOpen, setIsReviewNotePopoverOpen] = useState(false);
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [approveDialogSubmission, setApproveDialogSubmission] =
    useState<TaskSubmission | null>(null);

  // Get current user for role-based UI
  const currentUser = getStoredJson<{ id: string; role?: string }>(STORAGE_KEYS.USER);
  const currentUserId = currentUser?.id ?? null;
  const currentUserRole = currentUser?.role?.toUpperCase();
  const canBrokerReview =
    canActAsBrokerReviewer ?? currentUserRole === "BROKER";
  const canClientReview =
    canActAsClientReviewer ?? currentUserRole === "CLIENT";
  const canReview = Boolean(
    canReviewSubmissions && (canBrokerReview || canClientReview),
  );
  const isFreelancer = currentUserRole === "FREELANCER";
  const isInteractionLocked = !allowTaskMutations;
  const canManageSubtasks = allowTaskMutations && !isFreelancer;
  const subtaskPermissionMessage = isFreelancer
    ? "Freelancers cannot create or link subtasks."
    : taskMutationLockReason || "Task changes are locked for this milestone.";

  useEffect(() => {
    setTask(initialTask);
    setApproveDialogSubmission(null);
    setIsLabelPopoverOpen(false);
    setLabelDraft("");
    setEditingCommentId(null);
    setUpdatingCommentId(null);
    setCommentPendingDelete(null);
    setDeletingCommentId(null);
    setSubmissionError(null);
    setSubmissions(initialTask?.submissions ?? []);

    if (!initialTask?.id) {
      setSubtasks([]);
      return;
    }

    setIsLoadingSubtasks(true);
    fetchSubtasks(initialTask.id)
      .then(setSubtasks)
      .catch((error) => {
        console.error("Failed to load subtasks:", error);
      })
      .finally(() => setIsLoadingSubtasks(false));

    setIsLoadingSubmissions(true);
    fetchTaskSubmissions(initialTask.id)
      .then(setSubmissions)
      .catch((error) => {
        console.error("Failed to load submissions:", error);
      })
      .finally(() => setIsLoadingSubmissions(false));
  }, [initialTask]);

  useEffect(() => {
    if (task?.priority) {
      setNewSubtaskPriority(task.priority);
    }
  }, [task?.id, task?.priority]);

  useEffect(() => {
    setVisibleHistoryCount(5);
  }, [task?.id, activeTab]);

  // Load History & Comments when tab changes
  useEffect(() => {
    const taskId = task?.id;
    if (!taskId) {
      return;
    }

    if (activeTab === "history" || activeTab === "all") {
      setLoadingHistory(true);
      fetchTaskHistory(taskId)
        .then(setHistory)
        .catch(console.error)
        .finally(() => setLoadingHistory(false));
    }

    if (activeTab === "comments" || activeTab === "all") {
      setLoadingComments(true);
      import("../../api").then((api) => {
        api.fetchTaskComments(taskId)
          .then(setComments)
          .catch(console.error)
          .finally(() => setLoadingComments(false));
      });
    }
  }, [activeTab, task?.id]);

  useEffect(() => {
    if (!task?.id) return;

    setTaskLinks([]);
    setExpandedSubmissions({});
    setIsLoadingLinks(true);
    fetchTaskLinks(task.id)
      .then(setTaskLinks)
      .catch((error) => {
        console.error("Failed to load task links:", error);
      })
      .finally(() => setIsLoadingLinks(false));
  }, [task?.id]);

  // Combine and Sort for "All" Tab
  const timelineItems = useMemo(() => {
    const historyItems: TimelineItem[] = history.map((entry) => ({
      type: "history",
      data: entry,
      date: normalizeToUTC(entry.createdAt),
    }));

    const commentItems: TimelineItem[] = comments.map((entry) => ({
      type: "comment",
      data: entry,
      date: normalizeToUTC(entry.createdAt),
    }));

    return [...historyItems, ...commentItems].sort(
      (first, second) => second.date.getTime() - first.date.getTime(),
    );
  }, [comments, history]);

  const _renderHistoryItem = (record: TaskHistory) => (
    <div key={record.id} className="flex gap-3 text-sm">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        {record.actor?.avatarUrl ? (
          <img src={record.actor.avatarUrl} className="w-full h-full rounded-full" />
        ) : (
          <User className="w-4 h-4 text-gray-500" />
        )}
      </div>
      <div>
        <div className="text-gray-900">
          <span className="font-semibold">{record.actor?.fullName || "System"}</span>
          <span className="text-gray-500 mx-1">updated</span>
          <span className="font-medium text-gray-700">{record.fieldChanged}</span>
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          {record.oldValue && (
            <span className="text-red-500 line-through bg-red-50 px-1 rounded">
              {record.oldValue}
            </span>
          )}
          {record.oldValue && <span className="text-gray-400">→</span>}
          <span className="text-green-600 bg-green-50 px-1 rounded font-medium">
            {record.newValue}
          </span>
        </div>
        <p
          className="text-xs text-gray-400 mt-1"
          title={normalizeToUTC(record.createdAt).toLocaleString()}
        >
          {formatDistanceToNow(normalizeToUTC(record.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );

  const renderCommentItem = (comment: TaskComment) => (
    <div key={comment.id} className="flex gap-3 text-sm group">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        {comment.actor?.avatarUrl ? (
          <img src={comment.actor.avatarUrl} className="w-full h-full rounded-full" />
        ) : (
          <User className="w-4 h-4 text-gray-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {comment.actor?.fullName || "System"}
              </span>
              <span
                className="text-xs text-gray-400"
                title={normalizeToUTC(comment.createdAt).toLocaleString()}
              >
                {formatDistanceToNow(normalizeToUTC(comment.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          {isCommentOwner(comment) &&
          editingCommentId !== comment.id &&
          !isInteractionLocked ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Comment actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  onSelect={() => handleStartEditingComment(comment)}
                  className="flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setCommentPendingDelete(comment)}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {editingCommentId === comment.id ? (
          <RichTextEditor
            className="mt-3"
            initialContent={comment.content}
            onSave={(html) => handleUpdateComment(comment.id, html)}
            onCancel={handleCancelEditingComment}
            isSaving={updatingCommentId === comment.id}
            saveLabel="Update"
          />
        ) : (
          <div
            className={cn(
              "mt-1 text-sm text-gray-700",
              "[&_p]:mb-2 [&_p]:leading-relaxed",
              "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
              "[&_li]:my-1 [&_a]:text-blue-600 [&_a]:underline",
              "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:border [&_pre]:border-gray-200",
              "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
              "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-gray-200",
              "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
              "[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold",
              "[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs",
              "[&_[data-type=taskList]]:my-2 [&_[data-type=taskList]]:list-none [&_[data-type=taskList]]:pl-2",
              "[&_[data-type=taskItem]]:flex [&_[data-type=taskItem]]:items-start [&_[data-type=taskItem]]:gap-2",
              "[&_[data-type=taskItem]_input]:mt-1 [&_[data-type=taskItem]_input]:accent-blue-600"
            )}
            dangerouslySetInnerHTML={{ __html: comment.content }}
          />
        )}
      </div>
    </div>
  );

  if (!isOpen || !task) return null;

  const linkedFeature = task.specFeatureId
    ? specFeatures.find((feature) => feature.id === task.specFeatureId)
    : null;

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const dueDateLabel = dueDate ? format(dueDate, "MMM d, yyyy") : "";
  const isDueDateOverdue =
    !!dueDate && dueDate.getTime() < Date.now() && task.status !== "DONE";
  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((subtask) => subtask.status === "DONE").length;
  const unfinishedSubtasks = subtasks.filter((subtask) => subtask.status !== "DONE");
  const unfinishedSubtaskCount = unfinishedSubtasks.length;
  const subtaskProgress = totalSubtasks
    ? Math.round((completedSubtasks / totalSubtasks) * 100)
    : 0;
  const submissionFeed =
    submissions.length > 0 ? submissions : (task.submissions ?? []);
  const latestApprovedSubmission = getLatestApprovedSubmission({
    submissions: submissionFeed,
  });
  const approvedSubmissionEvidenceUrl = getSubmissionEvidenceUrl(
    latestApprovedSubmission
  );
  const approvedSubmissionPreview = getSubmissionPreviewText(
    latestApprovedSubmission
  );
  const canTransitionTaskToDone = Boolean(latestApprovedSubmission);
  const visibleStatusOptions = STATUS_OPTIONS.filter(
    (option) =>
      option.value !== "DONE" ||
      task.status === "DONE" ||
      (!isFreelancer && canTransitionTaskToDone)
  );
  const openReviewSubmission =
    submissionFeed.find(
      (submission) =>
        submission.status === "PENDING" ||
        submission.status === "PENDING_CLIENT_REVIEW"
    ) ?? null;
  const isBrokerApprovalBlockedBySubtasks = Boolean(
    openReviewSubmission?.status === "PENDING" &&
      unfinishedSubtaskCount > 0
  );
  const canSubmitNewVersion = Boolean(
    isFreelancer &&
      allowTaskMutations &&
      !openReviewSubmission &&
      task.status !== "DONE"
  );
  const ensureTaskMutationsAllowed = (fallbackMessage?: string) => {
    if (!allowTaskMutations) {
      toast.warning(
        taskMutationLockReason ||
          fallbackMessage ||
          "Task changes are locked for this milestone."
      );
      return false;
    }

    return true;
  };

  const applyTaskSnapshot = (incomingTask?: Partial<Task> | null) => {
    if (!task || !incomingTask) {
      return null;
    }

    const nextTask = mergeTaskSnapshot(task, incomingTask);
    setTask(nextTask);
    onUpdate?.(nextTask);
    return nextTask;
  };

  // HANDLERS
  const handleUpdate = async (patch: Partial<Task>) => {
    if (!task) return;
    if (!ensureTaskMutationsAllowed()) return null;
    try {
      const updated = await updateTask(task.id, patch);
      return applyTaskSnapshot(updated);
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update task",
      );
      return null;
    }
  };

  const handleAddLabel = async () => {
    if (!task) return;
    if (!ensureTaskMutationsAllowed()) return;

    const trimmedLabel = labelDraft.trim();
    if (!trimmedLabel) {
      return;
    }

    const existingLabels = new Set(
      (task.labels || []).map((label) => label.toLowerCase()),
    );
    if (existingLabels.has(trimmedLabel.toLowerCase())) {
      toast.info("This label already exists on the task.");
      return;
    }

    const updatedTask = await handleUpdate({
      labels: [...(task.labels || []), trimmedLabel],
    });

    if (updatedTask) {
      setLabelDraft("");
      setIsLabelPopoverOpen(false);
    }
  };

  const handleStatusChange = async (newStatus: KanbanColumnKey) => {
    if (!task) return;
    if (!allowTaskStatusEditing) {
      ensureTaskMutationsAllowed();
      return;
    }

    if (newStatus === "DONE" && !canTransitionTaskToDone) {
      toast.warning("Cannot move to DONE without an approved submission.");
      return;
    }

    if (
      task.status === "DONE" &&
      newStatus !== "DONE" &&
      latestApprovedSubmission
    ) {
      toast.warning(
        "Task da duoc approve va hoan tat, khong the doi nguoc khoi DONE.",
      );
      return;
    }

    try {
      const result = await updateTaskStatus(task.id, newStatus);
      applyTaskSnapshot({
        ...result.task,
        status: newStatus,
      });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleSaveComment = async (content: string) => {
    if (!task) return;
    if (!ensureTaskMutationsAllowed()) return;
    const html = content?.trim() ? content : commentDraft;
    if (!html.trim()) return;

    setIsSavingComment(true);
    try {
      const api = await import("../../api");
      const result = await api.createComment(task.id, html);
      setComments((prev) => [result.comment, ...prev]);
      applyTaskSnapshot(result.task ?? null);
      setCommentDraft("");
    } catch (error) {
      console.error("Failed to save comment:", error);
    } finally {
      setIsSavingComment(false);
    }
  };

  const getCommentOwnerId = (comment: TaskComment) => comment.actor?.id || comment.actorId;

  const isCommentOwner = (comment: TaskComment) =>
    Boolean(currentUserId) && getCommentOwnerId(comment) === currentUserId;

  const handleStartEditingComment = (comment: TaskComment) => {
    if (!ensureTaskMutationsAllowed()) return;
    setCommentPendingDelete(null);
    setEditingCommentId(comment.id);
  };

  const handleCancelEditingComment = () => {
    setEditingCommentId(null);
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    if (!ensureTaskMutationsAllowed()) return;
    setUpdatingCommentId(commentId);
    try {
      const api = await import("../../api");
      const result = await api.updateComment(commentId, content);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId ? result.comment : comment,
        ),
      );
      applyTaskSnapshot(result.task ?? null);
      setEditingCommentId(null);
      toast.success("Comment updated.");
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update comment",
      );
      throw error;
    } finally {
      setUpdatingCommentId(null);
    }
  };

  const handleConfirmDeleteComment = async () => {
    if (!commentPendingDelete) {
      return;
    }
    if (!ensureTaskMutationsAllowed()) return;

    const targetComment = commentPendingDelete;
    setDeletingCommentId(targetComment.id);
    try {
      const api = await import("../../api");
      await api.deleteComment(targetComment.id);
      setComments((prev) => prev.filter((comment) => comment.id !== targetComment.id));
      if (editingCommentId === targetComment.id) {
        setEditingCommentId(null);
      }
      setCommentPendingDelete(null);
      toast.success("Comment deleted.");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete comment",
      );
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleCancelComment = () => {
    setCommentDraft("");
  };

  const handleAddLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task) return;
    if (!ensureTaskMutationsAllowed()) return;

    const url = linkForm.url.trim();
    const title = linkForm.title.trim();

    if (!url) {
      setLinkError("URL is required.");
      return;
    }

    setIsSavingLink(true);
    setLinkError(null);
    try {
      const created = await createTaskLink(task.id, {
        url,
        title: title || undefined,
      });
      setTaskLinks((prev) => [created, ...prev]);
      setLinkForm({ url: "", title: "" });
      setIsLinkPopoverOpen(false);
    } catch (error) {
      console.error("Failed to add link:", error);
      setLinkError("Failed to add link. Please try again.");
    } finally {
      setIsSavingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!task) return;
    if (!ensureTaskMutationsAllowed()) return;
    try {
      await deleteTaskLink(task.id, linkId);
      setTaskLinks((prev) => prev.filter((link) => link.id !== linkId));
    } catch (error) {
      console.error("Failed to delete link:", error);
    }
  };

  const handleCreateSubtask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task) return;
    if (!canManageSubtasks) {
      setSubtaskError(subtaskPermissionMessage);
      toast.warning(subtaskPermissionMessage);
      return;
    }
    if (!ensureTaskMutationsAllowed()) return;

    const title = newSubtaskTitle.trim();
    if (!title) {
      setSubtaskError("Title is required.");
      return;
    }

    setIsCreatingSubtask(true);
    setSubtaskError(null);
    try {
      const created = await createSubtask(task.id, {
        title,
        priority: newSubtaskPriority || task.priority,
      });
      setSubtasks((prev) => [created, ...prev]);
      setNewSubtaskTitle("");
      setIsCreateSubtaskOpen(false);
    } catch (error) {
      console.error("Failed to create subtask:", error);
      setSubtaskError(
        error instanceof Error ? error.message : "Failed to create subtask. Please try again."
      );
    } finally {
      setIsCreatingSubtask(false);
    }
  };

  const handleLinkExistingSubtask = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!task) return;
    if (!canManageSubtasks) {
      setSubtaskError(subtaskPermissionMessage);
      toast.warning(subtaskPermissionMessage);
      return;
    }
    if (!ensureTaskMutationsAllowed()) return;

    const subtaskId = linkExistingSubtaskId.trim();
    if (!subtaskId) {
      setSubtaskError("Subtask ID is required.");
      return;
    }

    setIsLinkingSubtask(true);
    setSubtaskError(null);
    try {
      const linked = await linkSubtask(task.id, subtaskId);
      setSubtasks((prev) => [linked, ...prev.filter((item) => item.id !== linked.id)]);
      setLinkExistingSubtaskId("");
      setIsLinkExistingOpen(false);
    } catch (error) {
      console.error("Failed to link subtask:", error);
      setSubtaskError(
        error instanceof Error
          ? error.message
          : "Failed to link subtask. Please check the ID and try again."
      );
    } finally {
      setIsLinkingSubtask(false);
    }
  };

  const handleUpdateSubtaskStatus = async (
    subtaskId: string,
    newStatus: KanbanColumnKey
  ) => {
    if (updatingSubtaskId || !task) return;
    if (!ensureTaskMutationsAllowed()) return;

    const current = subtasks.find((subtask) => subtask.id === subtaskId);
    if (!current || current.status === newStatus) return;

    setUpdatingSubtaskId(subtaskId);
    setSubtaskError(null);
    try {
      const updated = await updateTask(subtaskId, { status: newStatus });
      setSubtasks((prev) =>
        prev.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, ...updated } : subtask
        )
      );
    } catch (error) {
      console.error("Failed to update subtask status:", error);
      setSubtaskError("Failed to update subtask status. Please try again.");
    } finally {
      setUpdatingSubtaskId(null);
    }
  };

  const handleSubmitSubmission = async (html: string) => {
    if (!task) return;
    if (!ensureTaskMutationsAllowed()) return;
    const trimmed = html?.trim();
    if (!trimmed || trimmed === "<p></p>") {
      setSubmissionError("Submission content is required.");
      return;
    }

    setIsSubmittingSubmission(true);
    setSubmissionError(null);
    try {
      const result = await createTaskSubmission(task.id, {
        content: html,
        attachments: [],
      });
      const nextSubmissions = result.task.submissions ?? [result.submission, ...submissionFeed];
      setSubmissions(nextSubmissions);
      applyTaskSnapshot({
        ...result.task,
        status: "IN_REVIEW",
        submissions: nextSubmissions,
      });
    } catch (error) {
      console.error("Failed to submit work:", error);
      setSubmissionError("Failed to submit work. Please try again.");
      throw error;
    } finally {
      setIsSubmittingSubmission(false);
    }
  };

  const toggleSubmissionExpanded = (submissionId: string) => {
    setExpandedSubmissions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  };

  // Review Handlers
  const handleApproveSubmission = (submission: TaskSubmission) => {
    if (!task || !canReview) return;
    if (
      submission.status === "PENDING" &&
      unfinishedSubtaskCount > 0
    ) {
      const message = `Cannot approve submission yet: ${unfinishedSubtaskCount} subtasks are still not DONE.`;
      setSubmissionError(message);
      toast.warning(message);
      return;
    }
    setSubmissionError(null);
    setApproveDialogSubmission(submission);
  };

  const confirmApproveSubmission = async () => {
    if (!task || !canReview || !approveDialogSubmission) return;

    const submissionId = approveDialogSubmission.id;
    if (
      approveDialogSubmission.status === "PENDING" &&
      unfinishedSubtaskCount > 0
    ) {
      const message = `Cannot approve submission yet: ${unfinishedSubtaskCount} subtasks are still not DONE.`;
      setSubmissionError(message);
      toast.warning(message);
      setApproveDialogSubmission(null);
      return;
    }
    setIsReviewing(true);
    setReviewingSubmissionId(submissionId);
    try {
      const result = await reviewSubmission(task.id, submissionId, {
        status: "APPROVED",
      });
      const nextSubmissions = result.task.submissions ?? submissionFeed;
      setSubmissions(nextSubmissions);
      applyTaskSnapshot({
        ...result.task,
        submissions: nextSubmissions,
      });
      setApproveDialogSubmission(null);
    } catch (error) {
      console.error("Failed to approve submission:", error);
      const message =
        error instanceof Error ? error.message : "Failed to approve submission.";
      setSubmissionError(message);
      toast.error(message);
    } finally {
      setIsReviewing(false);
      setReviewingSubmissionId(null);
    }
  };

  const handleRequestChanges = async (submissionId: string) => {
    if (!task || !canReview) return;

    if (!reviewNote.trim()) {
      setSubmissionError("Please provide feedback for the requested changes.");
      return;
    }

    setIsReviewing(true);
    setReviewingSubmissionId(submissionId);
    try {
      const result = await reviewSubmission(task.id, submissionId, {
        status: "REQUEST_CHANGES",
        reviewNote: reviewNote.trim(),
      });
      const nextSubmissions = result.task.submissions ?? submissionFeed;
      setSubmissions(nextSubmissions);
      applyTaskSnapshot({
        ...result.task,
        submissions: nextSubmissions,
      });
      // Reset form
      setReviewNote("");
      setIsReviewNotePopoverOpen(false);
    } catch (error) {
      console.error("Failed to request changes:", error);
      const message =
        error instanceof Error ? error.message : "Failed to request changes.";
      setSubmissionError(message);
      toast.error(message);
    } finally {
      setIsReviewing(false);
      setReviewingSubmissionId(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-8 overflow-hidden">
        <div className="bg-white w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER (BREADCRUMB & ACTIONS) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Layers className="w-4 h-4" />
            <span>Project</span>
            <span>/</span>
            <span className="uppercase">{task.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded">
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 h-full">
            
            {/* LEFT COLUMN: MAIN CONTENT (8 cols) */}
            <div className="md:col-span-8 p-6 pr-4 border-r border-gray-200 space-y-8 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto md:custom-scrollbar">
              {isInteractionLocked && taskMutationLockReason ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {taskMutationLockReason}
                </div>
              ) : null}

              {/* TITLE */}
              <div>
                <EditableText
                  value={task.title}
                  onSave={(val) => handleUpdate({ title: val })}
                  className="text-2xl font-semibold text-gray-900 leading-tight"
                  disabled={isInteractionLocked}
                />
              </div>
              
              {/* ACTION BAR (Buttons) */}
              <div className="flex items-center gap-2">
                 <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
                    <Link2 className="w-4 h-4" />
                    Copy Link
                 </button>
                 <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium text-gray-700 transition-colors">
                    <Flag className="w-4 h-4" />
                    Report
                 </button>
              </div>

              {/* DESCRIPTION */}
              <div>
                <SectionHeader title="Description" />
                <EditableText
                  value={task.description || ""}
                  onSave={(val) => handleUpdate({ description: val })}
                  multiline
                  placeholder="Add a description..."
                  className="text-gray-700 leading-relaxed text-sm min-h-[120px]"
                  disabled={isInteractionLocked}
                />
              </div>

              {/* SPEC FEATURE LINK */}
              {linkedFeature && (
                 <div className="bg-teal-50 border border-teal-200 rounded-md p-3">
                     <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-bold text-teal-700 uppercase">Feature Spec Compliance</span>
                     </div>
                     <p className="text-sm text-teal-900 font-medium">{linkedFeature.title}</p>
                     <p className="text-xs text-teal-600 mt-0.5">
                       {linkedFeature.complexity || "UNSPECIFIED"}
                     </p>
                 </div>
              )}

              {/* APPROVED SUBMISSION DISPLAY */}
              {task.status === "DONE" && latestApprovedSubmission && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
                      <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <h4 className="text-sm font-bold text-emerald-800">Approved Submission</h4>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 mb-2">
                        Version {latestApprovedSubmission.version}
                      </p>
                      {approvedSubmissionPreview && (
                        <p className="text-sm text-emerald-900 mb-2">
                          {approvedSubmissionPreview}
                        </p>
                      )}
                      {approvedSubmissionEvidenceUrl && (
                        <a
                          href={approvedSubmissionEvidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-emerald-700 hover:underline flex items-center gap-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Submission Evidence
                        </a>
                      )}
                  </div>
              )}

              <AttachmentGallery attachments={task.attachments || []} />

              {/* WEB LINKS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Web Links
                  </h3>
                  <Popover
                    open={isLinkPopoverOpen}
                    onOpenChange={(open) => {
                      if (open && !allowTaskMutations) {
                        ensureTaskMutationsAllowed();
                        return;
                      }
                      setIsLinkPopoverOpen(open);
                      if (open) setLinkError(null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={isInteractionLocked}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        aria-label="Add web link"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <form onSubmit={handleAddLink} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-600">URL</label>
                          <input
                            type="url"
                            value={linkForm.url}
                            onChange={(e) =>
                              setLinkForm((prev) => ({ ...prev, url: e.target.value }))
                            }
                            disabled={isInteractionLocked}
                            placeholder="https://example.com"
                            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-600">
                            Link Text
                          </label>
                          <input
                            type="text"
                            value={linkForm.title}
                            onChange={(e) =>
                              setLinkForm((prev) => ({ ...prev, title: e.target.value }))
                            }
                            disabled={isInteractionLocked}
                            placeholder="Design spec"
                            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        {linkError && <p className="text-xs text-red-600">{linkError}</p>}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsLinkPopoverOpen(false)}
                            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingLink || isInteractionLocked}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {isSavingLink ? "Saving..." : "Add Link"}
                          </button>
                        </div>
                      </form>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  {isLoadingLinks ? (
                    <div className="flex items-center justify-center py-4 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : taskLinks.length === 0 ? (
                    <p className="text-sm text-gray-500">No links yet.</p>
                  ) : (
                    taskLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                            <Link2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm font-semibold text-blue-700 hover:underline"
                            >
                              {link.title || link.url}
                            </a>
                            <p className="truncate text-xs text-gray-500">{link.url}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteLink(link.id)}
                          disabled={isInteractionLocked}
                          className="rounded p-1 text-gray-400 hover:text-red-500"
                          aria-label="Remove link"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SUBTASKS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Subtasks
                  </h3>
                  <div className="flex items-center gap-2">
                    <Popover
                      open={isCreateSubtaskOpen}
                      onOpenChange={(open) => {
                        if (open && !canManageSubtasks) {
                          setSubtaskError(subtaskPermissionMessage);
                          toast.warning(subtaskPermissionMessage);
                          return;
                        }
                        setIsCreateSubtaskOpen(open);
                        if (open) setSubtaskError(null);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!canManageSubtasks}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          aria-label="Add subtask"
                          title={!canManageSubtasks ? subtaskPermissionMessage : undefined}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <form onSubmit={handleCreateSubtask} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600">Title</label>
                            <input
                              type="text"
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              disabled={!canManageSubtasks}
                              placeholder="Implement login flow"
                              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600">
                              Priority
                            </label>
                            <select
                              value={newSubtaskPriority}
                              onChange={(e) =>
                                setNewSubtaskPriority(e.target.value as TaskPriority)
                              }
                              disabled={!canManageSubtasks}
                              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              {Object.keys(PRIORITY_CONFIG).map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </div>
                          {subtaskError && (
                            <p className="text-xs text-red-600">{subtaskError}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setIsCreateSubtaskOpen(false)}
                              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isCreatingSubtask || !canManageSubtasks}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {isCreatingSubtask ? "Saving..." : "Create"}
                            </button>
                          </div>
                        </form>
                      </PopoverContent>
                    </Popover>
                    <Popover
                      open={isLinkExistingOpen}
                      onOpenChange={(open) => {
                        if (open && !canManageSubtasks) {
                          setSubtaskError(subtaskPermissionMessage);
                          toast.warning(subtaskPermissionMessage);
                          return;
                        }
                        setIsLinkExistingOpen(open);
                        if (open) setSubtaskError(null);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!canManageSubtasks}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          aria-label="Link existing subtask"
                          title={!canManageSubtasks ? subtaskPermissionMessage : undefined}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Link
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <form onSubmit={handleLinkExistingSubtask} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-600">
                              Subtask ID
                            </label>
                            <input
                              type="text"
                              value={linkExistingSubtaskId}
                              onChange={(e) => setLinkExistingSubtaskId(e.target.value)}
                              disabled={!canManageSubtasks}
                              placeholder="UUID of the existing task"
                              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                          {subtaskError && (
                            <p className="text-xs text-red-600">{subtaskError}</p>
                          )}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setIsLinkExistingOpen(false)}
                              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isLinkingSubtask || !canManageSubtasks}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {isLinkingSubtask ? "Linking..." : "Link"}
                            </button>
                          </div>
                        </form>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {completedSubtasks}/{totalSubtasks} done
                    </span>
                    <span>{subtaskProgress}%</span>
                  </div>
                  <Progress value={subtaskProgress} className="h-2 mt-2" />
                </div>

                {unfinishedSubtaskCount > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                    <p className="font-medium text-amber-900">
                      {unfinishedSubtaskCount} subtasks are still not DONE.
                    </p>
                    <p className="mt-1 text-xs">
                      Broker approval stays blocked until every subtask is completed.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {unfinishedSubtasks.slice(0, 4).map((subtask) => (
                        <span
                          key={subtask.id}
                          className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-900"
                        >
                          {subtask.title}
                        </span>
                      ))}
                      {unfinishedSubtaskCount > 4 ? (
                        <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] text-amber-900">
                          +{unfinishedSubtaskCount - 4} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2 mt-3">
                  {isLoadingSubtasks ? (
                    <div className="flex items-center justify-center py-4 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : subtasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No subtasks yet.</p>
                  ) : (
                    subtasks.map((subtask) => {
                      const priorityKey = (subtask.priority || "MEDIUM") as TaskPriority;
                      const subtaskStatusOption = SUBTASK_STATUS_OPTIONS.find(
                        (option) => option.value === subtask.status
                      );
                      return (
                        <div
                          key={subtask.id}
                          className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
                        >
                          <div
                            className={cn(
                              "mt-1",
                              subtask.status === "DONE"
                                ? "text-emerald-600"
                                : "text-gray-400"
                            )}
                          >
                            {subtask.status === "DONE" ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-gray-500">
                                TASK-{subtask.id.slice(0, 6).toUpperCase()}
                              </span>
                              <span className="truncate text-sm font-semibold text-gray-900">
                                {subtask.title}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1">
                                <Flag
                                  className={cn(
                                    "w-3 h-3",
                                    PRIORITY_CONFIG[priorityKey].color
                                  )}
                                />
                                <span className={PRIORITY_CONFIG[priorityKey].color}>
                                  {priorityKey}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {subtask.assignee?.fullName || "Unassigned"}
                              </span>
                              <div className="relative">
                                <select
                                  value={subtask.status}
                                  onChange={(e) =>
                                    handleUpdateSubtaskStatus(
                                      subtask.id,
                                      e.target.value as KanbanColumnKey
                                    )
                                  }
                                  disabled={updatingSubtaskId === subtask.id || isInteractionLocked}
                                  className={cn(
                                    "appearance-none rounded-full px-2 py-0.5 pr-5 text-[10px] font-semibold ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-500 cursor-pointer",
                                    subtaskStatusOption?.color,
                                    updatingSubtaskId === subtask.id && "opacity-60"
                                  )}
                                >
                                  {SUBTASK_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SUBMISSIONS */}
              <div>
                <SectionHeader title="Submissions" />
                <div className="space-y-4">
                  <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">New submission</h4>
                        <p className="text-xs text-gray-500">
                          Share rich updates, evidence, and context.
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase text-gray-400">
                        Rich text
                      </span>
                    </div>
                    {canSubmitNewVersion ? (
                      <RichTextEditor
                        placeholder="Describe what you delivered, include links, images, or steps..."
                        onSave={handleSubmitSubmission}
                        onCancel={() => setSubmissionError(null)}
                        isSaving={isSubmittingSubmission}
                        saveLabel="Submit"
                      />
                    ) : openReviewSubmission ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">
                          {SUBMISSION_STATUS_CONFIG[openReviewSubmission.status]?.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {openReviewSubmission.status === "PENDING"
                            ? "A broker decision is required before another version can be submitted."
                            : `Broker approved this submission. Waiting for client review${
                                openReviewSubmission.clientReviewDueAt
                                  ? ` until ${format(
                                      normalizeToUTC(openReviewSubmission.clientReviewDueAt),
                                      "MMM d, yyyy HH:mm"
                                    )}`
                                  : ""
                              }.`}
                        </p>
                        {isBrokerApprovalBlockedBySubtasks ? (
                          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Broker approval is blocked until {unfinishedSubtaskCount} unfinished subtasks are marked DONE.
                          </div>
                        ) : null}
                      </div>
                    ) : isFreelancer ? (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        Submission is unavailable while this milestone is read-only.
                      </div>
                    ) : (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        Only the assigned freelancer can submit new versions.
                      </div>
                    )}
                    {submissionError && (
                      <p className="mt-2 text-xs text-red-600">{submissionError}</p>
                    )}
                  </div>

                  <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">
                          Submission history
                        </h4>
                        <p className="text-xs text-gray-500">All previous versions.</p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {submissions.length} versions
                      </span>
                    </div>

                    {isLoadingSubmissions ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : submissions.length === 0 ? (
                      <p className="text-sm text-gray-500">No submissions yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {submissions.map((submission) => {
                          const statusMeta =
                            SUBMISSION_STATUS_CONFIG[submission.status];
                          const submitterName =
                            submission.submitter?.fullName || "Unknown";
                          const isExpanded = !!expandedSubmissions[submission.id];
                          const canBrokerReviewThis =
                            canReview &&
                            canBrokerReview &&
                            submission.status === "PENDING";
                          const canClientReviewThis =
                            canReview &&
                            canClientReview &&
                            submission.status === "PENDING_CLIENT_REVIEW";
                          return (
                            <div
                              key={submission.id}
                              className="rounded-md border border-gray-200 bg-white"
                            >
                              <div className="flex items-start justify-between gap-4 px-3 py-3">
                                <div className="flex items-start gap-3">
                                  <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-semibold overflow-hidden">
                                    {submission.submitter?.avatarUrl ? (
                                      <img
                                        src={submission.submitter.avatarUrl}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      submitterName.slice(0, 1).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                      <span className="font-semibold text-gray-900">
                                        {submitterName}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        Submitted V{submission.version}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {formatDistanceToNow(
                                        normalizeToUTC(submission.createdAt),
                                        { addSuffix: true }
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                    statusMeta?.color
                                  )}
                                >
                                  {statusMeta?.label}
                                </span>
                              </div>
                              <div className="border-t border-gray-200 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => toggleSubmissionExpanded(submission.id)}
                                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                                >
                                  {isExpanded ? "Hide content" : "View content"}
                                  <ChevronDown
                                    className={cn(
                                      "h-3 w-3 transition-transform",
                                      isExpanded && "rotate-180"
                                    )}
                                  />
                                </button>
                                {isExpanded && (
                                  <div
                                    className={cn(
                                      "mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700",
                                      "[&_p]:mb-2 [&_p]:leading-relaxed",
                                      "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
                                      "[&_li]:my-1 [&_a]:text-blue-600 [&_a]:underline",
                                      "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:border [&_pre]:border-gray-200",
                                      "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
                                      "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-gray-200",
                                      "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
                                      "[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold",
                                      "[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_td]:text-xs",
                                      "[&_[data-type=taskList]]:my-2 [&_[data-type=taskList]]:list-none [&_[data-type=taskList]]:pl-2",
                                      "[&_[data-type=taskItem]]:flex [&_[data-type=taskItem]]:items-start [&_[data-type=taskItem]]:gap-2",
                                      "[&_[data-type=taskItem]_input]:mt-1 [&_[data-type=taskItem]_input]:accent-blue-600"
                                    )}
                                    dangerouslySetInnerHTML={{
                                      __html: submission.content,
                                    }}
                                  />
                                )}

                                {submission.status === "PENDING" ? (
                                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                    Waiting for broker review.
                                  </div>
                                ) : null}

                                {submission.status === "PENDING_CLIENT_REVIEW" ? (
                                  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                    Broker approved this version. Waiting for client review
                                    {submission.clientReviewDueAt
                                      ? ` until ${format(
                                          normalizeToUTC(submission.clientReviewDueAt),
                                          "MMM d, yyyy HH:mm"
                                        )}`
                                      : ""}
                                    .
                                  </div>
                                ) : null}

                                {submission.status === "AUTO_APPROVED" ? (
                                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                    Auto-approved after the client did not respond within 24 hours.
                                  </div>
                                ) : null}

                                {submission.brokerReviewNote ? (
                                  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="text-xs font-semibold text-blue-700">
                                        Broker review
                                      </span>
                                      {submission.brokerReviewedAt ? (
                                        <span className="text-[10px] text-blue-500">
                                          {formatDistanceToNow(
                                            normalizeToUTC(submission.brokerReviewedAt),
                                            { addSuffix: true }
                                          )}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-sm text-blue-900">
                                      {submission.brokerReviewNote}
                                    </p>
                                  </div>
                                ) : null}

                                {submission.clientReviewNote ? (
                                  <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3">
                                    <div className="mb-1 flex items-center gap-2">
                                      <span className="text-xs font-semibold text-purple-700">
                                        Client review
                                      </span>
                                      {submission.clientReviewedAt ? (
                                        <span className="text-[10px] text-purple-500">
                                          {formatDistanceToNow(
                                            normalizeToUTC(submission.clientReviewedAt),
                                            { addSuffix: true }
                                          )}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-sm text-purple-900">
                                      {submission.clientReviewNote}
                                    </p>
                                  </div>
                                ) : null}

                                {(canBrokerReviewThis || canClientReviewThis) && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex items-center gap-2">
                                      {/* Approve Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleApproveSubmission(submission)}
                                        disabled={
                                          (isReviewing && reviewingSubmissionId === submission.id) ||
                                          (canBrokerReviewThis &&
                                            submission.status === "PENDING" &&
                                            unfinishedSubtaskCount > 0)
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                                      >
                                        {isReviewing && reviewingSubmissionId === submission.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                        )}
                                        {canBrokerReviewThis
                                          ? "Approve & Send to Client"
                                          : "Approve & Mark Done"}
                                      </button>

                                      {/* Request Changes Button with Popover */}
                                      <Popover
                                        open={isReviewNotePopoverOpen && reviewingSubmissionId === submission.id}
                                        onOpenChange={(open) => {
                                          setIsReviewNotePopoverOpen(open);
                                          if (open) {
                                            setReviewingSubmissionId(submission.id);
                                            setSubmissionError(null);
                                          } else {
                                            setReviewNote("");
                                          }
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            disabled={isReviewing && reviewingSubmissionId === submission.id}
                                            className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
                                          >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Request Changes
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80">
                                          <div className="space-y-3">
                                            <div>
                                              <h4 className="text-sm font-semibold text-gray-900">
                                                Request Changes
                                              </h4>
                                              <p className="text-xs text-gray-500">
                                                Provide feedback for the freelancer.
                                              </p>
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-xs font-semibold text-gray-600">
                                                Feedback
                                              </label>
                                              <textarea
                                                value={reviewNote}
                                                onChange={(e) => setReviewNote(e.target.value)}
                                                placeholder="Describe what needs to be changed..."
                                                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500 resize-none h-24"
                                              />
                                            </div>
                                            {submissionError && (
                                              <p className="text-xs text-red-600">{submissionError}</p>
                                            )}
                                            <div className="flex justify-end gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setIsReviewNotePopoverOpen(false);
                                                  setReviewNote("");
                                                }}
                                                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleRequestChanges(submission.id)}
                                                disabled={isReviewing || !reviewNote.trim()}
                                                className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                                              >
                                                {isReviewing ? "Sending..." : "Send Feedback"}
                                              </button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTIVITY TABS */}
              <div className="mt-8">
                 <div className="flex items-center gap-6 border-b border-gray-200 mb-4">
                     <button onClick={() => setActiveTab("all")} className={cn("pb-2 text-sm font-medium border-b-2 transition-colors", activeTab === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>All</button>
                     <button onClick={() => setActiveTab("comments")} className={cn("pb-2 text-sm font-medium border-b-2 transition-colors", activeTab === "comments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>Comments</button>
                     <button onClick={() => setActiveTab("history")} className={cn("pb-2 text-sm font-medium border-b-2 transition-colors", activeTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>History</button>
                 </div>
              </div>
              
              {/* TAB CONTENT */}
              <div className="min-h-[200px]">
                  {/* ALL TAB (Merged View) */}
                  {activeTab === 'all' && (
                     <div className="space-y-4">
                         {loadingHistory || loadingComments ? (
                             <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                         ) : timelineItems.length === 0 ? (
                             <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
                         ) : (
                             timelineItems.map((item) => {
                                 if (item.type === "comment") {
                                     return renderCommentItem(item.data);
                                 }
                                 if (item.type === 'history') {
                                     const record = item.data;
                                     return (
                                         <div key={`hist-${record.id}`} className="flex gap-3 text-sm">
                                             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                  {record.actor?.avatarUrl ? (
                                                      <img src={record.actor.avatarUrl} className="w-full h-full rounded-full" />
                                                  ) : (
                                                      <User className="w-4 h-4 text-gray-500" />
                                                  )}
                                             </div>
                                             <div>
                                                 <div className="text-gray-900">
                                                     <span className="font-semibold">{record.actor?.fullName || "System"}</span>
                                                     <span className="text-gray-500 mx-1">updated</span>
                                                     <span className="font-medium text-gray-700">{record.fieldChanged}</span>
                                                 </div>
                                                 <div className="flex items-center gap-2 text-xs mt-1">
                                                      {record.oldValue && <span className="text-red-500 line-through bg-red-50 px-1 rounded">{record.oldValue}</span>}
                                                      {record.oldValue && <span className="text-gray-400">→</span>}
                                                      <span className="text-green-600 bg-green-50 px-1 rounded font-medium">{record.newValue}</span>
                                                 </div>
                                                 <p className="text-xs text-gray-400 mt-1" title={item.date.toLocaleString()}>
                                                     {formatDistanceToNow(item.date, { addSuffix: true })}
                                                 </p>
                                             </div>
                                         </div>
                                     );
                                 }
                                 // Handle comments here in future
                                 return null;
                             })
                         )}
                     </div>
                  )}

                  {activeTab === 'comments' && (
                 <div className="flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                         You
                     </div>
                     <div className="flex-1">
                        {allowTaskMutations ? (
                          <RichTextEditor
                              className="mb-4"
                              onChange={setCommentDraft}
                              onSave={handleSaveComment}
                              onCancel={handleCancelComment}
                              isSaving={isSavingComment}
                          />
                        ) : (
                          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Comments are read-only while this milestone is locked.
                          </div>
                        )}

                         {/* Comment List */}
                         <div className="space-y-4">
                           {comments.map((comment) => renderCommentItem(comment))}
                         </div>
                     </div>
                 </div>
                 )}

                  {activeTab === 'history' && (
                      <div className="space-y-4">
                           {loadingHistory ? (
                               <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-400" /></div>
                           ) : history.length === 0 ? (
                               <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
                           ) : (
                               history.slice(0, visibleHistoryCount).map((record) => (
                                   <div key={record.id} className="flex gap-3 text-sm">
                                       <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            {record.actor?.avatarUrl ? (
                                                <img src={record.actor.avatarUrl} className="w-full h-full rounded-full" />
                                            ) : (
                                                <User className="w-4 h-4 text-gray-500" />
                                            )}
                                       </div>
                                       <div>
                                           <div className="text-gray-900">
                                               <span className="font-semibold">{record.actor?.fullName || "System"}</span>
                                               <span className="text-gray-500 mx-1">updated</span>
                                               <span className="font-medium text-gray-700">{record.fieldChanged}</span>
                                           </div>
                                           <div className="flex items-center gap-2 text-xs mt-1">
                                                {record.oldValue && <span className="text-red-500 line-through bg-red-50 px-1 rounded">{record.oldValue}</span>}
                                                {record.oldValue && <span className="text-gray-400">→</span>}
                                                <span className="text-green-600 bg-green-50 px-1 rounded font-medium">{record.newValue}</span>
                                           </div>
                                           <p className="text-xs text-gray-400 mt-1" title={normalizeToUTC(record.createdAt).toLocaleString()}>
                                               {formatDistanceToNow(normalizeToUTC(record.createdAt), { addSuffix: true })}
                                           </p>
                                       </div>
                                   </div>
                               ))
                           )}
                           {!loadingHistory && visibleHistoryCount < history.length && (
                             <div className="flex justify-center pt-2">
                               <button
                                 type="button"
                                 onClick={() => setVisibleHistoryCount((prev) => prev + 5)}
                                 className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
                               >
                                 Load more
                               </button>
                             </div>
                           )}
                      </div>
                  )}
              </div>

              </div>

            {/* RIGHT COLUMN: SIDEBAR (4 cols) */}
            <div className="md:col-span-4 p-6 space-y-6 bg-gray-50/50 md:sticky md:top-0 md:self-start">
              
              {/* STATUS SELECTOR */}
              <div>
                <SectionHeader title="Status" />
                <div className="relative">
                   <select 
                      value={task.status}
                      onChange={(e) => handleStatusChange(e.target.value as KanbanColumnKey)}
                      disabled={!allowTaskStatusEditing}
                      className={cn(
                          "w-full appearance-none px-3 py-2 rounded-md font-semibold text-sm border-0 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-500",
                          allowTaskStatusEditing ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                          STATUS_OPTIONS.find(o => o.value === task.status)?.color
                      )}
                   >
                        {visibleStatusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                   </select>
                   <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* DETAILS PANEL */}
              <div className="border border-gray-200 rounded-md bg-white p-4 shadow-sm space-y-4">
                  <SectionHeader title="Details" />
                  
                  {/* Assignee */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Assignee</span>
                      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors group">
                           {task.assignee ? (
                              <>
                                <img src={task.assignee.avatarUrl || `https://ui-avatars.com/api/?name=${task.assignee.fullName}`} alt="" className="w-5 h-5 rounded-full" />
                                <span className="text-sm text-blue-700">{task.assignee.fullName}</span>
                              </>
                           ) : (
                               <span className="text-sm text-gray-400 italic">Unassigned</span>
                           )}
                           <User className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                      </div>
                  </div>

                   {/* Reporter */}
                   <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Reporter</span>
                      <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[10px] text-green-700 font-bold">R</div>
                           {/* Using mock reporter for now if not in task object yet */}
                           <span className="text-sm text-gray-900">{task.reporterId ? "Project Admin" : "System"}</span> 
                      </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Priority</span>
                      <div className="relative group">
                           <select
                              value={task.priority || "MEDIUM"}
                              onChange={(e) => handleUpdate({ priority: e.target.value as TaskPriority })}
                              disabled={isInteractionLocked}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                           >
                               {Object.keys(PRIORITY_CONFIG).map(p => (
                                   <option key={p} value={p}>{p}</option>
                               ))}
                           </select>
                           <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 pr-2 rounded transition-colors border border-transparent hover:border-gray-200">
                               <Flag className={cn("w-3.5 h-3.5", PRIORITY_CONFIG[task.priority || "MEDIUM"].color)} />
                               <span className={cn("text-sm font-medium", PRIORITY_CONFIG[task.priority || "MEDIUM"].color)}>
                                   {task.priority || "MEDIUM"}
                               </span>
                               <ChevronDown className="w-3 h-3 text-gray-400" />
                           </div>
                      </div>
                  </div>

                  {/* Story Points */}
                  <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Story Points</span>
                      <input 
                         type="number" 
                         value={task.storyPoints || ""} 
                         onChange={(e) => handleUpdate({ storyPoints: parseInt(e.target.value) || 0 })}
                         disabled={isInteractionLocked}
                         placeholder="-"
                         className="w-16 text-right text-sm border-gray-200 rounded p-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                  </div>

                  {/* Labels */}
                  <div className="space-y-2">
                       <span className="text-sm text-gray-600 font-medium block">Labels</span>
                       <div className="flex flex-wrap gap-2">
                           {task.labels?.map(label => (
                               <span key={label} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                   {label}
                               </span>
                           ))}
                           <Popover
                             open={isLabelPopoverOpen}
                             onOpenChange={(open) => {
                               if (open && !allowTaskMutations) {
                                 ensureTaskMutationsAllowed();
                                 return;
                               }
                               setIsLabelPopoverOpen(open);
                             }}
                           >
                               <PopoverTrigger asChild>
                                   <button
                                       type="button"
                                       disabled={isInteractionLocked}
                                       className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                   >
                                       <Plus className="w-3 h-3" />
                                       Add
                                   </button>
                               </PopoverTrigger>
                               <PopoverContent align="start" className="w-72 space-y-3 p-3">
                                   <div className="space-y-1">
                                       <p className="text-sm font-semibold text-gray-900">Add label</p>
                                       <p className="text-xs text-gray-500">
                                           Create a label for faster task filtering and grouping.
                                       </p>
                                   </div>
                                   <Input
                                       value={labelDraft}
                                       onChange={(event) => setLabelDraft(event.target.value)}
                                       disabled={isInteractionLocked}
                                       onKeyDown={(event) => {
                                           if (event.key === "Enter") {
                                               event.preventDefault();
                                               void handleAddLabel();
                                           }
                                       }}
                                       placeholder="e.g. frontend"
                                       autoFocus
                                   />
                                   <div className="flex justify-end gap-2">
                                       <button
                                           type="button"
                                           onClick={() => {
                                               setIsLabelPopoverOpen(false);
                                               setLabelDraft("");
                                           }}
                                           className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                       >
                                           Cancel
                                       </button>
                                       <button
                                           type="button"
                                           onClick={() => void handleAddLabel()}
                                           disabled={!labelDraft.trim() || isInteractionLocked}
                                           className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                       >
                                           Add label
                                       </button>
                                   </div>
                               </PopoverContent>
                           </Popover>
                       </div>
                  </div>

                  {/* Start Date */}
                   <div className="space-y-2">
                      <span className="text-sm text-gray-600 font-medium">Start Date</span>
                      <WorkspaceDatePicker
                        value={task.startDate ?? null}
                        onChange={(value) => void handleUpdate({ startDate: value })}
                        placeholder="Set start date"
                        disabled={isInteractionLocked}
                      />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 font-medium">Due Date</span>
                        {isDueDateOverdue && dueDate ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <WorkspaceDatePicker
                        value={task.dueDate ?? null}
                        onChange={(value) => void handleUpdate({ dueDate: value })}
                        placeholder="Set due date"
                        tone={isDueDateOverdue ? "danger" : "default"}
                        disabled={isInteractionLocked}
                      />
                      {isDueDateOverdue && dueDate ? (
                        <p className="flex items-center gap-1 text-[11px] text-red-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Due since {dueDateLabel}
                        </p>
                      ) : null}
                  </div>
              </div>
              <div className="text-xs text-gray-400 pt-4 flex justify-between">
                  <span>Created {task.id ? format(new Date(), "MMM d, yyyy") : "-"}</span>
                  <span>Updated {format(new Date(), "MMM d, yyyy")}</span>
              </div>
            </div>

          </div>
        </div>

        </div>
      </div>

      <AlertDialog
        open={Boolean(approveDialogSubmission)}
        onOpenChange={(open) => {
          if (!open && !isReviewing) {
            setApproveDialogSubmission(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md border border-slate-200 bg-white p-0 shadow-2xl">
          <div className="border-b border-slate-200 px-6 py-5">
            <AlertDialogHeader className="gap-3 text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <AlertDialogTitle className="text-base font-semibold text-slate-900">
                    Confirm Submission Approval
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-6 text-slate-600">
                    By approving this, you verify that the work submitted in{" "}
                    Version {approveDialogSubmission?.version ?? "-"} meets the
                    required standards.{" "}
                    {approveDialogSubmission?.status === "PENDING"
                      ? "The submission will move to client review and the task will remain IN_REVIEW."
                      : "The task will be marked as DONE."}
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Approval Scope
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Submission Version {approveDialogSubmission?.version ?? "-"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                This action finalizes the current review cycle and records the
                submission as the approved deliverable for this task.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p className="text-xs leading-5 text-slate-600">
                  Approval will update the task status immediately and notify the
                  workspace that this deliverable has passed review.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4 sm:justify-between">
            <AlertDialogCancel
              disabled={isReviewing}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isReviewing}
              className="bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-400"
              onClick={(event) => {
                event.preventDefault();
                void confirmApproveSubmission();
              }}
            >
              {isReviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {approveDialogSubmission?.status === "PENDING"
                    ? "Confirm & Send to Client"
                    : "Confirm & Mark as Done"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(commentPendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingCommentId) {
            setCommentPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md border border-slate-200 bg-white p-0 shadow-2xl">
          <div className="border-b border-slate-200 px-6 py-5">
            <AlertDialogHeader className="gap-3 text-left">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <AlertDialogTitle className="text-base font-semibold text-slate-900">
                    Delete Comment
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-6 text-slate-600">
                    This action will remove the selected comment from the task detail view.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Comment Preview
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {commentPendingDelete?.actor?.fullName || "Your comment"}
              </p>
              <div
                className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-slate-600 [&_p]:inline [&_p]:m-0"
                dangerouslySetInnerHTML={{ __html: commentPendingDelete?.content || "" }}
              />
            </div>
          </div>

          <AlertDialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4 sm:justify-between">
            <AlertDialogCancel
              disabled={Boolean(deletingCommentId)}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingCommentId)}
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400"
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteComment();
              }}
            >
              {deletingCommentId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Comment
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TaskDetailModal;
