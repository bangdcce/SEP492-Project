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
  WalletCards,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Spinner } from "@/shared/components/ui";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { toast } from "sonner";
import { completeStripeMilestoneFunding } from "@/features/payments/api";
import {
  fetchBoardWorkspaceData,
  updateTaskStatus,
  createTask,
  createTaskSubmission,
  reviewSubmission,
  createMilestone,
  approveMilestone,
  rejectMilestone,
  fetchProject,
  requestMilestoneReview,
  reviewMilestoneAsBroker,
  type WorkspaceProject,
} from "./api";
import type {
  KanbanBoard,
  KanbanColumnKey,
  Milestone,
  ProjectTaskRealtimeEvent,
  Task,
  TaskPriority,
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
import { MilestoneFundingCard } from "./components/milestone/MilestoneFundingCard";
import { ProjectReviewActionsCard } from "./components/review/ProjectReviewActionsCard";
import { ProjectOverview } from "./components/overview/ProjectOverview";
import { WorkspaceChatDrawer } from "./components/chat/WorkspaceChatDrawer";
import { calculateProgress, getLatestApprovedSubmission } from "./utils";
import { buildMilestoneInteractionGateMap } from "./milestone-interaction";
import {
  BOARD_COLUMNS,
  buildBoardMeta,
  createEmptyBoard,
  moveTaskInBoard,
  removeTaskFromBoard,
  upsertTaskInBoard,
} from "./board-state";
import { CreateDisputeModal } from "@/features/disputes/components/wizard/CreateDisputeModal";
import {
  connectSocket,
  connectNamespacedSocket,
  disconnectNamespacedSocket,
} from "@/shared/realtime/socket";
import { contractsApi } from "@/features/contracts/api";
import type { Contract as ContractDetail } from "@/features/contracts/types";
import { DeliverableType } from "@/features/project-specs/types";
import type { MilestoneFundingResult } from "@/features/payments/types";
import {
  normalizeSupportedBillingRole,
  resolveBillingLabel,
  resolveBillingRoute,
} from "@/features/payments/roleRoutes";

const WORKSPACE_CHAT_NAMESPACE = "/ws/workspace";
type WorkspaceViewMode = "summary" | "board" | "calendar";

const parseWorkspaceViewMode = (value: string | null): WorkspaceViewMode => {
  if (value === "board" || value === "calendar") {
    return value;
  }

  return "summary";
};
const TASKS_REALTIME_NAMESPACE = "/ws/tasks";
const TASK_CREATION_ALLOWED_MILESTONE_STATUSES = new Set<Milestone["status"]>([
  "PENDING",
  "IN_PROGRESS",
  "REVISIONS_REQUIRED",
]);
const TASK_CREATION_LOCK_MESSAGE =
  "Tasks can only be added while the milestone is pending, in progress, or revisions required.";
const TASK_MUTATION_LOCK_MESSAGE =
  "Task changes are locked because this milestone is in review, completed, paid, or locked.";
const WORKSPACE_TASK_STATUS_FILTER_OPTIONS: Array<{ value: KanbanColumnKey | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "DONE", label: "Done" },
];
const WORKSPACE_TASK_PRIORITY_FILTER_OPTIONS: Array<{
  value: TaskPriority | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "All priorities" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];
const DISPUTE_PARTICIPANT_ROLES = new Set(["CLIENT", "BROKER", "FREELANCER"]);

const normalizeMilestoneKey = (value?: string | null) =>
  value == null ? null : String(value);

const normalizeTaskDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isTaskOverdue = (task: Task): boolean => {
  if (task.status === "DONE") {
    return false;
  }

  const dueDate = normalizeTaskDate(task.dueDate ?? task.startDate ?? null);
  if (!dueDate) {
    return false;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate.getTime() < now.getTime();
};

const formatMilestoneRuntimeStatus = (status?: string | null) => {
  switch (status?.toUpperCase()) {
    case "PENDING_STAFF_REVIEW":
      return "Broker review";
    case "PENDING_CLIENT_APPROVAL":
      return "Waiting for client approval";
    case "PAID":
      return "Paid & released";
    case "REVISIONS_REQUIRED":
      return "Revisions required";
    case "IN_PROGRESS":
      return "In progress";
    default:
      return status ?? "PENDING";
  }
};

type ProjectWorkspaceMember = {
  id: string;
  name: string;
  fullName: string;
  role: "CLIENT" | "BROKER" | "FREELANCER" | "STAFF";
  avatarUrl?: string;
};

// Helper to get current user from storage (session/local)
const getCurrentUser = (): { id: string; role?: string; email?: string | null } | null => {
  return getStoredJson<{ id: string; role?: string; email?: string | null }>(
    STORAGE_KEYS.USER,
  );
};

export function ProjectWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [board, setBoard] = useState<KanbanBoard>(() => createEmptyBoard());
  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [contractDetail, setContractDetail] = useState<ContractDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeMilestone, setDisputeMilestone] = useState<Milestone | null>(
    null,
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatOpenRef = useRef(false);
  const processedStripeSessionIdsRef = useRef<Set<string>>(new Set());

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    null,
  );
  const [isMyTasksFilter, setIsMyTasksFilter] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    KanbanColumnKey | "ALL"
  >("ALL");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<
    TaskPriority | "ALL"
  >("ALL");
  const [isOverdueOnlyFilter, setIsOverdueOnlyFilter] = useState(false);
  const [showSubtasksInWorkspaceViews, setShowSubtasksInWorkspaceViews] =
    useState(true);

  // Task Detail Modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isQuickActionRunning, setIsQuickActionRunning] = useState(false);
  const [quickActionTitle, setQuickActionTitle] = useState<string | null>(null);
  const [quickActionSteps, setQuickActionSteps] = useState<
    Array<{
      label: string;
      status: "pending" | "running" | "done" | "error";
      note?: string;
    }>
  >([]);
  const boardViewportRef = useRef<HTMLDivElement | null>(null);
  const [boardViewportHeight, setBoardViewportHeight] = useState<number | null>(
    null,
  );

  const { projectId } = useParams();
  const location = useLocation();

  const viewMode = useMemo<WorkspaceViewMode>(
    () => parseWorkspaceViewMode(searchParams.get("view")),
    [searchParams],
  );
  const requestedMilestoneId = useMemo(
    () => normalizeMilestoneKey(searchParams.get("milestone")),
    [searchParams],
  );
  const selectedMilestoneId = useMemo(() => {
    if (milestones.length === 0) {
      return null;
    }

    const requestedMilestoneExists = Boolean(
      requestedMilestoneId &&
        milestones.some(
          (milestone) => normalizeMilestoneKey(milestone.id) === requestedMilestoneId,
        ),
    );

    if (requestedMilestoneId && requestedMilestoneExists) {
      return requestedMilestoneId;
    }

    return milestones[0]?.id ?? null;
  }, [milestones, requestedMilestoneId]);

  const updateWorkspaceSearchParams = useCallback(
    ({
      nextViewMode,
      nextMilestoneId,
    }: {
      nextViewMode?: WorkspaceViewMode;
      nextMilestoneId?: string | null;
    }) => {
      const resolvedViewMode = nextViewMode ?? viewMode;
      const resolvedMilestoneId =
        nextMilestoneId === undefined ? selectedMilestoneId : nextMilestoneId;
      const nextSearchParams = new URLSearchParams(searchParams);

      nextSearchParams.set("view", resolvedViewMode);

      if (resolvedMilestoneId) {
        nextSearchParams.set("milestone", resolvedMilestoneId);
      } else {
        nextSearchParams.delete("milestone");
      }

      if (nextSearchParams.toString() !== searchParams.toString()) {
        setSearchParams(nextSearchParams, { replace: true });
      }
    },
    [searchParams, selectedMilestoneId, setSearchParams, viewMode],
  );

  const setSelectedMilestoneId = useCallback(
    (id: string | null) => {
      updateWorkspaceSearchParams({ nextMilestoneId: id });
    },
    [updateWorkspaceSearchParams],
  );

  const setViewMode = useCallback(
    (nextViewMode: WorkspaceViewMode) => {
      updateWorkspaceSearchParams({ nextViewMode });
    },
    [updateWorkspaceSearchParams],
  );

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

    const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);

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

    if (socket.connected) {
      joinWorkspaceChatRoom();
    }

    return () => {
      socket.emit("leaveProjectChat", { projectId });
      socket.off("connect", joinWorkspaceChatRoom);
      socket.off("newProjectMessage", handleNewProjectMessage);
    };
  }, [currentUser?.id, projectId]);

  useEffect(() => {
    if (viewMode !== "board") {
      return;
    }

    const viewportElement = boardViewportRef.current;
    if (!viewportElement) {
      return;
    }

    let animationFrameId: number | null = null;
    const mainElement = viewportElement.closest("main");
    const footerElement =
      mainElement instanceof HTMLElement
        ? mainElement.querySelector("footer")
        : null;

    const measureBoardViewport = () => {
      const element = boardViewportRef.current;
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const footerHeight =
        footerElement instanceof HTMLElement ? footerElement.offsetHeight : 0;
      const bottomReserve = Math.max(208, footerHeight + 56);
      const availableHeight = Math.floor(window.innerHeight - rect.top - bottomReserve);
      const nextHeight = Math.max(332, Math.min(388, availableHeight));

      setBoardViewportHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    };

    const scheduleMeasurement = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        measureBoardViewport();
      });
    };

    scheduleMeasurement();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleMeasurement();
          })
        : null;

    resizeObserver?.observe(viewportElement);
    if (mainElement instanceof HTMLElement) {
      resizeObserver?.observe(mainElement);
    }
    if (footerElement instanceof HTMLElement) {
      resizeObserver?.observe(footerElement);
    }

    window.addEventListener("resize", scheduleMeasurement);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
    };
  }, [
    viewMode,
    selectedMilestoneId,
    loading,
    error,
    milestones.length,
  ]);

  const isProjectDisputed = useMemo(() => {
    const status = project?.status?.toUpperCase();
    return status === "DISPUTED" || Boolean(project?.hasActiveDispute);
  }, [project]);

  const isProjectCanceled = useMemo(() => {
    const status = project?.status?.toUpperCase();
    return status === "CANCELED" || status === "CANCELLED";
  }, [project]);

  const isProjectInteractionLocked = isProjectDisputed || isProjectCanceled;

  const currentRole = currentUser?.role?.toUpperCase();
  const canCurrentUserRaiseDispute = DISPUTE_PARTICIPANT_ROLES.has(
    currentRole ?? "",
  );
  const billingRole = normalizeSupportedBillingRole(currentRole);
  const isBroker = currentRole === "BROKER";
  const isFreelancer = currentRole === "FREELANCER";
  const isAssignedBroker = Boolean(
    isBroker && currentUser?.id && project?.brokerId === currentUser.id,
  );
  const isProjectFreelancer = Boolean(
    isFreelancer && currentUser?.id && project?.freelancerId === currentUser.id,
  );
  const canActAsBrokerReviewer = Boolean(
    currentUser?.id && project?.brokerId === currentUser.id,
  );
  const canActAsClientReviewer = Boolean(
    currentUser?.id && project?.clientId === currentUser.id,
  );

  // Clients, internal reviewers, and disputed projects are read-only for task mutations.
  const isReadOnly = useMemo(() => {
    return (
      currentRole === "CLIENT" || currentRole === "STAFF" || isProjectInteractionLocked
    );
  }, [currentRole, isProjectInteractionLocked]);

  const canApproveMilestone = useMemo(() => {
    return currentRole === "CLIENT" && !isProjectInteractionLocked;
  }, [currentRole, isProjectInteractionLocked]);

  const hasBrokerReviewStep = Boolean(
    project?.brokerId && project?.brokerId !== project?.clientId,
  );

  const canReviewTaskSubmissions = useMemo(() => {
    return canActAsClientReviewer || canActAsBrokerReviewer;
  }, [canActAsBrokerReviewer, canActAsClientReviewer]);

  const assignedBrokerLabel = useMemo(() => {
    if (!project?.brokerId) {
      return null;
    }

    return project.broker?.fullName || `Broker (${project.brokerId.slice(0, 6)})`;
  }, [project?.broker?.fullName, project?.brokerId]);

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
      isAssignedBroker && !isProjectInteractionLocked && !isMilestoneStructureLocked
    );
  }, [isAssignedBroker, isProjectInteractionLocked, isMilestoneStructureLocked]);

  const projectMembers = useMemo<ProjectWorkspaceMember[]>(() => {
    if (!project) return [];
    const members = new Map<
      string,
      ProjectWorkspaceMember
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
    const addMember = (
      participant:
        | { id?: string | null; fullName?: string | null }
        | null
        | undefined,
      fallbackId: string | null | undefined,
      role: ProjectWorkspaceMember["role"],
    ) => {
      const id = participant?.id ?? fallbackId;
      if (!id) return;
      if (members.has(id)) return;
      const label = normalizeRole(role);
      const fullName = participant?.fullName?.trim() || `${label} (${id.slice(0, 6)})`;
      members.set(id, {
        id,
        name: fullName,
        fullName,
        role,
      });
    };
    addMember(project.client, project.clientId, "CLIENT");
    addMember(project.broker, project.brokerId, "BROKER");
    addMember(project.freelancer, project.freelancerId ?? null, "FREELANCER");
    addMember(project.staff, project.staffId ?? null, "STAFF");
    return Array.from(members.values());
  }, [project]);

  const chatMentionMembers = useMemo(
    () =>
      projectMembers
        .filter(
          (member): member is ProjectWorkspaceMember & {
            role: "CLIENT" | "BROKER" | "FREELANCER";
          } =>
            member.role === "CLIENT" ||
            member.role === "BROKER" ||
            member.role === "FREELANCER",
        )
        .map(({ id, fullName, role }) => ({
          id,
          fullName,
          role,
        })),
    [projectMembers],
  );
  const availableMilestoneIds = useMemo(
    () => milestones.map((milestone) => milestone.id),
    [milestones],
  );

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

  const reloadWorkspaceData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!projectId) {
        setError("No project selected. Please choose a project from the list.");
        setLoading(false);
        return;
      }

      try {
        if (!options?.silent) {
          setLoading(true);
        }
        setError(null);
        const [{ milestones: milestoneData, tasks: boardData }, projectData] =
          await Promise.all([
            fetchBoardWorkspaceData(projectId),
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

        setMilestones(milestoneData || []);
        setProject(projectData);
        setContractDetail(contractData);
        setBoard(boardData || createEmptyBoard());
      } catch (err: any) {
        setContractDetail(null);
        setError(err?.message || "Failed to load task board");
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    void reloadWorkspaceData();
  }, [reloadWorkspaceData]);

  useEffect(() => {
    if (loading) {
      return;
    }
    updateWorkspaceSearchParams({});
  }, [loading, updateWorkspaceSearchParams]);

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

  const boardMeta = useMemo(() => buildBoardMeta(board), [board]);
  const milestoneMap = useMemo(
    () => new Map(milestones.map((milestone) => [milestone.id, milestone])),
    [milestones],
  );
  const milestoneInteractionGates = useMemo(
    () => buildMilestoneInteractionGateMap(milestones),
    [milestones],
  );
  const selectedMilestoneKey = normalizeMilestoneKey(selectedMilestoneId);
  const activeMilestone = useMemo(
    () =>
      selectedMilestoneKey
        ? milestones.find((milestone) => milestone.id === selectedMilestoneKey) ?? null
        : null,
    [milestones, selectedMilestoneKey],
  );
  const activeMilestoneInteractionGate = useMemo(
    () =>
      selectedMilestoneKey ? milestoneInteractionGates[selectedMilestoneKey] ?? null : null,
    [milestoneInteractionGates, selectedMilestoneKey],
  );
  const activeTasks = useMemo(
    () =>
      selectedMilestoneKey
        ? boardMeta.tasksByMilestone[selectedMilestoneKey] ?? []
        : [],
    [boardMeta.tasksByMilestone, selectedMilestoneKey],
  );
  const activeProgress =
    typeof activeMilestone?.progress === "number"
      ? activeMilestone.progress
      : calculateProgress(activeTasks);
  const quickSubmitCandidateTask = useMemo(() => {
    if (activeTasks.length === 0) {
      return null;
    }

    const statusPriority: Record<KanbanColumnKey, number> = {
      IN_PROGRESS: 0,
      TODO: 1,
      IN_REVIEW: 2,
      DONE: 3,
    };

    const candidatePool = activeTasks.filter((task) => task.status !== "DONE");
    if (candidatePool.length === 0) {
      return null;
    }

    return [...candidatePool].sort((first, second) => {
      const statusDelta =
        (statusPriority[first.status] ?? 9) - (statusPriority[second.status] ?? 9);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      const firstUpdated = first.dueDate
        ? new Date(first.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const secondUpdated = second.dueDate
        ? new Date(second.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      return firstUpdated - secondUpdated;
    })[0];
  }, [activeTasks]);
  const quickReviewCandidate = useMemo(() => {
    for (const task of activeTasks) {
      const pendingSubmission =
        task.submissions
          ?.slice()
          .sort((first, second) => (second.version ?? 0) - (first.version ?? 0))
          .find((submission) => submission.status === "PENDING") ?? null;

      if (pendingSubmission) {
        return { task, submission: pendingSubmission };
      }
    }

    return null;
  }, [activeTasks]);
  const activeMilestoneStatus = activeMilestone?.status?.toUpperCase() ?? null;
  const activeMilestoneDisputePolicy = activeMilestone?.disputePolicy ?? null;
  const canOpenActiveMilestoneDispute = Boolean(
    activeMilestone &&
      activeMilestoneDisputePolicy?.canRaise &&
      canCurrentUserRaiseDispute &&
      !isProjectDisputed,
  );
  const activeMilestoneDisputeMessage = useMemo(() => {
    if (isProjectDisputed) {
      return "This project already has an active dispute. Continue from the dispute workspace instead of opening a new one here.";
    }
    if (!canCurrentUserRaiseDispute) {
      return "Only project participants can open a milestone dispute.";
    }
    return activeMilestoneDisputePolicy?.reason ?? null;
  }, [
    activeMilestoneDisputePolicy?.reason,
    canCurrentUserRaiseDispute,
    isProjectDisputed,
  ]);
  const projectInteractionLockReason = useMemo(() => {
    if (!isProjectInteractionLocked) {
      return null;
    }

    return isProjectCanceled
      ? "Project is cancelled. Task changes are locked in read-only mode."
      : "Project is under dispute. Task changes are locked in read-only mode.";
  }, [isProjectCanceled, isProjectInteractionLocked]);
  const selectedMilestoneInteractionReason =
    activeMilestoneInteractionGate?.isUnlocked === false
      ? activeMilestoneInteractionGate.reason
      : null;
  const selectedMilestoneTaskMutationReason = useMemo(() => {
    if (selectedMilestoneInteractionReason) {
      return selectedMilestoneInteractionReason;
    }

    if (
      activeMilestone &&
      !TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(activeMilestone.status)
    ) {
      return TASK_MUTATION_LOCK_MESSAGE;
    }

    return null;
  }, [activeMilestone, selectedMilestoneInteractionReason]);
  const getTaskInteractionLockReason = useCallback(
    (milestoneId?: string | null) => {
      if (projectInteractionLockReason) {
        return projectInteractionLockReason;
      }

      const normalizedMilestoneId = normalizeMilestoneKey(milestoneId);
      if (!normalizedMilestoneId) {
        return selectedMilestoneInteractionReason;
      }

      const gate = milestoneInteractionGates[normalizedMilestoneId];
      return gate?.isUnlocked === false ? gate.reason : null;
    },
    [
      milestoneInteractionGates,
      projectInteractionLockReason,
      selectedMilestoneInteractionReason,
    ],
  );
  const getTaskMutationLockReason = useCallback(
    (milestoneId?: string | null) => {
      const interactionReason = getTaskInteractionLockReason(milestoneId);
      if (interactionReason) {
        return interactionReason;
      }

      const normalizedMilestoneId = normalizeMilestoneKey(milestoneId);
      const milestone = normalizedMilestoneId
        ? milestoneMap.get(normalizedMilestoneId) ?? null
        : activeMilestone;
      if (
        milestone &&
        !TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(milestone.status)
      ) {
        return TASK_MUTATION_LOCK_MESSAGE;
      }

      return null;
    },
    [activeMilestone, getTaskInteractionLockReason, milestoneMap],
  );
  const canCreateTasksForSelectedMilestone = useMemo(() => {
    if (
      isReadOnly ||
      !activeMilestone ||
      !isAssignedBroker ||
      Boolean(selectedMilestoneInteractionReason)
    ) {
      return false;
    }

    return TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(activeMilestone.status);
  }, [
    activeMilestone,
    isAssignedBroker,
    isReadOnly,
    selectedMilestoneInteractionReason,
  ]);
  const taskCommandUnavailableMessage = useMemo(() => {
    if (projectInteractionLockReason) {
      return projectInteractionLockReason;
    }

    if (
      currentRole === "CLIENT" ||
      currentRole === "STAFF" ||
      currentRole === "FREELANCER"
    ) {
      return "You do not have permission to create tasks via chat in this workspace.";
    }

    if (currentRole === "BROKER" && !isAssignedBroker) {
      return "Only the assigned broker can create tasks in this workspace.";
    }

    if (!activeMilestone) {
      return "Select an editable milestone before creating tasks via chat.";
    }

    if (selectedMilestoneInteractionReason) {
      return selectedMilestoneInteractionReason;
    }

    if (!TASK_CREATION_ALLOWED_MILESTONE_STATUSES.has(activeMilestone.status)) {
      return "Cannot create tasks via chat for a completed, locked, or review-stage milestone.";
    }

    return TASK_CREATION_LOCK_MESSAGE;
  }, [
    activeMilestone,
    currentRole,
    isAssignedBroker,
    projectInteractionLockReason,
    selectedMilestoneInteractionReason,
  ]);

  const openCreateModal = useCallback(() => {
    if (!activeMilestone) {
      const message = "Select a milestone before creating a task.";
      setError(message);
      toast.warning(message);
      return;
    }

    if (!isAssignedBroker) {
      const message = "Only the assigned broker can create tasks for this project.";
      setError(message);
      toast.warning(message);
      return;
    }

    if (!canCreateTasksForSelectedMilestone) {
      const message = taskCommandUnavailableMessage || TASK_CREATION_LOCK_MESSAGE;
      setError(message);
      toast.warning(message);
      return;
    }

    setIsModalOpen(true);
  }, [
    activeMilestone,
    canCreateTasksForSelectedMilestone,
    isAssignedBroker,
    taskCommandUnavailableMessage,
  ]);

  const handleCreateTaskFromCalendarDate = useCallback(
    (start: Date, end: Date) => {
      if (!activeMilestone) {
        const message = "Select a milestone before creating a task.";
        setError(message);
        toast.warning(message);
        return;
      }

      if (!isAssignedBroker) {
        const message = "Only the assigned broker can create tasks for this project.";
        setError(message);
        toast.warning(message);
        return;
      }

      if (!canCreateTasksForSelectedMilestone) {
        const message = taskCommandUnavailableMessage || TASK_CREATION_LOCK_MESSAGE;
        setError(message);
        toast.warning(message);
        return;
      }

      const normalizedStart = new Date(start);
      normalizedStart.setHours(0, 0, 0, 0);
      const normalizedEnd = new Date(end);
      normalizedEnd.setHours(0, 0, 0, 0);
      const dueSource =
        normalizedEnd.getTime() > normalizedStart.getTime()
          ? new Date(normalizedEnd.getTime() - 24 * 60 * 60 * 1000)
          : normalizedStart;

      setNewStartDate(normalizedStart.toISOString().slice(0, 10));
      setNewDueDate(dueSource.toISOString().slice(0, 10));
      setIsModalOpen(true);
    },
    [
      activeMilestone,
      canCreateTasksForSelectedMilestone,
      isAssignedBroker,
      taskCommandUnavailableMessage,
    ],
  );

  const openCreateMilestoneModal = useCallback(() => {
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
    if (isProjectInteractionLocked) {
      setError(
        isProjectCanceled
          ? "Project is cancelled. Milestone changes are now read-only."
          : "Project is under dispute. Milestone changes are locked in read-only mode.",
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
  }, [
    isAssignedBroker,
    isMilestoneStructureLocked,
    isProjectCanceled,
    isProjectInteractionLocked,
  ]);

  const handleSelectMilestone = useCallback((id: string) => {
    setSelectedMilestoneId(id);
  }, [setSelectedMilestoneId]);

  const contractHref =
    project?.contracts?.[0]?.id && currentUser?.role
      ? `/${currentUser.role.toLowerCase()}/contracts/${project.contracts[0].id}`
      : null;

  const workspaceBillingHref = useMemo(() => {
    const billingBaseRoute = resolveBillingRoute(currentRole);

    if (!projectId) {
      return billingBaseRoute;
    }

    const workspaceRoutePattern =
      currentRole === "BROKER"
        ? ROUTES.BROKER_WORKSPACE
        : currentRole === "FREELANCER"
          ? ROUTES.FREELANCER_WORKSPACE
          : ROUTES.CLIENT_WORKSPACE;
    const workspacePath = workspaceRoutePattern.replace(":projectId", projectId);
    const returnParams = new URLSearchParams();
    returnParams.set("view", viewMode);
    if (selectedMilestoneId) {
      returnParams.set("milestone", selectedMilestoneId);
    }

    const billingParams = new URLSearchParams();
    billingParams.set("returnTo", `${workspacePath}?${returnParams.toString()}`);

    if (activeMilestone?.title) {
      billingParams.set("milestoneTitle", activeMilestone.title);
    }

    return `${billingBaseRoute}?${billingParams.toString()}`;
  }, [activeMilestone?.title, currentRole, projectId, selectedMilestoneId, viewMode]);

  const allTasks = boardMeta.allTasks;
  const activeAssigneeFilterId = useMemo(
    () => selectedAssigneeId || (isMyTasksFilter ? currentUser?.id ?? null : null),
    [currentUser?.id, isMyTasksFilter, selectedAssigneeId],
  );
  const taskMatchesWorkspaceFilters = useCallback(
    (task: Task) => {
      const normalizedMilestoneId = normalizeMilestoneKey(selectedMilestoneId);
      const normalizedSearch = searchQuery.trim().toLowerCase();

      if (
        normalizedMilestoneId &&
        normalizeMilestoneKey(task.milestoneId ?? null) !== normalizedMilestoneId
      ) {
        return false;
      }

      if (
        normalizedSearch &&
        !task.title.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      if (activeAssigneeFilterId && task.assignee?.id !== activeAssigneeFilterId) {
        return false;
      }

      if (selectedStatusFilter !== "ALL" && task.status !== selectedStatusFilter) {
        return false;
      }

      if (
        selectedPriorityFilter !== "ALL" &&
        task.priority !== selectedPriorityFilter
      ) {
        return false;
      }

      if (isOverdueOnlyFilter && !isTaskOverdue(task)) {
        return false;
      }

      if (!showSubtasksInWorkspaceViews && task.parentTaskId) {
        return false;
      }

      return true;
    },
    [
      activeAssigneeFilterId,
      isOverdueOnlyFilter,
      searchQuery,
      selectedMilestoneId,
      selectedPriorityFilter,
      selectedStatusFilter,
      showSubtasksInWorkspaceViews,
    ],
  );
  const filteredWorkspaceTasks = useMemo(
    () => allTasks.filter(taskMatchesWorkspaceFilters),
    [allTasks, taskMatchesWorkspaceFilters],
  );
  const calendarTasks = useMemo(() => {
    return filteredWorkspaceTasks;
  }, [filteredWorkspaceTasks]);
  const uniqueAssignees = boardMeta.uniqueAssignees;

  const processedBoard = useMemo(() => {
    if (
      !searchQuery.trim() &&
      !activeAssigneeFilterId &&
      selectedStatusFilter === "ALL" &&
      selectedPriorityFilter === "ALL" &&
      !isOverdueOnlyFilter &&
      showSubtasksInWorkspaceViews &&
      !selectedMilestoneId
    ) {
      return board;
    }

    return BOARD_COLUMNS.reduce<KanbanBoard>((nextBoard, columnKey) => {
      const sourceTasks = board[columnKey];
      const filteredTasks = sourceTasks.filter(taskMatchesWorkspaceFilters);
      nextBoard[columnKey] =
        filteredTasks.length === sourceTasks.length ? sourceTasks : filteredTasks;
      return nextBoard;
    }, createEmptyBoard());
  }, [
    board,
    activeAssigneeFilterId,
    isOverdueOnlyFilter,
    searchQuery,
    selectedMilestoneId,
    selectedPriorityFilter,
    selectedStatusFilter,
    showSubtasksInWorkspaceViews,
    taskMatchesWorkspaceFilters,
  ]);
  const hasActiveWorkspaceTaskFilters = useMemo(
    () =>
      Boolean(
        searchQuery.trim() ||
          activeAssigneeFilterId ||
          selectedStatusFilter !== "ALL" ||
          selectedPriorityFilter !== "ALL" ||
          isOverdueOnlyFilter ||
          !showSubtasksInWorkspaceViews,
      ),
    [
      activeAssigneeFilterId,
      isOverdueOnlyFilter,
      searchQuery,
      selectedPriorityFilter,
      selectedStatusFilter,
      showSubtasksInWorkspaceViews,
    ],
  );
  const clearWorkspaceTaskFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedAssigneeId(null);
    setIsMyTasksFilter(false);
    setSelectedStatusFilter("ALL");
    setSelectedPriorityFilter("ALL");
    setIsOverdueOnlyFilter(false);
    setShowSubtasksInWorkspaceViews(true);
  }, []);

  const selectedTask = useMemo(
    () => (selectedTaskId ? boardMeta.taskMap.get(selectedTaskId) ?? null : null),
    [boardMeta.taskMap, selectedTaskId],
  );
  const selectedTaskInteractionReason = useMemo(
    () => getTaskInteractionLockReason(selectedTask?.milestoneId),
    [getTaskInteractionLockReason, selectedTask?.milestoneId],
  );
  const selectedTaskMutationReason = useMemo(
    () => getTaskMutationLockReason(selectedTask?.milestoneId),
    [getTaskMutationLockReason, selectedTask?.milestoneId],
  );

  const handleViewTaskDetails = useCallback(
    (taskId: string) => {
      if (!boardMeta.taskMap.has(taskId)) {
        return;
      }

      setSelectedTaskId(taskId);
      setIsTaskDetailOpen(true);
    },
    [boardMeta.taskMap],
  );

  const handleCloseTaskDetail = useCallback(() => {
    setIsTaskDetailOpen(false);
    setSelectedTaskId(null);
  }, []);

  const upsertTaskIntoBoard = useCallback((incomingTask: Task) => {
    if (!incomingTask?.id) {
      return;
    }

    const normalizedTask: Task = {
      ...incomingTask,
      status: incomingTask.status ?? "TODO",
    };

    setBoard((prevBoard) => upsertTaskInBoard(prevBoard, normalizedTask));
  }, []);

  const handleTaskUpdate = useCallback(
    (updatedTask: Task) => {
      upsertTaskIntoBoard(updatedTask);
    },
    [upsertTaskIntoBoard],
  );

  const handleTaskDelete = useCallback((taskId: string) => {
    setBoard((prevBoard) => removeTaskFromBoard(prevBoard, taskId));
    setIsTaskDetailOpen(false);
    setSelectedTaskId(null);
  }, []);

  const handleTaskRealtimeEvent = useCallback(
    (event: ProjectTaskRealtimeEvent) => {
      if (!event) {
        return;
      }

      if (event.action === "DELETED") {
        if (!event.taskId) {
          return;
        }

        setBoard((prevBoard) => removeTaskFromBoard(prevBoard, event.taskId!));
        if (selectedTaskId === event.taskId) {
          setIsTaskDetailOpen(false);
          setSelectedTaskId(null);
        }
      } else {
        if (!event.task?.id) {
          return;
        }

        upsertTaskIntoBoard(event.task);
      }

      if (
        event.milestoneId &&
        typeof event.milestoneProgress === "number" &&
        typeof event.totalTasks === "number" &&
        typeof event.completedTasks === "number"
      ) {
        setMilestones((prevMilestones) => {
          const milestoneIndex = prevMilestones.findIndex(
            (milestone) => milestone.id === event.milestoneId,
          );
          if (milestoneIndex < 0) {
            return prevMilestones;
          }

          const milestone = prevMilestones[milestoneIndex];
          if (
            milestone.progress === event.milestoneProgress &&
            milestone.totalTasks === event.totalTasks &&
            milestone.completedTasks === event.completedTasks
          ) {
            return prevMilestones;
          }

          const nextMilestones = prevMilestones.slice();
          nextMilestones[milestoneIndex] = {
            ...milestone,
            progress: event.milestoneProgress,
            totalTasks: event.totalTasks,
            completedTasks: event.completedTasks,
          };
          return nextMilestones;
        });
      }
    },
    [selectedTaskId, upsertTaskIntoBoard],
  );

  useEffect(() => {
    if (!projectId || !currentUser?.id) {
      return;
    }

    const socket = connectNamespacedSocket(TASKS_REALTIME_NAMESPACE);

    const joinTaskRoom = () => {
      socket.emit("joinProjectTasks", { projectId });
    };

    const handleTaskSocketConnectError = (connectError: Error) => {
      console.error("Task realtime connection failed:", connectError);
    };

    const handleTaskBoardError = (payload: unknown) => {
      console.error("Task realtime room join failed:", payload);
    };

    const handleProjectTaskChanged = (payload: unknown) => {
      if (typeof payload !== "object" || payload === null) {
        return;
      }

      const event = payload as Partial<ProjectTaskRealtimeEvent>;
      if (
        event.projectId !== projectId ||
        (event.action === "DELETED" ? !event.taskId : !event.task)
      ) {
        return;
      }

      handleTaskRealtimeEvent({
        action:
          event.action === "CREATED"
            ? "CREATED"
            : event.action === "DELETED"
              ? "DELETED"
              : "UPDATED",
        projectId: event.projectId,
        task: event.task,
        taskId: event.taskId,
        milestoneId: event.milestoneId ?? null,
        milestoneProgress:
          typeof event.milestoneProgress === "number"
            ? event.milestoneProgress
            : undefined,
        totalTasks:
          typeof event.totalTasks === "number" ? event.totalTasks : undefined,
        completedTasks:
          typeof event.completedTasks === "number"
            ? event.completedTasks
            : undefined,
      });
    };

    socket.on("connect", joinTaskRoom);
    socket.on("connect_error", handleTaskSocketConnectError);
    socket.on("taskBoardError", handleTaskBoardError);
    socket.on("projectTaskChanged", handleProjectTaskChanged);

    if (socket.connected) {
      joinTaskRoom();
    }

    return () => {
      socket.off("connect", joinTaskRoom);
      socket.off("connect_error", handleTaskSocketConnectError);
      socket.off("taskBoardError", handleTaskBoardError);
      socket.off("projectTaskChanged", handleProjectTaskChanged);
      disconnectNamespacedSocket(TASKS_REALTIME_NAMESPACE);
    };
  }, [currentUser?.id, handleTaskRealtimeEvent, projectId]);

  useEffect(() => {
    if (!projectId || !currentUser?.id) {
      return;
    }

    const socket = connectSocket();
    const currentContractId = contractDetail?.id ?? null;

    const handleProjectUpdated = (payload?: {
      projectId?: string;
      requestId?: string | null;
    }) => {
      if (payload?.projectId === projectId) {
        void reloadWorkspaceData({ silent: true });
      }
    };

    const handleContractUpdated = (payload?: {
      contractId?: string;
      projectId?: string;
    }) => {
      if (payload?.projectId === projectId) {
        void reloadWorkspaceData({ silent: true });
      }
    };

    const handleNotificationCreated = (payload?: {
      notification?: {
        relatedType?: string | null;
        relatedId?: string | null;
      };
      relatedType?: string | null;
      relatedId?: string | null;
    }) => {
      const notification = payload?.notification ?? payload;
      const relatedType = String(notification?.relatedType || "").toUpperCase();
      const relatedId = String(notification?.relatedId || "");

      const isRelevant =
        (relatedType === "PROJECT" && relatedId === projectId) ||
        (relatedType === "CONTRACT" &&
          Boolean(currentContractId) &&
          relatedId === currentContractId);

      if (isRelevant) {
        void reloadWorkspaceData({ silent: true });
      }
    };

    socket.on("PROJECT_UPDATED", handleProjectUpdated);
    socket.on("CONTRACT_UPDATED", handleContractUpdated);
    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);

    return () => {
      socket.off("PROJECT_UPDATED", handleProjectUpdated);
      socket.off("CONTRACT_UPDATED", handleContractUpdated);
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
    };
  }, [contractDetail?.id, currentUser?.id, projectId, reloadWorkspaceData]);

  // Handle milestone approval (Client/Broker only)
  const handleApproveMilestone = async (
    milestoneId: string,
    feedback?: string,
  ) => {
    if (isProjectInteractionLocked) {
      throw new Error(
        isProjectCanceled
          ? "Project is cancelled. Milestone approval is locked."
          : "Project is under dispute. Milestone approval is locked.",
      );
    }
    try {
      setError(null);
      const result = await approveMilestone(milestoneId, feedback);

      // Update the milestone status in local state
      setMilestones((prev) =>
        prev.map((milestone) => {
          if (milestone.id !== milestoneId) {
            return milestone;
          }

          const nextMilestone: Milestone = {
            ...milestone,
            ...result.milestone,
          };

          if (!nextMilestone.escrow) {
            return nextMilestone;
          }

          return {
            ...nextMilestone,
            escrow: {
              ...nextMilestone.escrow,
              status: result.fundsReleased
                ? "RELEASED"
                : nextMilestone.escrow.status,
              releasedAmount: result.fundsReleased
                ? Number(
                    nextMilestone.escrow.totalAmount ||
                      nextMilestone.amount ||
                      0,
                  )
                : nextMilestone.escrow.releasedAmount,
              releasedAt: result.fundsReleased
                ? new Date().toISOString()
                : nextMilestone.escrow.releasedAt,
              updatedAt: new Date().toISOString(),
            },
          };
        }),
      );

      console.log(
        `[Milestone] "${result.milestone.title}" approved. Funds released: ${result.fundsReleased}`,
      );

      toast.success(result.message);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to approve milestone";
      setError(errorMessage);
      throw err; // Re-throw so the modal can handle it
    }
  };

  const handleFundingSuccess = useCallback((result: MilestoneFundingResult) => {
    const now = new Date().toISOString();

    setMilestones((prev) =>
      prev.map((milestone) =>
        milestone.id === result.milestoneId
          ? {
              ...milestone,
              escrow: milestone.escrow
                ? {
                    ...milestone.escrow,
                    status: result.escrowStatus,
                    fundedAmount: milestone.escrow.totalAmount,
                    fundedAt: now,
                    updatedAt: now,
                  }
                : {
                    id: result.escrowId,
                    status: result.escrowStatus,
                    totalAmount: milestone.amount,
                    fundedAmount: milestone.amount,
                    releasedAmount: 0,
                    developerShare: milestone.amount,
                    brokerShare: 0,
                    platformFee: 0,
                    currency: result.walletSnapshot.currency,
                    fundedAt: now,
                    releasedAt: null,
                    refundedAt: null,
                    updatedAt: now,
                  },
            }
          : milestone,
      ),
    );
  }, []);

  useEffect(() => {
    const stripeCheckoutState = searchParams.get("stripeCheckout");
    const stripeSessionId = searchParams.get("stripeSessionId");
    const stripePaymentMethodId = searchParams.get("stripePaymentMethodId");

    const clearStripeCheckoutParams = () => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("stripeCheckout");
      nextSearchParams.delete("stripeSessionId");
      nextSearchParams.delete("stripePaymentMethodId");
      setSearchParams(nextSearchParams, { replace: true });
    };

    if (stripeCheckoutState === "cancel") {
      toast.message("Stripe checkout was cancelled.");
      clearStripeCheckoutParams();
      return;
    }

    if (
      stripeCheckoutState !== "success" ||
      !requestedMilestoneId ||
      !stripeSessionId ||
      !stripePaymentMethodId
    ) {
      return;
    }

    if (processedStripeSessionIdsRef.current.has(stripeSessionId)) {
      return;
    }

    processedStripeSessionIdsRef.current.add(stripeSessionId);
    let active = true;

    const syncStripeCheckout = async () => {
      try {
        const result = await completeStripeMilestoneFunding(requestedMilestoneId, {
          paymentMethodId: stripePaymentMethodId,
          sessionId: stripeSessionId,
        });
        if (!active) return;
        handleFundingSuccess(result);
        toast.success("Card payment completed and escrow funded");
      } catch (error: unknown) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Stripe Checkout completed, but the app could not sync the escrow state.";
        setError(message);
        toast.error(message);
      } finally {
        if (active) {
          clearStripeCheckoutParams();
        }
      }
    };

    void syncStripeCheckout();

    return () => {
      active = false;
    };
  }, [handleFundingSuccess, requestedMilestoneId, searchParams, setSearchParams]);

  const handleRequestMilestoneReview = async (milestoneId: string) => {
    if (isProjectInteractionLocked) {
      throw new Error(
        isProjectCanceled
          ? "Project is cancelled. Milestone review is locked."
          : "Project is under dispute. Milestone review is locked.",
      );
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
      toast.success(
        updatedMilestone.status === "PENDING_STAFF_REVIEW"
          ? "Milestone sent to broker review."
          : "Milestone sent to client approval.",
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to request milestone review";
      setError(errorMessage);
      throw err;
    }
  };

  const handleRejectMilestone = async (milestoneId: string, reason: string) => {
    if (isProjectInteractionLocked) {
      throw new Error(
        isProjectCanceled
          ? "Project is cancelled. Milestone review is locked."
          : "Project is under dispute. Milestone review is locked.",
      );
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error("Please provide a reason before rejecting this milestone.");
    }

    try {
      setError(null);
      const updatedMilestone = await rejectMilestone(milestoneId, trimmedReason);
      setMilestones((prev) =>
        prev.map((milestone) =>
          milestone.id === milestoneId
            ? { ...milestone, ...updatedMilestone }
            : milestone,
        ),
      );
      toast.success("Milestone sent back for revisions.");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to reject milestone";
      setError(errorMessage);
      throw err;
    }
  };

  const handleBrokerReviewMilestone = async (
    milestoneId: string,
    payload: { recommendation: "ACCEPT" | "REJECT"; note: string },
  ) => {
    if (isProjectInteractionLocked) {
      throw new Error(
        isProjectCanceled
          ? "Project is cancelled. Milestone review is locked."
          : "Project is under dispute. Milestone review is locked.",
      );
    }

    try {
      setError(null);
      const updatedMilestone = await reviewMilestoneAsBroker(
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
    if (!canCurrentUserRaiseDispute) {
      toast.error("Only project participants can open a dispute.");
      return;
    }
    if (isProjectDisputed) {
      toast.error(
        "This project already has an active dispute. Continue in the dispute workspace instead.",
      );
      return;
    }
    if (!milestone.disputePolicy?.canRaise) {
      toast.error(
        milestone.disputePolicy?.reason ||
          "Dispute is not available for this milestone.",
      );
      return;
    }
    setDisputeMilestone(milestone);
    setIsDisputeModalOpen(true);
  };

  const closeDisputeModal = () => {
    setIsDisputeModalOpen(false);
    setDisputeMilestone(null);
  };

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (isReadOnly) {
      if (isProjectInteractionLocked) {
        toast.warning(
          isProjectCanceled
            ? "Task movement is locked because this project is cancelled."
            : "Task movement is locked while this project is in dispute.",
        );
      }
      return;
    }

    const { destination, source, draggableId } = result;
    if (!destination) {
      return;
    }

    const fromColumn = source.droppableId as KanbanColumnKey;
    const toColumn = destination.droppableId as KanbanColumnKey;

    if (fromColumn === toColumn && destination.index === source.index) {
      return;
    }

    const movedTask = board[fromColumn][source.index];
    if (!movedTask) {
      return;
    }

    const taskMutationLockReason = getTaskMutationLockReason(movedTask.milestoneId);
    if (taskMutationLockReason) {
      toast.warning(taskMutationLockReason);
      return;
    }

    if (toColumn === "DONE" && isFreelancer) {
      toast.warning(
        "Freelancers cannot drag tasks directly to DONE. Submit work for review instead.",
      );
      return;
    }

    if (toColumn === "DONE" && !getLatestApprovedSubmission(movedTask)) {
      toast.warning("Cannot move to DONE without an approved submission.");
      return;
    }

    if (
      fromColumn === "DONE" &&
      toColumn !== "DONE" &&
      getLatestApprovedSubmission(movedTask)
    ) {
      toast.warning(
        "Task has been approved and completed, cannot be dragged back from DONE.",
      );
      return;
    }

    const prevBoard = board;
    const movement = moveTaskInBoard(board, {
      fromColumn,
      toColumn,
      sourceIndex: source.index,
      destinationIndex: destination.index,
      transformTask: (task) => ({ ...task, status: toColumn }),
    });

    if (!movement) {
      return;
    }

    setBoard(movement.board);

    try {
      await updateTaskStatus(draggableId, toColumn);
      setError(null);
    } catch (err: any) {
      setBoard(prevBoard);
      setError(err?.message || "Failed to update task status");
    }
  }, [
    board,
    getTaskMutationLockReason,
    isFreelancer,
    isProjectCanceled,
    isProjectInteractionLocked,
    isReadOnly,
  ]);

  const handleCreateTask = useCallback(async () => {
    if (isProjectInteractionLocked) {
      setError(
        isProjectCanceled
          ? "Project is cancelled. Task creation is locked in read-only mode."
          : "Project is under dispute. Task creation is locked in read-only mode.",
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
    if (!isAssignedBroker) {
      const message = "Only the assigned broker can create tasks for this project.";
      setError(message);
      toast.warning(message);
      return;
    }
    if (!canCreateTasksForSelectedMilestone) {
      const message = taskCommandUnavailableMessage || TASK_CREATION_LOCK_MESSAGE;
      setError(message);
      toast.warning(message);
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

      if (!created?.id) {
        throw new Error(
          "Task creation failed because the server did not return a persisted task.",
        );
      }

      upsertTaskIntoBoard(created);

      // Reset form fields
      setIsModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewSpecFeatureId("");
      setNewStartDate("");
      setNewDueDate("");
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create task";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canCreateTasksForSelectedMilestone,
    isAssignedBroker,
    isProjectCanceled,
    isProjectInteractionLocked,
    newDescription,
    newDueDate,
    newSpecFeatureId,
    newStartDate,
    newTitle,
    projectId,
    selectedMilestoneId,
    specFeatureOptions.length,
    taskCommandUnavailableMessage,
    upsertTaskIntoBoard,
  ]);

  return (
    <div
      className={`space-y-8 pb-20 transition-[padding] duration-200 ${
        isChatOpen ? "xl:pr-[25rem]" : ""
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Project Task Board
          </h1>
          <p className="text-gray-600">
            Project ID:{" "}
            <span className="font-mono text-sky-600">{projectId || "N/A"}</span>
          </p>
          {activeMilestoneStatus === "PENDING_STAFF_REVIEW" && assignedBrokerLabel && (
            <p className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Waiting for broker review · {assignedBrokerLabel}
            </p>
          )}
          {activeMilestoneStatus === "PENDING_CLIENT_APPROVAL" && assignedBrokerLabel && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Broker reviewed · {assignedBrokerLabel}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          {/* View Contract Button */}
          {contractHref && (
            <Link
              to={contractHref}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              <FileSignature className="h-4 w-4" />
              Contract
            </Link>
          )}
          {(billingRole === "CLIENT" || billingRole === "BROKER" || billingRole === "FREELANCER") && (
            <Link
              to={workspaceBillingHref}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-100"
            >
              <WalletCards className="h-4 w-4 shrink-0" />
              <span className="truncate">{resolveBillingLabel(currentRole)}</span>
            </Link>
          )}

          {/* View Switcher */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setViewMode("summary")}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
              className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-gray-600 hover:text-gray-900"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-red-100">
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
          {!isReadOnly && canCreateTasksForSelectedMilestone && (
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

      {isProjectCanceled && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          This project is cancelled. Task updates, milestone edits, and funding actions are locked.
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
                    {formatMilestoneRuntimeStatus(runtimeStatus)}
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
            activeMilestone.status !== "PAID" &&
            (!activeMilestone.escrow ||
              activeMilestone.escrow.status === "FUNDED") && (
              <MilestoneApprovalCard
                milestone={activeMilestone}
                tasks={activeTasks}
                progress={activeProgress}
                currentRole={currentRole}
                isAssignedReviewer={isAssignedBroker}
                hasIntermediateReviewer={hasBrokerReviewStep}
                assignedReviewerLabel={assignedBrokerLabel}
                onApprove={handleApproveMilestone}
                onReject={handleRejectMilestone}
                onRequestReview={handleRequestMilestoneReview}
                onReviewerDecision={handleBrokerReviewMilestone}
                canApprove={canApproveMilestone}
                currency={project?.currency ?? "USD"}
              />
            )}

          {activeMilestone && (
            <MilestoneFundingCard
              milestone={activeMilestone}
              progress={activeProgress}
              currentUserRole={currentRole}
              projectStatus={project?.status ?? null}
              currency={project?.currency ?? "USD"}
              billingSetupHref={workspaceBillingHref}
              currentUserEmail={currentUser?.email ?? null}
              onFunded={handleFundingSuccess}
              isChatOpen={isChatOpen}
            />
          )}

          {project ? (
            <ProjectReviewActionsCard
              project={project}
              milestones={milestones}
              currentUserId={currentUser?.id}
              currentUserRole={currentRole}
              pathname={location.pathname}
            />
          ) : null}

          {activeMilestone ? (
            <section className="rounded-[1.8rem] border border-red-200 bg-linear-to-br from-red-50 via-white to-rose-50 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">
                    Milestone Dispute
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Report a serious delivery issue
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                      Use dispute for quality, deadline, communication, or payment
                      problems tied to milestone <span className="font-medium">{activeMilestone.title.replaceAll("&amp;", "&")}</span>
                      {project?.title ? (
                        <>
                          {" "}in project <span className="font-medium">{project.title}</span>
                        </>
                      ) : null}
                      .
                    </p>
                    {activeMilestoneDisputePolicy?.warrantyEndsAt ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Warranty window ends on{" "}
                        {new Date(
                          activeMilestoneDisputePolicy.warrantyEndsAt,
                        ).toLocaleDateString("en-GB")}
                        .
                      </p>
                    ) : null}
                  </div>
                </div>

                {canOpenActiveMilestoneDispute ? (
                  <button
                    type="button"
                    data-testid={`raise-dispute-${activeMilestone.id}`}
                    onClick={() => handleRaiseDispute(activeMilestone.id)}
                    className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                  >
                    Raise Dispute
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
                    {activeMilestoneDisputeMessage ||
                      "Dispute is not available for this milestone right now."}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {viewMode !== "summary" && (
            <MilestoneTabs
              milestones={milestones}
              selectedId={selectedMilestoneId || undefined}
              tasksMap={boardMeta.tasksByMilestone}
              interactionGates={milestoneInteractionGates}
              onSelect={handleSelectMilestone}
              onAdd={
                canMutateMilestoneStructure
                  ? openCreateMilestoneModal
                  : undefined
              }
            />
          )}
          {activeMilestone && viewMode === "board" && (
            <div className="border border-gray-200 bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-slate-900">
                  {activeMilestone.title}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span>{activeProgress}%</span>
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

          {viewMode !== "summary" && activeMilestone && selectedMilestoneTaskMutationReason && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                activeMilestoneInteractionGate?.state === "LOCKED_NOT_FUNDED"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {selectedMilestoneTaskMutationReason}
            </div>
          )}

          {/* Conditional View Rendering */}
          {viewMode === "summary" ? (
            <ProjectOverview
              projectId={projectId}
              milestones={milestones}
              tasks={allTasks}
            />
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

                  <select
                    value={selectedStatusFilter}
                    onChange={(event) =>
                      setSelectedStatusFilter(
                        event.target.value as KanbanColumnKey | "ALL",
                      )
                    }
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
                    title="Filter by status"
                  >
                    {WORKSPACE_TASK_STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedPriorityFilter}
                    onChange={(event) =>
                      setSelectedPriorityFilter(
                        event.target.value as TaskPriority | "ALL",
                      )
                    }
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
                    title="Filter by priority"
                  >
                    {WORKSPACE_TASK_PRIORITY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setIsOverdueOnlyFilter((current) => !current)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isOverdueOnlyFilter
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Overdue only
                  </button>

                  <button
                    onClick={() =>
                      setShowSubtasksInWorkspaceViews((current) => !current)
                    }
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      showSubtasksInWorkspaceViews
                        ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {showSubtasksInWorkspaceViews ? "Subtasks on" : "Subtasks off"}
                  </button>

                  {/* Clear All Button (Only show if filters active) */}
                  {hasActiveWorkspaceTaskFilters && (
                    <button
                      onClick={clearWorkspaceTaskFilters}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={boardViewportRef}
                className="min-h-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2 shadow-sm"
                style={
                  boardViewportHeight
                    ? { height: `${boardViewportHeight}px` }
                    : { height: "23rem" }
                }
              >
                <div className="flex h-full min-h-0 items-stretch gap-4 overflow-x-auto overflow-y-hidden pb-2 xl:grid xl:grid-cols-4 xl:overflow-x-visible">
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className="h-full min-h-0 min-w-[18rem] shrink-0 xl:min-w-0 xl:w-auto"
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
                        canAddTask={canCreateTasksForSelectedMilestone}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </DragDropContext>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedStatusFilter}
                    onChange={(event) =>
                      setSelectedStatusFilter(
                        event.target.value as KanbanColumnKey | "ALL",
                      )
                    }
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
                    title="Filter by status"
                  >
                    {WORKSPACE_TASK_STATUS_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedPriorityFilter}
                    onChange={(event) =>
                      setSelectedPriorityFilter(
                        event.target.value as TaskPriority | "ALL",
                      )
                    }
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
                    title="Filter by priority"
                  >
                    {WORKSPACE_TASK_PRIORITY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setIsOverdueOnlyFilter((current) => !current)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isOverdueOnlyFilter
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Overdue only
                  </button>

                  <button
                    onClick={() =>
                      setShowSubtasksInWorkspaceViews((current) => !current)
                    }
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      showSubtasksInWorkspaceViews
                        ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {showSubtasksInWorkspaceViews ? "Subtasks on" : "Subtasks off"}
                  </button>
                </div>

                {hasActiveWorkspaceTaskFilters ? (
                  <button
                    onClick={clearWorkspaceTaskFilters}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              <CalendarView
                {...({
                  tasks: calendarTasks,
                  selectedMilestoneLabel: activeMilestone?.title ?? null,
                  canRescheduleTasks:
                    !isReadOnly && !selectedMilestoneTaskMutationReason,
                  canCreateTasks: canCreateTasksForSelectedMilestone,
                  calendarInteractionMessage: canCreateTasksForSelectedMilestone
                    ? null
                    : selectedMilestoneTaskMutationReason ||
                      taskCommandUnavailableMessage,
                  onViewTaskDetails: handleViewTaskDetails,
                  onTaskUpdated: upsertTaskIntoBoard,
                  onCreateTaskFromDate: handleCreateTaskFromCalendarDate,
                } as any)}
              />
            </div>
          )}
        </>
      )}

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
        canReviewSubmissions={Boolean(
          canReviewTaskSubmissions && !selectedTaskInteractionReason
        )}
        canActAsBrokerReviewer={canActAsBrokerReviewer}
        canActAsClientReviewer={canActAsClientReviewer}
        allowTaskStatusEditing={!isReadOnly && !selectedTaskMutationReason}
        allowTaskMutations={!isReadOnly && !selectedTaskMutationReason}
        taskMutationLockReason={selectedTaskMutationReason}
        onClose={handleCloseTaskDetail}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
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
          disputePolicy={disputeMilestone.disputePolicy ?? null}
          currentUserId={currentUser.id}
          projectMembers={projectMembers}
        />
      )}

      <WorkspaceChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        projectId={projectId}
        currentUserId={currentUser?.id}
        projectMembers={chatMentionMembers}
        workspaceTasks={allTasks}
        availableMilestoneIds={availableMilestoneIds}
        canReviewTasks={canReviewTaskSubmissions}
        canBrokerReviewTasks={canActAsBrokerReviewer}
        canClientReviewTasks={canActAsClientReviewer}
        canUseTaskCommand={canCreateTasksForSelectedMilestone}
        taskCommandUnavailableMessage={taskCommandUnavailableMessage}
        defaultMilestoneId={selectedMilestoneId}
        projectTitle="Workspace Chat"
        showCommandPopover={true}
        onTaskCreated={upsertTaskIntoBoard}
      />
    </div>
  );
}
