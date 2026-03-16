import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import {
  LayoutGrid,
  Calendar as CalendarIcon,
  BarChart2,
  Search,
  XCircle,
  FileSignature,
  MessageSquare,
  PlusCircle,
  Loader2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "@/shared/components/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { toast } from "sonner";
import {
  fetchBoard,
  updateTaskStatus,
  createTask,
  fetchMilestones,
  createMilestone,
  approveMilestone,
  fetchProject,
  fetchStaffCandidates,
  inviteProjectStaff,
  requestMilestoneReview,
  reviewMilestoneAsStaff,
  type WorkspaceProject,
} from "./api";
import type {
  KanbanBoard,
  KanbanColumnKey,
  Milestone,
  StaffSummary,
  Task,
} from "./types";
import { KanbanColumn } from "./components/board/KanbanColumn";
import {
  CreateTaskModal,
  type SpecFeatureOption,
} from "./components/board/CreateTaskModal";
import { TaskDetailModal } from "./components/board/TaskDetailModal";
import { MilestoneTabs } from "./components/milestone/MilestoneTabs";
import { CreateMilestoneModal } from "./components/milestone/CreateMilestoneModal";
import { CalendarView } from "./components/calendar/CalendarView";
import { MilestoneApprovalCard } from "./components/milestone/MilestoneApprovalCard";
import { ProjectOverview } from "./components/overview/ProjectOverview";
import { WorkspaceChatDrawer } from "./components/chat/WorkspaceChatDrawer";
import { calculateProgress, getLatestApprovedSubmission } from "./utils";
import { CreateDisputeModal } from "@/features/disputes/components/wizard/CreateDisputeModal";
import {
  disconnectNamespacedSocket,
  getNamespacedSocket,
} from "@/shared/realtime/socket";
import { contractsApi } from "@/features/contracts/api";
import type { Contract as ContractDetail } from "@/features/contracts/types";
import { DeliverableType } from "@/features/project-specs/types";

const initialBoard: KanbanBoard = {
  TODO: [],
  IN_PROGRESS: [],
  IN_REVIEW: [],
  DONE: [],
};
const WORKSPACE_CHAT_NAMESPACE = "/ws/workspace";

// Helper to get current user from storage (session/local)
const getCurrentUser = (): { id: string; role?: string } | null => {
  return getStoredJson<{ id: string; role?: string }>(STORAGE_KEYS.USER);
};

export function ProjectWorkspace() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<KanbanBoard>(initialBoard);
  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStaffInviteDialogOpen, setIsStaffInviteDialogOpen] = useState(false);
  const [staffCandidates, setStaffCandidates] = useState<StaffSummary[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [isLoadingStaffCandidates, setIsLoadingStaffCandidates] =
    useState(false);
  const [isInvitingStaff, setIsInvitingStaff] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSpecFeatureId, setNewSpecFeatureId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneAmount, setNewMilestoneAmount] = useState("0");
  const [newMilestoneDescription, setNewMilestoneDescription] = useState("");
  const [newMilestoneStartDate, setNewMilestoneStartDate] = useState("");
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");
  const [newMilestoneDeliverableType, setNewMilestoneDeliverableType] =
    useState<DeliverableType>(DeliverableType.SOURCE_CODE);
  const [newMilestoneRetentionAmount, setNewMilestoneRetentionAmount] =
    useState("0");
  const [
    newMilestoneAcceptanceCriteriaText,
    setNewMilestoneAcceptanceCriteriaText,
  ] = useState("");
  const [isMilestoneSubmitting, setIsMilestoneSubmitting] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"summary" | "board" | "calendar">(
    "summary",
  );
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeMilestone, setDisputeMilestone] = useState<Milestone | null>(
    null,
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatOpenRef = useRef(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    null,
  );
  const [isMyTasksFilter, setIsMyTasksFilter] = useState(false);

  // Task Detail Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  const { projectId } = useParams();

  // Get current user for role-based UI restrictions
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role?: string;
  } | null>(() => getCurrentUser());

  useEffect(() => {
    const syncCurrentUser = () => {
      setCurrentUser(getCurrentUser());
    };

    window.addEventListener("userDataUpdated", syncCurrentUser);
    return () => {
      window.removeEventListener("userDataUpdated", syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (!projectId || !currentUser?.id) {
      return;
    }

    const socket = getNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);

    const joinWorkspaceChatRoom = () => {
      socket.emit("joinProjectChat", { projectId });
    };

    const handleNewProjectMessage = (payload: unknown) => {
      const incomingProjectId =
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { projectId?: unknown }).projectId === "string"
          ? (payload as { projectId: string }).projectId
          : null;

      if (incomingProjectId !== projectId) {
        return;
      }

      if (!isChatOpenRef.current) {
        setUnreadCount((previous) => previous + 1);
      }
    };

    socket.on("connect", joinWorkspaceChatRoom);
    socket.on("newProjectMessage", handleNewProjectMessage);

    if (!socket.connected) {
      socket.connect();
    } else {
      joinWorkspaceChatRoom();
    }

    return () => {
      socket.off("connect", joinWorkspaceChatRoom);
      socket.off("newProjectMessage", handleNewProjectMessage);
      disconnectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);
    };
  }, [currentUser?.id, projectId]);

  const isProjectDisputed = useMemo(() => {
    const status = project?.status?.toUpperCase();
    return status === "DISPUTED" || Boolean(project?.hasActiveDispute);
  }, [project]);

  const currentRole = currentUser?.role?.toUpperCase();
  const isClient = currentRole === "CLIENT";
  const isBroker = currentRole === "BROKER";
  const isFreelancer = currentRole === "FREELANCER";
  const isStaff = currentRole === "STAFF";
  const isAssignedBroker = Boolean(
    isBroker && currentUser?.id && project?.brokerId === currentUser.id,
  );
  const isAssignedStaff = Boolean(
    isStaff &&
    currentUser?.id &&
    project?.staffId === currentUser.id &&
    project?.staffInviteStatus === "ACCEPTED",
  );

  // Clients, staff reviewers, and disputed projects are read-only for task mutations.
  const isReadOnly = useMemo(() => {
    return (
      currentRole === "CLIENT" || currentRole === "STAFF" || isProjectDisputed
    );
  }, [currentRole, isProjectDisputed]);

  const canApproveMilestone = useMemo(() => {
    return currentRole === "CLIENT" && !isProjectDisputed;
  }, [currentRole, isProjectDisputed]);

  const canInviteStaff = useMemo(() => {
    return isClient && !project?.staffId && !isProjectDisputed;
  }, [isClient, isProjectDisputed, project?.staffId]);

  const hasAcceptedStaff = Boolean(
    project?.staffId && project?.staffInviteStatus === "ACCEPTED",
  );

  const canReviewTaskSubmissions = useMemo(() => {
    return currentRole === "CLIENT" || isAssignedStaff;
  }, [currentRole, isAssignedStaff]);

  const assignedStaffLabel = useMemo(() => {
    if (!project?.staffId) {
      return null;
    }

    return project.staff?.fullName || `Staff (${project.staffId.slice(0, 6)})`;
  }, [project?.staff?.fullName, project?.staffId]);

  const isMilestoneStructureLocked = useMemo(() => {
    return Boolean(
      contractDetail &&
      contractDetail.status !== "ARCHIVED" &&
      Array.isArray(contractDetail.milestoneSnapshot) &&
      contractDetail.milestoneSnapshot.length > 0,
    );
  }, [contractDetail]);

  const canMutateMilestoneStructure = useMemo(() => {
    return (
      isAssignedBroker && !isProjectDisputed && !isMilestoneStructureLocked
    );
  }, [isAssignedBroker, isProjectDisputed, isMilestoneStructureLocked]);

  const projectMembers = useMemo(() => {
    if (!project) return [];
    const members = new Map<
      string,
      { id: string; name: string; role: string }
    >();
    const normalizeRole = (role: string) => {
      switch (role.toUpperCase()) {
        case "CLIENT":
          return "Client";
        case "BROKER":
          return "Broker";
        case "FREELANCER":
          return "Freelancer";
        default:
          return role;
      }
    };
    const addMember = (id: string | null | undefined, role: string) => {
      if (!id) return;
      if (members.has(id)) return;
      const label = normalizeRole(role);
      members.set(id, {
        id,
        name: `${label} (${id.slice(0, 6)})`,
        role,
      });
    };
    addMember(project.clientId, "CLIENT");
    addMember(project.brokerId, "BROKER");
    addMember(project.freelancerId ?? null, "FREELANCER");
    addMember(project.staffId ?? null, "STAFF");
    return Array.from(members.values());
  }, [project]);

  const canRaiseDisputeForMilestone = useCallback((status?: string) => {
    if (!status) return false;
    const normalized = status.toUpperCase();
    return [
      "IN_PROGRESS",
      "SUBMITTED",
      "REVISIONS_REQUIRED",
      "PENDING_STAFF_REVIEW",
      "PENDING_CLIENT_APPROVAL",
    ].includes(normalized);
  }, []);

  const specFeatureOptions = useMemo<SpecFeatureOption[]>(() => {
    const features = contractDetail?.project?.request?.spec?.features;
    if (!Array.isArray(features)) {
      return [];
    }

    return features
      .filter((feature): feature is NonNullable<(typeof features)[number]> =>
        Boolean(feature && feature.id && feature.title),
      )
      .map((feature) => ({
        id: feature.id,
        title: feature.title,
        complexity: feature.complexity,
        description: feature.description,
        acceptanceCriteriaCount: Array.isArray(feature.acceptanceCriteria)
          ? feature.acceptanceCriteria.length
          : 0,
      }));
  }, [contractDetail]);

  useEffect(() => {
    if (!newSpecFeatureId) {
      return;
    }

    const stillExists = specFeatureOptions.some(
      (feature) => feature.id === newSpecFeatureId,
    );
    if (!stillExists) {
      setNewSpecFeatureId("");
    }
  }, [newSpecFeatureId, specFeatureOptions]);

  const runtimeMilestoneStatusMap = useMemo(
    () =>
      new Map(
        milestones.flatMap((milestone) => {
          const entries: Array<[string, string]> = [
            [milestone.id, milestone.status],
          ];
          if (milestone.sourceContractMilestoneKey) {
            entries.push([
              milestone.sourceContractMilestoneKey,
              milestone.status,
            ]);
          }
          return entries;
        }),
      ),
    [milestones],
  );

  const lockedPaymentSchedule = useMemo(
    () =>
      Array.isArray(contractDetail?.milestoneSnapshot)
        ? contractDetail.milestoneSnapshot
        : [],
    [contractDetail],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: project?.currency || "USD",
        maximumFractionDigits: 2,
      }),
    [project?.currency],
  );

  useEffect(() => {
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      setLoading(false);
      return;
    }
    const loadBoard = async () => {
      try {
        setLoading(true);
        setError(null);
        let [milestoneData, boardData, projectData] = await Promise.all([
          fetchMilestones(projectId),
          fetchBoard(projectId),
          fetchProject(projectId),
        ]);
        let contractData: ContractDetail | null = null;
        const contracts = Array.isArray(projectData?.contracts)
          ? [...projectData.contracts]
          : [];
        contracts.sort((a, b) => {
          const aActivated = a.activatedAt
            ? new Date(a.activatedAt).getTime()
            : 0;
          const bActivated = b.activatedAt
            ? new Date(b.activatedAt).getTime()
            : 0;
          if (aActivated !== bActivated) return bActivated - aActivated;
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        });

        const primaryContractId = contracts[0]?.id;
        if (primaryContractId) {
          try {
            contractData = await contractsApi.getContract(primaryContractId);
          } catch (contractErr) {
            console.warn(
              "Failed to load contract snapshot for workspace:",
              contractErr,
            );
          }
        }
        console.log("API Data:", { milestoneData, boardData, projectData });
        setMilestones(milestoneData || []);
        setProject(projectData);
        setContractDetail(contractData);
        setSelectedMilestoneId(
          milestoneData && milestoneData.length > 0
            ? milestoneData[0].id
            : null,
        );
        setBoard({
          TODO: boardData?.TODO || [],
          IN_PROGRESS: boardData?.IN_PROGRESS || [],
          IN_REVIEW: boardData?.IN_REVIEW || [],
          DONE: boardData?.DONE || [],
        });
      } catch (err: any) {
        setContractDetail(null);
        setError(err?.message || "Failed to load task board");
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [projectId]);

  useEffect(() => {
    if (!isStaffInviteDialogOpen || !isClient) {
      return;
    }

    let isCancelled = false;
    setIsLoadingStaffCandidates(true);
    setSelectedStaffId("");

    fetchStaffCandidates()
      .then((staffList) => {
        if (isCancelled) {
          return;
        }

        setStaffCandidates(staffList);
        if (staffList.length > 0) {
          setSelectedStaffId(staffList[0].id);
        }
      })
      .catch((err: unknown) => {
        if (isCancelled) {
          return;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load staff candidates";
        setError(errorMessage);
        toast.error(errorMessage);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingStaffCandidates(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isClient, isStaffInviteDialogOpen]);

  const columns = useMemo<
    { key: KanbanColumnKey; title: string; description: string }[]
  >(
    () => [
      {
        key: "TODO",
        title: "To Do",
        description: "Tasks in backlog",
      },
      {
        key: "IN_PROGRESS",
        title: "In Progress",
        description: "Being worked on",
      },
      {
        key: "IN_REVIEW",
        title: "In Review",
        description: "Waiting for review",
      },
      {
        key: "DONE",
        title: "Done",
        description: "Completed tasks",
      },
    ],
    [],
  );

  const openCreateModal = () => setIsModalOpen(true);
  const openCreateMilestoneModal = () => {
    if (isMilestoneStructureLocked) {
      const message =
        "Milestone scope is locked by the contract. Amendment support is not available yet.";
      setError(message);
      toast.warning(message);
      return;
    }
    if (!isAssignedBroker) {
      const message =
        "Only the assigned broker can add or edit milestone scope.";
      setError(message);
      toast.warning(message);
      return;
    }
    if (isProjectDisputed) {
      setError(
        "Project is under dispute. Milestone changes are locked in read-only mode.",
      );
      return;
    }

    setNewMilestoneTitle("");
    setNewMilestoneAmount("0");
    setNewMilestoneDescription("");
    setNewMilestoneStartDate("");
    setNewMilestoneDueDate("");
    setNewMilestoneDeliverableType(DeliverableType.SOURCE_CODE);
    setNewMilestoneRetentionAmount("0");
    setNewMilestoneAcceptanceCriteriaText("");
    setIsMilestoneModalOpen(true);
  };
  const handleSelectMilestone = (id: string) => setSelectedMilestoneId(id);

  const handleCreateMilestone = async () => {
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      return;
    }
    const title = newMilestoneTitle.trim();
    if (!title) {
      setError("Milestone title is required.");
      return;
    }

    const amount = Number(newMilestoneAmount || "0");
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Milestone amount must be a non-negative number.");
      return;
    }

    const retentionAmount = Number(newMilestoneRetentionAmount || "0");
    if (!Number.isFinite(retentionAmount) || retentionAmount < 0) {
      setError("Retention amount must be a non-negative number.");
      return;
    }

    if (retentionAmount > amount) {
      setError("Retention amount cannot exceed the milestone amount.");
      return;
    }

    if (
      newMilestoneStartDate &&
      newMilestoneDueDate &&
      new Date(newMilestoneDueDate).getTime() <
        new Date(newMilestoneStartDate).getTime()
    ) {
      setError("Milestone due date must be after start date.");
      return;
    }

    const acceptanceCriteria = newMilestoneAcceptanceCriteriaText
      .split("\n")
      .map((criterion) => criterion.trim())
      .filter(Boolean);

    try {
      setIsMilestoneSubmitting(true);
      const created = await createMilestone({
        projectId,
        title,
        amount,
        description: newMilestoneDescription || undefined,
        startDate: newMilestoneStartDate || undefined,
        dueDate: newMilestoneDueDate || undefined,
        deliverableType: newMilestoneDeliverableType,
        retentionAmount,
        acceptanceCriteria:
          acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
      });
      setMilestones((prev) => [...prev, created]);
      setSelectedMilestoneId(created.id);
      setIsMilestoneModalOpen(false);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create milestone";
      setError(errorMessage);
      if (
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("locked")
      ) {
        toast.warning(errorMessage);
      }
    } finally {
      setIsMilestoneSubmitting(false);
    }
  };

  const formatOptionalDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const formatDeliverableType = (value?: string | null) => {
    if (!value) return "Other";
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const filteredBoard = useMemo(() => {
    if (!selectedMilestoneId) return board;
    const filterByMilestone = (tasks: Task[]) =>
      tasks.filter((t) => t.milestoneId === selectedMilestoneId);
    return {
      TODO: filterByMilestone(board.TODO),
      IN_PROGRESS: filterByMilestone(board.IN_PROGRESS),
      IN_REVIEW: filterByMilestone(board.IN_REVIEW),
      DONE: filterByMilestone(board.DONE),
    };
  }, [board, selectedMilestoneId]);

  const tasksByMilestone = useMemo(() => {
    const map: Record<string, Task[]> = {};
    ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].forEach((col) => {
      board[col as KanbanColumnKey].forEach((t) => {
        if (!t.milestoneId) return;
        if (!map[t.milestoneId]) map[t.milestoneId] = [];
        map[t.milestoneId].push(t);
      });
    });
    return map;
  }, [board]);
  const activeMilestone = selectedMilestoneId
    ? milestones.find((m) => m.id === selectedMilestoneId)
    : null;
  const activeTasks =
    selectedMilestoneId && tasksByMilestone[selectedMilestoneId]
      ? tasksByMilestone[selectedMilestoneId]
      : [];
  const activeProgress = calculateProgress(activeTasks);

  // Get all tasks in a flat array for calendar view
  const allTasks = useMemo(() => {
    const tasks: Task[] = [];
    ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].forEach((col) => {
      tasks.push(...board[col as KanbanColumnKey]);
    });
    return tasks;
  }, [board]);

  // Derive unique assignees for filter
  const uniqueAssignees = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; avatar?: string }
    >();
    allTasks.forEach((t) => {
      if (t.assignee && t.assignee.id) {
        map.set(t.assignee.id, {
          id: t.assignee.id,
          name: t.assignee.fullName || "Unknown",
          avatar: t.assignee.avatarUrl,
        });
      }
    });
    return Array.from(map.values());
  }, [allTasks]);

  // Filter Logic: processedBoard applies Search & Text filters on top of Milestone filter
  const processedBoard = useMemo(() => {
    let result = { ...filteredBoard }; // Start with milestone-filtered board

    // 1. Text Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = {
        TODO: result.TODO.filter((t) => t.title.toLowerCase().includes(query)),
        IN_PROGRESS: result.IN_PROGRESS.filter((t) =>
          t.title.toLowerCase().includes(query),
        ),
        IN_REVIEW: result.IN_REVIEW.filter((t) =>
          t.title.toLowerCase().includes(query),
        ),
        DONE: result.DONE.filter((t) => t.title.toLowerCase().includes(query)),
      };
    }

    // 2. Assignee Filter
    if (selectedAssigneeId) {
      const filterByAssignee = (list: Task[]) =>
        list.filter((t) => t.assignee?.id === selectedAssigneeId);
      result = {
        TODO: filterByAssignee(result.TODO),
        IN_PROGRESS: filterByAssignee(result.IN_PROGRESS),
        IN_REVIEW: filterByAssignee(result.IN_REVIEW),
        DONE: filterByAssignee(result.DONE),
      };
    } else if (isMyTasksFilter && currentUser?.id) {
      // "Only My Issues" filter
      const filterByMe = (list: Task[]) =>
        list.filter((t) => t.assignee?.id === currentUser.id);
      result = {
        TODO: filterByMe(result.TODO),
        IN_PROGRESS: filterByMe(result.IN_PROGRESS),
        IN_REVIEW: filterByMe(result.IN_REVIEW),
        DONE: filterByMe(result.DONE),
      };
    }

    return result;
  }, [
    filteredBoard,
    searchQuery,
    selectedAssigneeId,
    isMyTasksFilter,
    currentUser,
  ]);

  // Handle viewing task details (from Calendar or Kanban)
  const handleViewTaskDetails = (taskId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsTaskDetailOpen(true);
    }
  };

  // Handle closing task detail modal
  const handleCloseTaskDetail = () => {
    setIsTaskDetailOpen(false);
    setSelectedTask(null);
  };

  // Handle task update from modal
  const handleTaskUpdate = (updatedTask: Task) => {
    setSelectedTask((currentTask) => {
      if (!currentTask || currentTask.id !== updatedTask.id) {
        return updatedTask;
      }

      return {
        ...currentTask,
        ...updatedTask,
        submissions: updatedTask.submissions ?? currentTask.submissions,
      };
    });

    // Update board state
    setBoard((prevBoard) => {
      const newBoard = { ...prevBoard };

      // Find and replace the task in the board columns
      Object.keys(newBoard).forEach((key) => {
        const colKey = key as KanbanColumnKey;
        newBoard[colKey] = newBoard[colKey].map((t) =>
          t.id === updatedTask.id
            ? {
                ...t,
                ...updatedTask,
                submissions: updatedTask.submissions ?? t.submissions,
              }
            : t,
        );

        // Handle status change if column doesn't match
        if (updatedTask.status !== colKey) {
          // If task is in this column but status changed, logic is complex
          // For simplicity, we might reload board or carefully move it
          // But existing drag-drop logic handles status changes well.
          // If status changed via modal dropdown:
          if (newBoard[colKey].find((t) => t.id === updatedTask.id)) {
            // Remove from old column
            newBoard[colKey] = newBoard[colKey].filter(
              (t) => t.id !== updatedTask.id,
            );
          }
        }
      });

      // If status changed, ensure it's in the new column
      if (!newBoard[updatedTask.status].find((t) => t.id === updatedTask.id)) {
        newBoard[updatedTask.status].push(updatedTask);
      }

      return newBoard;
    });
  };

  const handleTaskCreatedFromChat = useCallback((incomingTask: Task) => {
    const normalizedTask: Task = {
      ...incomingTask,
      status: incomingTask.status ?? "TODO",
    };

    setBoard((prevBoard) => {
      const columnKeys: KanbanColumnKey[] = [
        "TODO",
        "IN_PROGRESS",
        "IN_REVIEW",
        "DONE",
      ];
      const cleanedBoard = columnKeys.reduce<KanbanBoard>(
        (acc, columnKey) => {
          acc[columnKey] = prevBoard[columnKey].filter(
            (task) => task.id !== normalizedTask.id,
          );
          return acc;
        },
        { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] },
      );

      return {
        ...cleanedBoard,
        [normalizedTask.status]: [
          normalizedTask,
          ...cleanedBoard[normalizedTask.status],
        ],
      };
    });

    setSelectedTask((currentTask) =>
      currentTask?.id === normalizedTask.id ? normalizedTask : currentTask,
    );
  }, []);

  // Handle milestone approval (Client/Broker only)
  const handleApproveMilestone = async (
    milestoneId: string,
    feedback?: string,
  ) => {
    if (isProjectDisputed) {
      throw new Error(
        "Project is under dispute. Milestone approval is locked.",
      );
    }
    try {
      setError(null);
      const result = await approveMilestone(milestoneId, feedback);

      // Update the milestone status in local state
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId ? { ...m, ...result.milestone } : m,
        ),
      );

      console.log(
        `[Milestone] "${result.milestone.title}" approved. Funds released: ${result.fundsReleased}`,
      );

      // Show success message (you could use a toast here)
      alert(result.message);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve milestone";
      setError(errorMessage);
      throw err; // Re-throw so the modal can handle it
    }
  };

  const handleRequestMilestoneReview = async (milestoneId: string) => {
    if (isProjectDisputed) {
      throw new Error("Project is under dispute. Milestone review is locked.");
    }

    try {
      setError(null);
      const updatedMilestone = await requestMilestoneReview(milestoneId);
      setMilestones((prev) =>
        prev.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, ...updatedMilestone }
            : milestone,
        ),
      );
      toast.success("Milestone review request sent.");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to request milestone review";
      setError(errorMessage);
      throw err;
    }
  };

  const handleStaffReviewMilestone = async (
    milestoneId: string,
    payload: { recommendation: "ACCEPT" | "REJECT"; note: string },
  ) => {
    if (isProjectDisputed) {
      throw new Error("Project is under dispute. Milestone review is locked.");
    }

    try {
      setError(null);
      const updatedMilestone = await reviewMilestoneAsStaff(
        milestoneId,
        payload,
      );
      setMilestones((prev) =>
        prev.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, ...updatedMilestone }
            : milestone,
        ),
      );
      toast.success(
        payload.recommendation === "ACCEPT"
          ? "Milestone forwarded to client approval."
          : "Milestone sent back to in-progress.",
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to review milestone";
      setError(errorMessage);
      throw err;
    }
  };

  const handleInviteStaff = async () => {
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      return;
    }

    if (!selectedStaffId) {
      setError("Please select a staff reviewer.");
      return;
    }

    try {
      setIsInvitingStaff(true);
      setError(null);
      const updatedProject = await inviteProjectStaff(
        projectId,
        selectedStaffId,
      );
      setProject(updatedProject);
      setIsStaffInviteDialogOpen(false);
      toast.success("Staff invite sent.");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to invite staff";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsInvitingStaff(false);
    }
  };

  // Handle raising a dispute (UI only)
  const handleRaiseDispute = (milestoneId: string) => {
    if (!project) {
      toast.error("Project data is not loaded yet.");
      return;
    }
    if (!currentUser?.id) {
      toast.error("User session missing. Please sign in again.");
      return;
    }
    const milestone = milestones.find((item) => item.id === milestoneId);
    if (!milestone) {
      toast.error("Milestone not found.");
      return;
    }
    setDisputeMilestone(milestone);
    setIsDisputeModalOpen(true);
  };

  const closeDisputeModal = () => {
    setIsDisputeModalOpen(false);
    setDisputeMilestone(null);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (isReadOnly) {
      if (isProjectDisputed) {
        toast.warning(
          "Task movement is locked while this project is in dispute.",
        );
      }
      return;
    }

    const { destination, source, draggableId } = result;
    if (!destination) return;

    const fromColumn = source.droppableId as KanbanColumnKey;
    const toColumn = destination.droppableId as KanbanColumnKey;

    if (fromColumn === toColumn && destination.index === source.index) {
      return;
    }

    // Save previous state for rollback
    const prevBoard: KanbanBoard = (
      ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as KanbanColumnKey[]
    ).reduce(
      (acc, key) => ({
        ...acc,
        [key]: board[key].map((t) => ({ ...t })),
      }),
      { ...initialBoard },
    );

    // Optimistic UI update - move the card immediately
    const nextBoard: KanbanBoard = {
      ...prevBoard,
      [fromColumn]: [...prevBoard[fromColumn]],
      [toColumn]: [...prevBoard[toColumn]],
    };

    const [movedTask] = nextBoard[fromColumn].splice(source.index, 1);
    if (!movedTask) return;

    const hasApprovedSubmission = Boolean(
      getLatestApprovedSubmission(movedTask),
    );
    if (toColumn === "DONE") {
      if (isFreelancer) {
        toast.warning(
          "Freelancer không thể kéo task trực tiếp sang DONE. Hãy tạo submission để chờ duyệt.",
        );
        return;
      }

      if (!hasApprovedSubmission) {
        toast.warning(
          "Không thể chuyển sang DONE khi chưa có bài nộp được duyệt!",
        );
        return;
      }
    }

    const updatedTask = { ...movedTask, status: toColumn };
    nextBoard[toColumn].splice(destination.index, 0, updatedTask);

    setBoard(nextBoard);

    try {
      // Call API and get updated milestone progress
      const response = await updateTaskStatus(draggableId, toColumn);
      setError(null);

      // Real-time progress update
      // If the task moved to/from DONE column, the backend recalculated progress
      // Update the milestones state to reflect the new progress
      if (response.milestoneId) {
        setMilestones((prevMilestones) =>
          prevMilestones.map((milestone) =>
            milestone.id === response.milestoneId
              ? {
                  ...milestone,
                  // Store progress info in milestone for display
                  // (Milestone type doesn't have progress field, but UI uses tasksByMilestone)
                }
              : milestone,
          ),
        );

        // Log for debugging
        console.log(
          `[Milestone] ${response.milestoneId} progress updated: ${response.milestoneProgress}% (${response.completedTasks}/${response.totalTasks})`,
        );
      }
    } catch (err: any) {
      // Rollback on error
      setBoard(prevBoard);
      setError(err?.message || "Failed to update task status");
    }
  };

  const handleCreateTask = async () => {
    if (isProjectDisputed) {
      setError(
        "Project is under dispute. Task creation is locked in read-only mode.",
      );
      return;
    }
    const title = newTitle.trim();
    if (!title) {
      setError("Title is required");
      return;
    }
    if (!projectId) {
      setError("No project selected. Please choose a project from the list.");
      return;
    }
    if (!selectedMilestoneId) {
      setError("Please create a milestone before adding tasks.");
      return;
    }
    if (!newSpecFeatureId && specFeatureOptions.length > 0) {
      toast.warning(
        "Task is not linked to a spec feature. Consider selecting one to avoid scope drift.",
      );
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const created = await createTask({
        title,
        description: newDescription,
        projectId,
        milestoneId: selectedMilestoneId,
        specFeatureId: newSpecFeatureId || undefined,
        startDate: newStartDate || undefined,
        dueDate: newDueDate || undefined,
      });

      setBoard((prev) => ({
        ...prev,
        TODO: [created, ...prev.TODO],
      }));

      // Reset form fields
      setIsModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewSpecFeatureId("");
      setNewStartDate("");
      setNewDueDate("");
    } catch (err: any) {
      setError(err?.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Project Task Board
          </h1>
          <p className="text-gray-600">
            Project ID:{" "}
            <span className="font-mono text-sky-600">{projectId || "N/A"}</span>
          </p>
          {project?.staffInviteStatus === "PENDING" && (
            <p className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Dang cho Staff xac nhan...
            </p>
          )}
          {project?.staffInviteStatus === "ACCEPTED" && assignedStaffLabel && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Staff: {assignedStaffLabel}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canInviteStaff && (
            <button
              onClick={() => setIsStaffInviteDialogOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
            >
              <UserPlus className="h-4 w-4" />
              Invite Staff
            </button>
          )}
          {/* View Contract Button */}
          {project && project.contracts && project.contracts.length > 0 && (
            <button
              onClick={() => {
                const contractId = project?.contracts?.[0].id;
                if (!contractId) return;
                const role = currentUser?.role?.toLowerCase();
                navigate(`/${role}/contracts/${contractId}`);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <FileSignature className="h-4 w-4" />
              Contract
            </button>
          )}

          {/* View Switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("summary")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "summary"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              Summary
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "board"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </button>
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-600 hover:text-gray-900"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-100">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
          {canMutateMilestoneStructure && (
            <button
              onClick={openCreateMilestoneModal}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <PlusCircle className="h-4 w-4" />
              Add Milestone
            </button>
          )}
          {/* Hide New Task button in read-only mode */}
          {!isReadOnly && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
            >
              + New Task
            </button>
          )}
        </div>
      </div>

      {isProjectDisputed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This project has active dispute cases. Workspace is read-only for task
          changes, but dispute workflows remain available.
        </div>
      )}

      {isMilestoneStructureLocked && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {contractDetail?.activatedAt
            ? "Milestone structure is locked by the activated contract. Runtime progress updates remain available."
            : "Milestone structure is locked by the live contract review/signing flow. Review the frozen contract before activation."}{" "}
          Amendment support is not available yet.
        </div>
      )}

      {lockedPaymentSchedule.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Payment schedule (locked)
              </h2>
              <p className="text-xs text-slate-500">
                Source of truth from contract snapshot
                {contractDetail?.activatedAt
                  ? ` · Activated ${formatOptionalDate(contractDetail.activatedAt)}`
                  : ""}
              </p>
            </div>
            <div className="text-xs text-slate-500">
              {lockedPaymentSchedule.length} milestone
              {lockedPaymentSchedule.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {lockedPaymentSchedule.map((entry, index) => {
              const runtimeStatus =
                runtimeMilestoneStatusMap.get(entry.contractMilestoneKey) ||
                "PENDING";
              return (
                <div
                  key={entry.contractMilestoneKey}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {typeof entry.sortOrder === "number"
                        ? `#${entry.sortOrder} `
                        : `${index + 1}. `}
                      {entry.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDeliverableType(entry.deliverableType)}
                      {entry.startDate
                        ? ` · Starts ${formatOptionalDate(entry.startDate)}`
                        : ""}
                      {entry.dueDate
                        ? ` · Due ${formatOptionalDate(entry.dueDate)}`
                        : ""}
                      {typeof entry.retentionAmount === "number" &&
                      entry.retentionAmount > 0
                        ? ` · Retention ${currencyFormatter.format(entry.retentionAmount)}`
                        : ""}
                    </p>
                    {Array.isArray(entry.acceptanceCriteria) &&
                    entry.acceptanceCriteria.length > 0 ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        Approval checks: {entry.acceptanceCriteria.join(" • ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 sm:text-right">
                    {currencyFormatter.format(Number(entry.amount || 0))}
                  </div>
                  <div className="text-xs text-slate-600 sm:text-right">
                    {runtimeStatus}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      ) : milestones.length === 0 ? (
        <div className="border border-dashed border-teal-300 rounded-2xl p-6 bg-teal-50/40 text-center space-y-3">
          <p className="text-slate-800 text-lg font-semibold">
            No milestones yet
          </p>
          <p className="text-sm text-gray-600">
            {isReadOnly
              ? "The team will create milestones soon. Check back later."
              : isMilestoneStructureLocked
                ? "Milestone scope is locked by the contract. Amendment support is not available yet."
                : isAssignedBroker
                  ? "Create your first milestone to start adding tasks for this project."
                  : "Waiting for broker to define milestone scope."}
          </p>
          {/* Hide Create Milestone button in read-only mode */}
          {canMutateMilestoneStructure && (
            <button
              onClick={openCreateMilestoneModal}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              + Create Milestone
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Milestone Approval Card - Show when progress is 100% */}
          {activeMilestone &&
            activeProgress === 100 &&
            activeMilestone.status !== "COMPLETED" &&
            activeMilestone.status !== "PAID" && (
              <MilestoneApprovalCard
                milestone={activeMilestone}
                tasks={activeTasks}
                progress={activeProgress}
                currentRole={currentRole}
                isAssignedStaff={isAssignedStaff}
                hasAcceptedStaff={hasAcceptedStaff}
                assignedStaffLabel={assignedStaffLabel}
                onApprove={handleApproveMilestone}
                onRequestReview={handleRequestMilestoneReview}
                onStaffReview={handleStaffReviewMilestone}
                onRaiseDispute={handleRaiseDispute}
                canApprove={canApproveMilestone}
                currency={project?.currency ?? "USD"}
              />
            )}

          <MilestoneTabs
            milestones={milestones}
            selectedId={selectedMilestoneId || undefined}
            tasksMap={tasksByMilestone}
            onSelect={handleSelectMilestone}
            onAdd={
              canMutateMilestoneStructure ? openCreateMilestoneModal : undefined
            }
          />

          {activeMilestone && viewMode === "board" && (
            <div className="border border-gray-200 bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-900">
                  {activeMilestone.title}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span>{activeProgress}%</span>
                  {canRaiseDisputeForMilestone(activeMilestone.status) && (
                    <button
                      onClick={() => handleRaiseDispute(activeMilestone.id)}
                      className="ml-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:border-red-300 hover:bg-red-100"
                    >
                      Raise Dispute
                    </button>
                  )}
                </div>
              </div>
              {activeMilestone.description ? (
                <p className="text-xs text-gray-600 mb-2">
                  {activeMilestone.description}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-2">No description</p>
              )}
              <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Deliverable
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatDeliverableType(activeMilestone.deliverableType)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Date window
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {formatOptionalDate(activeMilestone.startDate) || "Not set"}
                    {" -> "}
                    {formatOptionalDate(activeMilestone.dueDate) || "Not set"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Retention
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {currencyFormatter.format(
                      Number(activeMilestone.retentionAmount || 0),
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Approval checks
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {activeMilestone.acceptanceCriteria?.length || 0}
                  </p>
                </div>
              </div>
              {Array.isArray(activeMilestone.acceptanceCriteria) &&
              activeMilestone.acceptanceCriteria.length > 0 ? (
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                    Acceptance criteria
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {activeMilestone.acceptanceCriteria.map(
                      (criterion, criteriaIndex) => (
                        <li
                          key={`${activeMilestone.id}-criterion-${criteriaIndex}`}
                        >
                          • {criterion}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all"
                  style={{ width: `${activeProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Conditional View Rendering */}
          {viewMode === "summary" ? (
            <ProjectOverview milestones={milestones} tasks={allTasks} />
          ) : viewMode === "board" ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              {/* JIRA STYLE TOOLBAR */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                {/* LEFT: SEARCH & QUICK FILTERS */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {/* Search Input (Integrated look) */}
                  <div className="relative group w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-transparent hover:bg-slate-100 focus:bg-white focus:border-teal-500 rounded-md text-sm transition-all outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400"
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                  {/* "Only My Issues" Button */}
                  {!isReadOnly && (
                    <button
                      onClick={() => {
                        const newState = !isMyTasksFilter;
                        setIsMyTasksFilter(newState);
                        if (newState) setSelectedAssigneeId(null); // Clear specific assignee if selecting "Mine"
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                        isMyTasksFilter
                          ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span className="relative flex h-2 w-2">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75 ${isMyTasksFilter ? "block" : "hidden"}`}
                        ></span>
                        <span
                          className={`relative inline-flex rounded-full h-2 w-2 ${isMyTasksFilter ? "bg-teal-500" : "bg-slate-400"}`}
                        ></span>
                      </span>
                      My Issues
                    </button>
                  )}
                </div>

                {/* RIGHT: ASSIGNEES & CLEAR */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center -space-x-2 overflow-hidden py-1 pl-1">
                    {uniqueAssignees.map((assignee) => {
                      const isSelected = selectedAssigneeId === assignee.id;
                      return (
                        <button
                          key={assignee.id}
                          onClick={() => {
                            setSelectedAssigneeId(
                              isSelected ? null : assignee.id,
                            );
                            setIsMyTasksFilter(false); // Disable "My Issues" if picking specific person
                          }}
                          className={`relative transition-transform hover:z-10 hover:scale-110 focus:outline-none ${isSelected ? "z-20 scale-110" : ""}`}
                          title={assignee.name}
                        >
                          <div
                            className={`h-8 w-8 rounded-full border-2 border-white ${isSelected ? "ring-2 ring-teal-500 ring-offset-2" : ""}`}
                          >
                            <img
                              src={
                                assignee.avatar ||
                                `https://ui-avatars.com/api/?name=${assignee.name}&background=random`
                              }
                              alt={assignee.name}
                              className="h-full w-full rounded-full object-cover bg-slate-200"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Clear All Button (Only show if filters active) */}
                  {(searchQuery || selectedAssigneeId || isMyTasksFilter) && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedAssigneeId(null);
                        setIsMyTasksFilter(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="flex xl:grid xl:grid-cols-4 gap-4 overflow-x-auto xl:overflow-visible pb-4 h-full items-start">
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="min-w-[280px] xl:min-w-0 xl:w-auto flex-shrink-0"
                  >
                    <KanbanColumn
                      key={col.key}
                      columnId={col.key}
                      title={col.title}
                      description={col.description}
                      tasks={processedBoard[col.key]}
                      onAddTask={openCreateModal}
                      onTaskClick={handleViewTaskDetails}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </DragDropContext>
          ) : (
            <CalendarView
              tasks={allTasks}
              onViewTaskDetails={handleViewTaskDetails}
            />
          )}
        </>
      )}

      <Dialog
        open={isStaffInviteDialogOpen}
        onOpenChange={setIsStaffInviteDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Staff</DialogTitle>
            <DialogDescription>
              Chon mot staff reviewer de giam sat milestone review cho du an
              nay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Staff reviewer
            </label>
            <Select
              value={selectedStaffId}
              onValueChange={setSelectedStaffId}
              disabled={
                isLoadingStaffCandidates || staffCandidates.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingStaffCandidates
                      ? "Dang tai staff..."
                      : "Chon staff reviewer"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {staffCandidates.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.fullName} - {staff.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {staffCandidates.length === 0 && !isLoadingStaffCandidates && (
              <p className="text-sm text-slate-500">
                Hien chua co staff reviewer kha dung.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStaffInviteDialogOpen(false)}
              disabled={isInvitingStaff}
            >
              Huy
            </Button>
            <Button
              type="button"
              onClick={handleInviteStaff}
              disabled={isInvitingStaff || !selectedStaffId}
            >
              {isInvitingStaff ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Dang gui...
                </>
              ) : (
                "Gui loi moi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateMilestoneModal
        open={isMilestoneModalOpen}
        title={newMilestoneTitle}
        amount={newMilestoneAmount}
        description={newMilestoneDescription}
        startDate={newMilestoneStartDate}
        dueDate={newMilestoneDueDate}
        deliverableType={newMilestoneDeliverableType}
        retentionAmount={newMilestoneRetentionAmount}
        acceptanceCriteriaText={newMilestoneAcceptanceCriteriaText}
        isSubmitting={isMilestoneSubmitting}
        onClose={() => setIsMilestoneModalOpen(false)}
        onSubmit={handleCreateMilestone}
        onChangeTitle={setNewMilestoneTitle}
        onChangeAmount={setNewMilestoneAmount}
        onChangeDescription={setNewMilestoneDescription}
        onChangeStartDate={setNewMilestoneStartDate}
        onChangeDueDate={setNewMilestoneDueDate}
        onChangeDeliverableType={setNewMilestoneDeliverableType}
        onChangeRetentionAmount={setNewMilestoneRetentionAmount}
        onChangeAcceptanceCriteriaText={setNewMilestoneAcceptanceCriteriaText}
      />

      <CreateTaskModal
        open={isModalOpen}
        title={newTitle}
        description={newDescription}
        milestoneId={selectedMilestoneId || undefined}
        specFeatures={specFeatureOptions}
        specFeatureId={newSpecFeatureId}
        startDate={newStartDate}
        dueDate={newDueDate}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        onChangeTitle={setNewTitle}
        onChangeDescription={setNewDescription}
        onChangeSpecFeature={setNewSpecFeatureId}
        onChangeStartDate={setNewStartDate}
        onChangeDueDate={setNewDueDate}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isTaskDetailOpen}
        task={selectedTask}
        specFeatures={specFeatureOptions}
        canReviewSubmissions={canReviewTaskSubmissions}
        allowTaskStatusEditing={!isReadOnly && !isStaff}
        onClose={handleCloseTaskDetail}
        onUpdate={handleTaskUpdate}
      />

      {project && disputeMilestone && currentUser?.id && (
        <CreateDisputeModal
          isOpen={isDisputeModalOpen}
          onClose={closeDisputeModal}
          milestoneId={disputeMilestone.id}
          projectId={project.id}
          milestoneTitle={disputeMilestone.title}
          milestoneStatus={disputeMilestone.status}
          projectTitle={project.title ?? "Project"}
          currentUserId={currentUser.id}
          projectMembers={projectMembers}
        />
      )}

      <WorkspaceChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        projectId={projectId}
        currentUserId={currentUser?.id}
        canReviewTasks={canReviewTaskSubmissions}
        defaultMilestoneId={selectedMilestoneId}
        projectTitle="Workspace Chat"
        showCommandPopover={true}
        onTaskCreated={handleTaskCreatedFromChat}
      />
    </div>
  );
}
