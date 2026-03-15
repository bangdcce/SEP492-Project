import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CheckCircle2, Flag, Send, Sparkles, X, Zap } from "lucide-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/constants";
import {
  createTask,
  fetchBoard,
  fetchMilestones,
  fetchTaskSubmissions,
  reviewSubmission,
} from "../../api";
import type { Task, TaskSubmission } from "../../types";
import { apiClient } from "@/shared/api/client";
import {
  connectNamespacedSocket,
} from "@/shared/realtime/socket";
import { getStoredJson } from "@/shared/utils/storage";

interface WorkspaceChatDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  projectId?: string;
  currentUserId?: string;
  canReviewTasks?: boolean;
  defaultMilestoneId?: string | null;
  projectTitle?: string;
  showCommandPopover?: boolean;
  onTaskCreated?: (task: Task) => void;
}

interface WorkspaceChatSender {
  id: string;
  fullName: string;
  role: string | null;
}

interface WorkspaceChatMessage {
  id: string;
  projectId: string;
  senderId: string;
  taskId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  sender: WorkspaceChatSender | null;
}

interface WorkspaceChatHistoryResponse {
  success: boolean;
  data: WorkspaceChatMessage[];
  pagination?: {
    limit: number;
    offset: number;
    count: number;
  };
}

const WORKSPACE_CHAT_NAMESPACE = "/ws/workspace";
const HISTORY_PAGE_SIZE = 20;
const TOP_SCROLL_THRESHOLD = 40;

const getStoredCurrentUserId = (): string | undefined => {
  const user = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);
  if (!user?.id) return undefined;
  return user.id;
};

const toIsoDate = (value: unknown): string => {
  const parsed = value ? new Date(value as string | number | Date) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const normalizeWorkspaceMessage = (
  value: Partial<WorkspaceChatMessage> | null | undefined,
): WorkspaceChatMessage | null => {
  if (!value?.id || !value.projectId || !value.senderId || !value.content) {
    return null;
  }

  return {
    id: value.id,
    projectId: value.projectId,
    senderId: value.senderId,
    taskId: value.taskId ?? null,
    content: value.content,
    createdAt: toIsoDate(value.createdAt),
    updatedAt: toIsoDate(value.updatedAt),
    sender: value.sender
      ? {
          id: value.sender.id,
          fullName: value.sender.fullName,
          role: value.sender.role,
        }
      : null,
  };
};

const sortMessagesAsc = (messages: WorkspaceChatMessage[]): WorkspaceChatMessage[] => {
  return [...messages].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );
};

const mergeUniqueMessages = (
  current: WorkspaceChatMessage[],
  incoming: WorkspaceChatMessage[],
): WorkspaceChatMessage[] => {
  const byId = new Map<string, WorkspaceChatMessage>();

  for (const message of current) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return sortMessagesAsc(Array.from(byId.values()));
};

const formatMessageTime = (isoTimestamp: string): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
};

const extractSocketError = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (record.success === true) {
    return null;
  }

  if (record.joined === false && typeof record.error !== "string") {
    return "Failed to join workspace chat";
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  if (typeof record.message === "string") {
    return record.message;
  }

  if (Array.isArray(record.message)) {
    const messages = record.message.filter(
      (item): item is string => typeof item === "string",
    );
    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  return null;
};

const isTransientSocketError = (message: string | null | undefined): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unauthorized socket") ||
    normalized.includes("unauthorized") ||
    normalized.includes("missing token") ||
    normalized.includes("invalid token") ||
    normalized.includes("jwt")
  );
};

const waitForSocketConnection = (socket: Socket, timeoutMs: number): Promise<void> => {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      clearTimeout(timeoutId);
      socket.off("connect_error", onConnectError);
      resolve();
    };

    const onConnectError = (error: Error) => {
      clearTimeout(timeoutId);
      socket.off("connect", onConnect);
      reject(error);
    };

    const timeoutId = window.setTimeout(() => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      reject(new Error("Socket connection timeout"));
    }, timeoutMs);

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
};

export function WorkspaceChatDrawer({
  isOpen = true,
  onClose,
  projectId,
  currentUserId,
  canReviewTasks = false,
  defaultMilestoneId = null,
  projectTitle = "Project Workspace Chat",
  showCommandPopover = false,
  onTaskCreated,
}: WorkspaceChatDrawerProps) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const joinedProjectIdRef = useRef<string | null>(null);
  const joinInFlightRef = useRef<Promise<void> | null>(null);
  const lastSendAttemptAtRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const resolvedCurrentUserId = currentUserId ?? getStoredCurrentUserId();

  const shouldShowCommandPopover =
    showCommandPopover && inputValue.trimStart().startsWith("/");

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const isNearBottom = useCallback((): boolean => {
    const container = messagesContainerRef.current;
    if (!container) {
      return true;
    }

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom < 120;
  }, []);

  const triggerSlashCommand = useCallback(
    (rawInput: string): boolean => {
      const command = rawInput.trim().split(/\s+/)[0]?.toLowerCase();
      if (!command.startsWith("/")) {
        return false;
      }

      toast.error(`Unknown command: ${command}`);
      return true;
    },
    [],
  );

  const handleCommandQuickAction = useCallback(
    (command: "/task" | "/approve") => {
      setInputValue(`${command} `);
      inputRef.current?.focus();
    },
    [],
  );

  const resolveTaskMilestoneId = useCallback(async (): Promise<string | null> => {
    if (defaultMilestoneId) {
      return defaultMilestoneId;
    }

    if (!projectId) {
      return null;
    }

    const milestones = await fetchMilestones(projectId);
    return milestones[0]?.id ?? null;
  }, [defaultMilestoneId, projectId]);

  const resolveTaskForApproval = useCallback(
    async (taskIdentifier: string): Promise<Task | null> => {
      if (!projectId) {
        return null;
      }

      const board = await fetchBoard(projectId);
      const allTasks = Object.values(board).flat();
      const normalizedIdentifier = taskIdentifier.trim().toLowerCase();

      const exactIdMatch = allTasks.find(
        (task) => task.id.toLowerCase() === normalizedIdentifier,
      );
      if (exactIdMatch) {
        return exactIdMatch;
      }

      const exactTitleMatches = allTasks.filter(
        (task) => task.title.trim().toLowerCase() === normalizedIdentifier,
      );
      if (exactTitleMatches.length > 1) {
        throw new Error(
          `Multiple tasks match "${taskIdentifier}". Please use the Task ID.`,
        );
      }
      if (exactTitleMatches.length === 1) {
        return exactTitleMatches[0];
      }

      const partialTitleMatches = allTasks.filter((task) =>
        task.title.toLowerCase().includes(normalizedIdentifier),
      );
      if (partialTitleMatches.length > 1) {
        throw new Error(
          `Multiple tasks match "${taskIdentifier}". Please use the Task ID.`,
        );
      }
      if (partialTitleMatches.length === 1) {
        return partialTitleMatches[0];
      }

      return null;
    },
    [projectId],
  );

  const resolveLatestPendingSubmission = useCallback(
    (submissions: TaskSubmission[]): TaskSubmission | null => {
      const pendingSubmissions = submissions.filter(
        (submission) => submission.status === "PENDING",
      );

      if (pendingSubmissions.length === 0) {
        return null;
      }

      pendingSubmissions.sort((first, second) => {
        if (first.version !== second.version) {
          return second.version - first.version;
        }

        return (
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
        );
      });

      return pendingSubmissions[0];
    },
    [],
  );

  const ensureProjectRoomJoin = useCallback(
    (socket: Socket, targetProjectId: string, timeoutMs = 6000): Promise<void> => {
      if (joinedProjectIdRef.current === targetProjectId) {
        return Promise.resolve();
      }

      if (!socket.connected) {
        return Promise.reject(new Error("Socket is not connected"));
      }

      if (joinInFlightRef.current) {
        return joinInFlightRef.current;
      }

      const joinPromise = new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          window.clearTimeout(timeoutId);
          socket.off("exception", onException);
        };

        const settle = (error?: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (error) {
            reject(error);
            return;
          }
          resolve();
        };

        const onException = (payload: unknown) => {
          const message = extractSocketError(payload) ?? "Failed to join workspace chat";
          settle(new Error(message));
        };

        const timeoutId = window.setTimeout(() => {
          settle(new Error("Join workspace room timeout"));
        }, timeoutMs);

        socket.once("exception", onException);
        socket.emit("joinProjectChat", { projectId: targetProjectId }, (ack?: unknown) => {
          const socketError = extractSocketError(ack);
          if (socketError) {
            settle(new Error(socketError));
            return;
          }
          joinedProjectIdRef.current = targetProjectId;
          settle();
        });
      }).finally(() => {
        joinInFlightRef.current = null;
      });

      joinInFlightRef.current = joinPromise;
      return joinPromise;
    },
    [],
  );

  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || !projectId || isSending) {
      return;
    }

    const taskCommandMatch = trimmedInput.match(/^\/task\s+(.+)$/i);
    if (taskCommandMatch) {
      const taskTitle = taskCommandMatch[1]?.trim();
      if (!taskTitle) {
        toast.error("Please provide a task title after /task");
        return;
      }

      setIsSending(true);
      try {
        const milestoneId = await resolveTaskMilestoneId();
        if (!milestoneId) {
          toast.error("No milestone found for this project. Create/select a milestone first.");
          return;
        }

        const createdTask = await createTask({
          title: taskTitle,
          projectId,
          milestoneId,
        });

        onTaskCreated?.(createdTask);
        setInputValue("");
        toast.success(`Task created: ${taskTitle}`);

        const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);
        await waitForSocketConnection(socket, 10000);
        await ensureProjectRoomJoin(socket, projectId);
        socket.emit("sendProjectMessage", {
          projectId,
          content: `Created a new task: ${taskTitle}`,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create task from command";
        console.error("Failed to execute /task command", error);
        toast.error(errorMessage);
      } finally {
        setIsSending(false);
      }

      return;
    }

    const approveCommandMatch = trimmedInput.match(/^\/approve\s+(.+)$/i);
    if (approveCommandMatch) {
      const taskIdentifier = approveCommandMatch[1]?.trim();
      if (!taskIdentifier) {
        toast.error("Please provide a task ID or title after /approve");
        return;
      }

      if (!canReviewTasks) {
        toast.error("Bạn không có quyền duyệt task trong dự án này.");
        return;
      }

      setIsSending(true);
      try {
        const targetTask = await resolveTaskForApproval(taskIdentifier);
        if (!targetTask) {
          toast.error(`Task not found: ${taskIdentifier}`);
          return;
        }

        const submissions = await fetchTaskSubmissions(targetTask.id);
        const pendingSubmission = resolveLatestPendingSubmission(submissions);
        if (!pendingSubmission) {
          toast.error("Task này chưa có bài nộp đang chờ duyệt (Pending).");
          return;
        }

        const reviewResult = await reviewSubmission(targetTask.id, pendingSubmission.id, {
          status: "APPROVED",
        });
        const approvedTask = reviewResult.task;

        onTaskCreated?.(approvedTask);
        setInputValue("");
        toast.success("Task approved successfully!");

        const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);
        await waitForSocketConnection(socket, 10000);
        await ensureProjectRoomJoin(socket, projectId);
        socket.emit("sendProjectMessage", {
          projectId,
          content: `I have just approved the task: ${approvedTask.title}. Great work!`,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to approve task from command";
        console.error("Failed to execute /approve command", error);
        toast.error(errorMessage);
      } finally {
        setIsSending(false);
      }

      return;
    }

    if (/^\/task$/i.test(trimmedInput)) {
      toast.error("Please provide a task title after /task");
      return;
    }

    if (/^\/approve$/i.test(trimmedInput)) {
      toast.error("Please provide a task ID or title after /approve");
      return;
    }

    if (trimmedInput.startsWith("/")) {
      triggerSlashCommand(trimmedInput);
      setInputValue("");
      return;
    }

    const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);

    setIsSending(true);

    try {
      await waitForSocketConnection(socket, 10000);
      await ensureProjectRoomJoin(socket, projectId);
      lastSendAttemptAtRef.current = Date.now();

      console.log("Sending message:", trimmedInput, {
        projectId,
        socketId: socket.id,
      });
      socket.emit("sendProjectMessage", {
        projectId,
        content: trimmedInput,
      });

      setInputValue("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send message";
      console.error("Failed to send workspace chat message", error);
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [
    canReviewTasks,
    ensureProjectRoomJoin,
    inputValue,
    isSending,
    onTaskCreated,
    projectId,
    resolveLatestPendingSubmission,
    resolveTaskForApproval,
    resolveTaskMilestoneId,
    triggerSlashCommand,
  ]);

  const handleComposerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleSendMessage();
    },
    [handleSendMessage],
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      if (event.nativeEvent.isComposing) {
        return;
      }

      event.preventDefault();
      void handleSendMessage();
    },
    [handleSendMessage],
  );

  const loadOlderMessages = useCallback(async () => {
    if (
      !isOpen ||
      !projectId ||
      !hasMore ||
      isHistoryLoading ||
      isLoadingMoreRef.current
    ) {
      return;
    }

    const container = messagesContainerRef.current;
    const previousScrollTop = container?.scrollTop ?? 0;
    const previousScrollHeight = container?.scrollHeight ?? 0;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await apiClient.get<WorkspaceChatHistoryResponse>(
        `/workspace-chat/projects/${projectId}/messages?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`,
      );

      const receivedCount = Array.isArray(response.data) ? response.data.length : 0;
      const normalized = (response.data || [])
        .map((message) => normalizeWorkspaceMessage(message))
        .filter((message): message is WorkspaceChatMessage => Boolean(message));

      setMessages((currentMessages) =>
        mergeUniqueMessages(normalized, currentMessages),
      );
      setOffset((currentOffset) => currentOffset + receivedCount);
      setHasMore(receivedCount === HISTORY_PAGE_SIZE);

      window.requestAnimationFrame(() => {
        const nextContainer = messagesContainerRef.current;
        if (!nextContainer) {
          return;
        }

        const nextScrollHeight = nextContainer.scrollHeight;
        nextContainer.scrollTop =
          previousScrollTop + (nextScrollHeight - previousScrollHeight);
      });
    } catch (error) {
      console.error("Failed to load older workspace chat messages", error);
      toast.error("Failed to load older messages");
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, isHistoryLoading, isOpen, offset, projectId]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    if (container.scrollTop <= TOP_SCROLL_THRESHOLD) {
      void loadOlderMessages();
    }
  }, [loadOlderMessages]);

  useEffect(() => {
    if (!isOpen || !projectId) {
      return;
    }

    let cancelled = false;
    setMessages([]);
    setOffset(0);
    setHasMore(true);
    setIsLoadingMore(false);
    isLoadingMoreRef.current = false;
    setIsHistoryLoading(true);

    const loadInitialHistory = async () => {
      try {
        const response = await apiClient.get<WorkspaceChatHistoryResponse>(
          `/workspace-chat/projects/${projectId}/messages?limit=${HISTORY_PAGE_SIZE}&offset=0`,
        );

        if (cancelled) {
          return;
        }

        const receivedCount = Array.isArray(response.data) ? response.data.length : 0;
        const normalized = (response.data || [])
          .map((message) => normalizeWorkspaceMessage(message))
          .filter((message): message is WorkspaceChatMessage => Boolean(message));

        setMessages(sortMessagesAsc(normalized));
        setOffset(receivedCount);
        setHasMore(receivedCount === HISTORY_PAGE_SIZE);

        window.requestAnimationFrame(() => {
          scrollToBottom();
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load workspace chat history", error);
        toast.error("Failed to load chat history");
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    void loadInitialHistory();

    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId, scrollToBottom]);

  useEffect(() => {
    if (!isOpen || !projectId) {
      return;
    }

    const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);

    const shouldToastError = (): boolean => {
      return Date.now() - lastSendAttemptAtRef.current < 5000;
    };

    const joinProjectRoom = async () => {
      if (!socket.connected || joinedProjectIdRef.current === projectId) {
        return;
      }

      try {
        await ensureProjectRoomJoin(socket, projectId);
        console.log("Joined workspace chat room", {
          projectId,
          socketId: socket.id,
        });
      } catch (error) {
        joinedProjectIdRef.current = null;
        const message =
          error instanceof Error ? error.message : "Unable to join workspace chat room";
        if (shouldToastError() && !isTransientSocketError(message)) {
          toast.error(message);
        } else {
          console.warn("Workspace chat join skipped (transient)", { projectId, error });
        }
      }
    };

    const handleNewProjectMessage = (incoming: Partial<WorkspaceChatMessage>) => {
      console.log("Received newProjectMessage", incoming);
      const normalizedMessage = normalizeWorkspaceMessage(incoming);
      if (!normalizedMessage || normalizedMessage.projectId !== projectId) {
        return;
      }

      const shouldAutoScroll = isNearBottom();
      setMessages((currentMessages) =>
        mergeUniqueMessages(currentMessages, [normalizedMessage]),
      );

      if (shouldAutoScroll) {
        window.requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
    };

    const handleSocketConnectError = (error: Error) => {
      if (isTransientSocketError(error.message)) {
        console.debug("Workspace chat transient connect error", error.message);
        return;
      }

      console.error("Workspace chat socket connection failed", error);
      if (shouldToastError()) {
        toast.error(error.message || "Unable to connect to workspace chat");
      }
    };

    const handleSocketConnect = () => {
      void joinProjectRoom();
    };

    const handleSocketDisconnect = (reason: string) => {
      joinedProjectIdRef.current = null;
      console.warn("Workspace chat socket disconnected", { reason, projectId });
    };

    const handleWorkspaceChatError = (payload: unknown) => {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "Failed to send workspace message";

      if (isTransientSocketError(message)) {
        console.debug("Workspace chat transient send error", message);
        return;
      }

      console.error("Workspace chat send failed", payload);
      if (shouldToastError()) {
        toast.error(message);
      }
    };

    const handleSocketException = (payload: unknown) => {
      const message = extractSocketError(payload) ?? "Workspace chat exception";
      if (isTransientSocketError(message)) {
        console.debug("Workspace chat transient exception", message);
        return;
      }

      console.error("Workspace chat socket exception", payload);
      if (shouldToastError()) {
        toast.error(message);
      }
    };

    socket.on("connect", handleSocketConnect);
    socket.on("newProjectMessage", handleNewProjectMessage);
    socket.on("connect_error", handleSocketConnectError);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("workspaceChatError", handleWorkspaceChatError);
    socket.on("exception", handleSocketException);

    if (socket.connected) {
      void joinProjectRoom();
    }

    return () => {
      if (joinedProjectIdRef.current === projectId) {
        joinedProjectIdRef.current = null;
      }
      joinInFlightRef.current = null;
      socket.off("connect", handleSocketConnect);
      socket.off("newProjectMessage", handleNewProjectMessage);
      socket.off("connect_error", handleSocketConnectError);
      socket.off("disconnect", handleSocketDisconnect);
      socket.off("workspaceChatError", handleWorkspaceChatError);
      socket.off("exception", handleSocketException);
    };
  }, [ensureProjectRoomJoin, isNearBottom, isOpen, projectId, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  return (
    <aside
      className={`fixed right-0 top-0 z-50 flex h-screen w-96 max-w-[100vw] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!isOpen}
    >
      <header className="border-b border-slate-200 px-4 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{projectTitle}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Online</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat drawer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
        >
          <Sparkles className="h-4 w-4" />
          <span>AI Summary</span>
        </button>
      </header>

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 space-y-4 overflow-y-auto bg-slate-50/80 px-4 py-4"
      >
        {isLoadingMore && (
          <p className="text-center text-xs text-slate-400">Loading older messages...</p>
        )}
        {!projectId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Missing project context. Unable to load chat.
          </div>
        ) : isHistoryLoading ? (
          <p className="text-sm text-slate-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p>
        ) : (
          messages.map((message) => {
            const isMe =
              Boolean(resolvedCurrentUserId) &&
              message.senderId === resolvedCurrentUserId;

            const senderLabel = isMe
              ? "You"
              : message.sender?.fullName || `User ${message.senderId.slice(0, 6)}`;

            return (
              <div
                key={message.id}
                className={`group relative flex ${
                  isMe ? "justify-end" : "justify-start"
                }`}
              >
                <div className={`max-w-[85%] ${isMe ? "items-end" : "items-start"}`}>
                  <p
                    className={`mb-1 text-[11px] font-medium ${
                      isMe ? "text-right text-slate-500" : "text-slate-500"
                    }`}
                  >
                    {senderLabel}
                  </p>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      isMe
                        ? "rounded-tr-md bg-blue-600 text-white"
                        : "rounded-tl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    }`}
                  >
                    {message.content}
                  </div>
                  <p
                    className={`mt-1 text-[10px] ${
                      isMe ? "text-right text-slate-400" : "text-slate-400"
                    }`}
                  >
                    {formatMessageTime(message.createdAt)}
                  </p>
                </div>

                <div
                  className={`pointer-events-none absolute top-6 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 ${
                    isMe ? "-left-10" : "-right-10"
                  }`}
                >
                  <button
                    type="button"
                    aria-label="Mark as evidence"
                    onClick={() => {
                      console.log("Mark as evidence clicked", {
                        messageId: message.id,
                        projectId: message.projectId,
                      });
                      toast.info("Evidence flag action triggered");
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-500 shadow-sm transition-colors hover:bg-rose-50"
                  >
                    <Flag className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white p-4">
        <div className="relative">
          {shouldShowCommandPopover && (
            <div className="absolute -top-28 left-0 right-0 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={() => handleCommandQuickAction("/task")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">/task</span>
                <span className="text-xs text-slate-500">Create Task</span>
              </button>
              <button
                type="button"
                onClick={() => handleCommandQuickAction("/approve")}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">/approve</span>
                <span className="text-xs text-slate-500">Approve Work</span>
              </button>
            </div>
          )}

          <form onSubmit={handleComposerSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={!projectId || isSending}
              className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Type message or '/' for commands"
            />
            <button
              type="submit"
              disabled={!projectId || isSending || inputValue.trim().length === 0}
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </footer>
    </aside>
  );
}

