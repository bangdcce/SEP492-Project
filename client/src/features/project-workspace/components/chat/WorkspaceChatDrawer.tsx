import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Flag,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Send,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { STORAGE_KEYS } from "@/constants";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/shared/components/ui/popover";
import {
  createTask,
  fetchBoard,
  fetchMilestones,
  fetchTaskSubmissions,
  reviewSubmission,
} from "../../api";
import type { Task, TaskSubmission } from "../../types";
import { apiClient } from "@/shared/api/client";
import { uploadImageToServer } from "../../utils/file-upload.service";
import {
  connectNamespacedSocket,
} from "@/shared/realtime/socket";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { getStoredJson } from "@/shared/utils/storage";

interface WorkspaceChatDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  projectId?: string;
  currentUserId?: string;
  projectMembers?: WorkspaceChatMentionMember[];
  canReviewTasks?: boolean;
  canUseTaskCommand?: boolean;
  taskCommandUnavailableMessage?: string | null;
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

interface WorkspaceChatAttachment {
  url: string;
  name: string;
  type: string;
}

interface WorkspaceChatEditHistoryEntry {
  content: string;
  editedAt: string;
  editorId: string | null;
}

type WorkspaceChatMentionRole = "CLIENT" | "BROKER" | "FREELANCER";

interface WorkspaceChatMentionMember {
  id: string;
  fullName: string;
  role: WorkspaceChatMentionRole;
}

interface MentionContextState {
  startIndex: number;
  endIndex: number;
  query: string;
}

type WorkspaceChatMessageType = "USER" | "SYSTEM";

interface WorkspaceChatMessage {
  id: string;
  projectId: string;
  senderId: string | null;
  taskId: string | null;
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

interface WorkspaceChatMutationResponse {
  success: boolean;
  data: WorkspaceChatMessage;
}

const WORKSPACE_CHAT_NAMESPACE = "/ws/workspace";
const HISTORY_PAGE_SIZE = 20;
const TOP_SCROLL_THRESHOLD = 40;
const TASK_COMMAND_FALLBACK_MESSAGE =
  "Cannot create tasks via chat for the selected milestone right now.";
const POLICY_WARNING_MESSAGE =
  "Warning: Discussing off-platform payments violates Terms of Service and voids Escrow protection.";
const LEGAL_EXPORT_FOOTER =
  "This record is securely extracted from InterDev System. Tampering with this document is strictly prohibited and it holds legal reference value for Dispute Hearings.";
const DELETED_MESSAGE_PLACEHOLDER = "[Tin nhắn đã bị thu hồi]";
const EDITED_MESSAGE_LABEL = "Đã chỉnh sửa";
const FALLBACK_RISK_RULES = [
  { flag: "MOMO", pattern: /\bmomo\b/i },
  { flag: "ZALO", pattern: /\bzalo\b/i },
  { flag: "SKYPE", pattern: /\bskype\b/i },
  { flag: "BANK_TRANSFER", pattern: /\bchuyen khoan\b/i },
  { flag: "BANK", pattern: /\bbank\b/i },
  { flag: "NGAN_HANG", pattern: /\bngan hang\b/i },
  { flag: "OFF_PLATFORM", pattern: /\bngoai luong\b/i },
] as const;
const IMAGE_ATTACHMENT_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const MENTION_HIGHLIGHT_CLASSNAME =
  "rounded bg-blue-50 px-1 font-semibold text-blue-700";
const OWN_MENTION_HIGHLIGHT_CLASSNAME =
  "rounded bg-white/20 px-1 font-semibold text-white";

const getStoredCurrentUserId = (): string | undefined => {
  const user = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);
  if (!user?.id) return undefined;
  return user.id;
};

const normalizeForRiskScan = (content: string): string => {
  return content.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
};

const normalizeMentionSearchValue = (content: string): string => {
  return normalizeForRiskScan(content).replace(/\s+/g, " ").trim();
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const detectFallbackRiskFlags = (content: string): string[] => {
  const normalized = normalizeForRiskScan(content);
  return FALLBACK_RISK_RULES.filter((rule) => rule.pattern.test(normalized)).map(
    (rule) => rule.flag,
  );
};

const getMessageRiskFlags = (message: WorkspaceChatMessage): string[] => {
  if (Array.isArray(message.riskFlags) && message.riskFlags.length > 0) {
    return message.riskFlags;
  }

  return detectFallbackRiskFlags(message.content);
};

const isSystemMessage = (message: WorkspaceChatMessage): boolean => {
  return message.messageType === "SYSTEM" || !message.senderId;
};

const toIsoDate = (value: unknown): string => {
  const parsed = value ? new Date(value as string | number | Date) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const normalizeAttachment = (
  value: Partial<WorkspaceChatAttachment> | null | undefined,
): WorkspaceChatAttachment | null => {
  if (!value?.url || typeof value.url !== "string") {
    return null;
  }

  const url = value.url.trim();
  if (!url) {
    return null;
  }

  const name =
    typeof value.name === "string" && value.name.trim().length > 0
      ? value.name.trim()
      : url.split("/").pop()?.split("?")[0] || "attachment";
  const type =
    typeof value.type === "string" && value.type.trim().length > 0
      ? value.type.trim()
      : "application/octet-stream";

  return { url, name, type };
};

const normalizeAttachments = (value: unknown): WorkspaceChatAttachment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((attachment) => normalizeAttachment(attachment as Partial<WorkspaceChatAttachment>))
    .filter((attachment): attachment is WorkspaceChatAttachment => Boolean(attachment));
};

const normalizeEditHistory = (value: unknown): WorkspaceChatEditHistoryEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as Partial<WorkspaceChatEditHistoryEntry>;
      if (!candidate.content || !candidate.editedAt) {
        return null;
      }

      return {
        content: candidate.content,
        editedAt: toIsoDate(candidate.editedAt),
        editorId:
          typeof candidate.editorId === "string" ? candidate.editorId : null,
      };
    })
    .filter((entry): entry is WorkspaceChatEditHistoryEntry => Boolean(entry));
};

const isImageAttachment = (attachment: WorkspaceChatAttachment): boolean => {
  return (
    attachment.type.toLowerCase().startsWith("image/") ||
    IMAGE_ATTACHMENT_PATTERN.test(attachment.name) ||
    IMAGE_ATTACHMENT_PATTERN.test(attachment.url)
  );
};

const getVisibleMessageContent = (message: WorkspaceChatMessage): string => {
  if (message.isDeleted) {
    return DELETED_MESSAGE_PLACEHOLDER;
  }

  return message.content;
};

const getMentionContext = (
  value: string,
  caretPosition: number | null | undefined,
): MentionContextState | null => {
  if (caretPosition == null) {
    return null;
  }

  const safeCaret = Math.max(0, Math.min(caretPosition, value.length));
  const beforeCaret = value.slice(0, safeCaret);
  const triggerIndex = beforeCaret.lastIndexOf("@");

  if (triggerIndex < 0) {
    return null;
  }

  const charBefore = triggerIndex > 0 ? beforeCaret[triggerIndex - 1] : "";
  if (charBefore && !/\s/.test(charBefore)) {
    return null;
  }

  const query = beforeCaret.slice(triggerIndex + 1);
  if (/\s/.test(query)) {
    return null;
  }

  const trailingSlice = value.slice(safeCaret);
  const boundaryOffset = trailingSlice.search(/\s/);

  return {
    startIndex: triggerIndex,
    endIndex: boundaryOffset === -1 ? value.length : safeCaret + boundaryOffset,
    query,
  };
};

const renderMessageWithMentions = (
  content: string,
  members: WorkspaceChatMentionMember[],
  isOwnMessage: boolean,
): ReactNode => {
  if (!content || members.length === 0) {
    return content;
  }

  const uniqueNames = Array.from(
    new Set(
      members
        .map((member) => member.fullName.trim())
        .filter((fullName) => fullName.length > 0),
    ),
  ).sort((first, second) => second.length - first.length);

  if (uniqueNames.length === 0) {
    return content;
  }

  const mentionPattern = uniqueNames
    .map((fullName) => escapeRegex(`@${fullName}`))
    .join("|");
  const mentionRegex = new RegExp(
    `(^|\\s)(${mentionPattern})(?=$|[\\s.,!?;:])`,
    "g",
  );
  const segments: ReactNode[] = [];
  let cursor = 0;
  let matchCount = 0;

  for (const match of content.matchAll(mentionRegex)) {
    const leadingWhitespace = match[1] ?? "";
    const mentionText = match[2] ?? "";
    const matchStart = match.index ?? 0;
    const mentionStart = matchStart + leadingWhitespace.length;
    const mentionEnd = mentionStart + mentionText.length;

    if (!mentionText) {
      continue;
    }

    if (cursor < mentionStart) {
      segments.push(content.slice(cursor, mentionStart));
    }

    segments.push(
      <span
        key={`mention-${matchCount}`}
        className={
          isOwnMessage
            ? OWN_MENTION_HIGHLIGHT_CLASSNAME
            : MENTION_HIGHLIGHT_CLASSNAME
        }
      >
        {mentionText}
      </span>,
    );

    cursor = mentionEnd;
    matchCount += 1;
  }

  if (matchCount === 0) {
    return content;
  }

  if (cursor < content.length) {
    segments.push(content.slice(cursor));
  }

  return segments;
};

const normalizeWorkspaceMessage = (
  value: Partial<WorkspaceChatMessage> | null | undefined,
): WorkspaceChatMessage | null => {
  if (!value?.id || !value.projectId) {
    return null;
  }

  return {
    id: value.id,
    projectId: value.projectId,
    senderId: value.senderId ?? null,
    taskId: value.taskId ?? null,
    messageType: value.messageType === "SYSTEM" ? "SYSTEM" : "USER",
    content: typeof value.content === "string" ? value.content : "",
    attachments: normalizeAttachments(value.attachments),
    isPinned: Boolean(value.isPinned),
    isEdited: Boolean(value.isEdited),
    editHistory: normalizeEditHistory(value.editHistory),
    isDeleted: Boolean(value.isDeleted),
    riskFlags: Array.isArray(value.riskFlags)
      ? value.riskFlags.filter((flag): flag is string => typeof flag === "string")
      : [],
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

const formatLegalTimestamp = (isoTimestamp: string): string => {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(isoTimestamp));
};

const sanitizeExcelContent = (value: string): string => {
  return value
    .replace(/\r\n|\r|\n/g, " | ")
    .replace(/\t/g, " ")
    .replace(/\s+\|\s+/g, " | ")
    .replace(/\s{2,}/g, " ")
    .trim();
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
  projectMembers = [],
  canReviewTasks = false,
  canUseTaskCommand = true,
  taskCommandUnavailableMessage = null,
  defaultMilestoneId = null,
  projectTitle = "Project Workspace Chat",
  showCommandPopover = false,
  onTaskCreated,
}: WorkspaceChatDrawerProps) {
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<WorkspaceChatAttachment[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [activeMessageActionId, setActiveMessageActionId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [mentionContext, setMentionContext] = useState<MentionContextState | null>(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const joinedProjectIdRef = useRef<string | null>(null);
  const joinInFlightRef = useRef<Promise<void> | null>(null);
  const lastSendAttemptAtRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const resolvedCurrentUserId = currentUserId ?? getStoredCurrentUserId();
  const resolvedTaskCommandUnavailableMessage =
    taskCommandUnavailableMessage || TASK_COMMAND_FALLBACK_MESSAGE;
  const availableSlashCommands = useMemo(
    () =>
      [
        canUseTaskCommand
          ? {
              key: "/task" as const,
              title: "Create Task",
              icon: Zap,
              iconClassName: "text-amber-500",
            }
          : null,
        canReviewTasks
          ? {
              key: "/approve" as const,
              title: "Approve Work",
              icon: CheckCircle2,
              iconClassName: "text-emerald-500",
            }
          : null,
      ].filter((command): command is NonNullable<typeof command> => Boolean(command)),
    [canReviewTasks, canUseTaskCommand],
  );

  const shouldShowCommandPopover =
    showCommandPopover &&
    inputValue.trimStart().startsWith("/") &&
    availableSlashCommands.length > 0;
  const filteredMentionMembers = useMemo(() => {
    if (!mentionContext || inputValue.trimStart().startsWith("/") || projectMembers.length === 0) {
      return [];
    }

    const normalizedQuery = normalizeMentionSearchValue(mentionContext.query);
    if (!normalizedQuery) {
      return projectMembers;
    }

    return projectMembers.filter((member) =>
      normalizeMentionSearchValue(member.fullName).includes(normalizedQuery),
    );
  }, [inputValue, mentionContext, projectMembers]);
  const shouldShowMentionPopover =
    isMentionOpen &&
    !shouldShowCommandPopover &&
    Boolean(mentionContext) &&
    projectMembers.length > 0;
  const latestPinnedMessage = useMemo(() => {
    const pinnedMessages = messages.filter(
      (message) => message.isPinned && !isSystemMessage(message) && !message.isDeleted,
    );
    if (pinnedMessages.length === 0) {
      return null;
    }

    return [...pinnedMessages].sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
    )[0];
  }, [messages]);
  const canSendCurrentMessage =
    Boolean(projectId) &&
    !isSending &&
    !isUploadingAttachments &&
    (inputValue.trim().length > 0 || pendingAttachments.length > 0);

  const closeMentionPopover = useCallback(() => {
    setMentionContext(null);
    setIsMentionOpen(false);
    setActiveMentionIndex(0);
  }, []);

  const syncMentionState = useCallback(
    (nextValue: string, caretPosition: number | null | undefined) => {
      if (nextValue.trimStart().startsWith("/") || projectMembers.length === 0) {
        closeMentionPopover();
        return;
      }

      const nextMentionContext = getMentionContext(nextValue, caretPosition);
      if (!nextMentionContext) {
        closeMentionPopover();
        return;
      }

      setMentionContext(nextMentionContext);
      setIsMentionOpen(true);
    },
    [closeMentionPopover, projectMembers.length],
  );

  const handleSelectMention = useCallback(
    (member: WorkspaceChatMentionMember) => {
      const input = inputRef.current;
      const currentValue = input?.value ?? inputValue;
      const caretPosition = input?.selectionStart ?? currentValue.length;
      const currentMentionContext =
        getMentionContext(currentValue, caretPosition) ?? mentionContext;

      if (!currentMentionContext) {
        return;
      }

      const mentionText = `@${member.fullName} `;
      const nextValue =
        currentValue.slice(0, currentMentionContext.startIndex) +
        mentionText +
        currentValue.slice(currentMentionContext.endIndex);
      const nextCaretPosition = currentMentionContext.startIndex + mentionText.length;

      setInputValue(nextValue);
      closeMentionPopover();

      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });
    },
    [closeMentionPopover, inputValue, mentionContext],
  );

  useEffect(() => {
    if (!isMentionOpen) {
      setActiveMentionIndex(0);
      return;
    }

    setActiveMentionIndex((currentIndex) => {
      if (filteredMentionMembers.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredMentionMembers.length - 1);
    });
  }, [filteredMentionMembers.length, isMentionOpen]);

  useEffect(() => {
    if (isMentionOpen) {
      setActiveMentionIndex(0);
    }
  }, [isMentionOpen, mentionContext?.query]);

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
      if (command === "/task" && !canUseTaskCommand) {
        toast.error(resolvedTaskCommandUnavailableMessage);
        return;
      }

      setInputValue(`${command} `);
      closeMentionPopover();
      inputRef.current?.focus();
    },
    [canUseTaskCommand, closeMentionPopover, resolvedTaskCommandUnavailableMessage],
  );

  const getTaskCommandErrorMessage = useCallback(
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 400 || status === 403) {
          return resolvedTaskCommandUnavailableMessage;
        }
      }

      return getApiErrorDetails(
        error,
        "Failed to create task from command",
      ).message;
    },
    [resolvedTaskCommandUnavailableMessage],
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

  const verifyPersistedTaskFromBoard = useCallback(
    async (
      milestoneId: string,
      createdTask: Task | null | undefined,
      fallbackTitle: string,
    ): Promise<Task> => {
      if (!projectId) {
        throw new Error("Project context is required to verify the created task.");
      }

      const board = await fetchBoard(projectId);
      const boardTasks = Object.values(board).flat();
      const normalizedMilestoneId = String(milestoneId);

      if (createdTask?.id) {
        const persistedById = boardTasks.find((task) => task.id === createdTask.id);
        if (persistedById) {
          return persistedById;
        }
      }

      const normalizedFallbackTitle = fallbackTitle.trim().toLowerCase();
      const persistedByTitle = boardTasks.filter(
        (task) =>
          task.title.trim().toLowerCase() === normalizedFallbackTitle &&
          String(task.milestoneId ?? "") === normalizedMilestoneId,
      );

      if (persistedByTitle.length === 1) {
        return persistedByTitle[0];
      }

      throw new Error(
        "Task command did not return a persisted task. Please try again or use Create Task.",
      );
    },
    [projectId],
  );

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

  const upsertMutatedMessage = useCallback((message: WorkspaceChatMessage) => {
    setMessages((currentMessages) => mergeUniqueMessages(currentMessages, [message]));
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const element = messageRefs.current[messageId];
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((currentValue) =>
        currentValue === messageId ? null : currentValue,
      );
    }, 1800);
  }, []);

  const handleAttachmentPickerClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemovePendingAttachment = useCallback((attachmentUrl: string) => {
    setPendingAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.url !== attachmentUrl),
    );
  }, []);

  const handleAttachmentInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) {
        return;
      }

      setIsUploadingAttachments(true);
      try {
        const uploadedAttachments = await Promise.all(
          files.map(async (file) => {
            const url = await uploadImageToServer(file);
            return {
              url,
              name: file.name || "attachment",
              type: file.type || "application/octet-stream",
            } satisfies WorkspaceChatAttachment;
          }),
        );

        setPendingAttachments((currentAttachments) => [
          ...currentAttachments,
          ...uploadedAttachments,
        ]);
        toast.success(
          `${uploadedAttachments.length} attachment${
            uploadedAttachments.length > 1 ? "s" : ""
          } uploaded.`,
        );
      } catch (error) {
        const message = getApiErrorDetails(error, "Failed to upload attachment").message;
        console.error("Failed to upload workspace chat attachment", error);
        toast.error(message);
      } finally {
        setIsUploadingAttachments(false);
        event.target.value = "";
      }
    },
    [],
  );

  const handleTogglePin = useCallback(
    async (message: WorkspaceChatMessage) => {
      if (!projectId) {
        return;
      }

      setActiveMessageActionId(message.id);
      try {
        const response = await apiClient.patch<WorkspaceChatMutationResponse>(
          `/workspace-chat/projects/${projectId}/messages/${message.id}/pin`,
          { isPinned: !message.isPinned },
        );
        const normalized = normalizeWorkspaceMessage(response.data);
        if (normalized) {
          upsertMutatedMessage(normalized);
        }
      } catch (error) {
        const messageText = getApiErrorDetails(error, "Failed to update pin state").message;
        console.error("Failed to toggle pinned workspace message", error);
        toast.error(messageText);
      } finally {
        setActiveMessageActionId(null);
      }
    },
    [projectId, upsertMutatedMessage],
  );

  const handleStartEdit = useCallback((message: WorkspaceChatMessage) => {
    setEditingMessageId(message.id);
    setEditingValue(message.content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditingValue("");
  }, []);

  const handleSaveEdit = useCallback(
    async (messageId: string) => {
      if (!projectId) {
        return;
      }

      const trimmedContent = editingValue.trim();
      if (!trimmedContent) {
        toast.error("Message content cannot be empty.");
        return;
      }

      setActiveMessageActionId(messageId);
      try {
        const response = await apiClient.patch<WorkspaceChatMutationResponse>(
          `/workspace-chat/projects/${projectId}/messages/${messageId}`,
          { content: trimmedContent },
        );
        const normalized = normalizeWorkspaceMessage(response.data);
        if (normalized) {
          upsertMutatedMessage(normalized);
        }
        handleCancelEdit();
      } catch (error) {
        const messageText = getApiErrorDetails(error, "Failed to edit message").message;
        console.error("Failed to edit workspace message", error);
        toast.error(messageText);
      } finally {
        setActiveMessageActionId(null);
      }
    },
    [editingValue, handleCancelEdit, projectId, upsertMutatedMessage],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!projectId) {
        return;
      }

      setActiveMessageActionId(messageId);
      try {
        const response = await apiClient.delete<WorkspaceChatMutationResponse>(
          `/workspace-chat/projects/${projectId}/messages/${messageId}`,
        );
        const normalized = normalizeWorkspaceMessage(response.data);
        if (normalized) {
          upsertMutatedMessage(normalized);
        }
        if (editingMessageId === messageId) {
          handleCancelEdit();
        }
      } catch (error) {
        const messageText = getApiErrorDetails(error, "Failed to delete message").message;
        console.error("Failed to delete workspace message", error);
        toast.error(messageText);
      } finally {
        setActiveMessageActionId(null);
      }
    },
    [editingMessageId, handleCancelEdit, projectId, upsertMutatedMessage],
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
    if (
      (!trimmedInput && pendingAttachments.length === 0) ||
      !projectId ||
      isSending ||
      isUploadingAttachments
    ) {
      return;
    }

    if (trimmedInput.startsWith("/") && pendingAttachments.length > 0) {
      toast.error("Slash commands do not support attachments.");
      return;
    }

    const taskCommandMatch = trimmedInput.match(/^\/task\s+(.+)$/i);
    if (taskCommandMatch) {
      const taskTitle = taskCommandMatch[1]?.trim();
      if (!taskTitle) {
        toast.error("Please provide a task title after /task");
        return;
      }

      if (!canUseTaskCommand) {
        toast.error(resolvedTaskCommandUnavailableMessage);
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

        const persistedTask = await verifyPersistedTaskFromBoard(
          milestoneId,
          createdTask,
          taskTitle,
        );

        onTaskCreated?.(persistedTask);
        setInputValue("");
        closeMentionPopover();
        toast.success(`Task created: ${persistedTask.title}`);
      } catch (error) {
        const errorMessage = getTaskCommandErrorMessage(error);
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
        closeMentionPopover();
        toast.success("Task approved successfully!");
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
      closeMentionPopover();
      return;
    }

    const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);

    setIsSending(true);

    try {
      await waitForSocketConnection(socket, 10000);
      await ensureProjectRoomJoin(socket, projectId);
      lastSendAttemptAtRef.current = Date.now();

      console.log("Sending message:", trimmedInput || "[attachment-only]", {
        projectId,
        socketId: socket.id,
        attachmentCount: pendingAttachments.length,
      });
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error("Send message timeout"));
        }, 6000);

        socket.emit(
          "sendProjectMessage",
          {
            projectId,
            content: trimmedInput,
            attachments: pendingAttachments,
          },
          (ack?: unknown) => {
            window.clearTimeout(timeoutId);
            const socketError = extractSocketError(ack);
            if (socketError) {
              reject(new Error(socketError));
              return;
            }
            resolve();
          },
        );
      });

      setInputValue("");
      setPendingAttachments([]);
      closeMentionPopover();
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
    canUseTaskCommand,
    closeMentionPopover,
    ensureProjectRoomJoin,
    getTaskCommandErrorMessage,
    inputValue,
    isSending,
    isUploadingAttachments,
    onTaskCreated,
    pendingAttachments,
    projectId,
    resolvedTaskCommandUnavailableMessage,
    resolveLatestPendingSubmission,
    resolveTaskForApproval,
    resolveTaskMilestoneId,
    verifyPersistedTaskFromBoard,
    triggerSlashCommand,
  ]);

  const handleComposerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleSendMessage();
    },
    [handleSendMessage],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setInputValue(nextValue);
      syncMentionState(nextValue, event.target.selectionStart);
    },
    [syncMentionState],
  );

  const handleInputSelectionChange = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    syncMentionState(input.value, input.selectionStart);
  }, [syncMentionState]);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (shouldShowMentionPopover) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (filteredMentionMembers.length > 0) {
            setActiveMentionIndex((currentIndex) =>
              (currentIndex + 1) % filteredMentionMembers.length,
            );
          }
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          if (filteredMentionMembers.length > 0) {
            setActiveMentionIndex((currentIndex) =>
              currentIndex <= 0
                ? filteredMentionMembers.length - 1
                : currentIndex - 1,
            );
          }
          return;
        }

        if ((event.key === "Enter" || event.key === "Tab") && filteredMentionMembers.length > 0) {
          event.preventDefault();
          const selectedMember =
            filteredMentionMembers[
              Math.min(activeMentionIndex, filteredMentionMembers.length - 1)
            ];
          if (selectedMember) {
            handleSelectMention(selectedMember);
          }
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeMentionPopover();
          return;
        }
      }

      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      if (event.nativeEvent.isComposing) {
        return;
      }

      event.preventDefault();
      void handleSendMessage();
    },
    [
      activeMentionIndex,
      closeMentionPopover,
      filteredMentionMembers,
      handleSelectMention,
      handleSendMessage,
      shouldShowMentionPopover,
    ],
  );

  const handleExportChat = useCallback(() => {
    if (!projectId) {
      toast.error("Missing project context. Unable to export chat.");
      return;
    }

    if (messages.length === 0) {
      toast.error("There are no chat records to export yet.");
      return;
    }

    const exportedAt = new Date();
    const dataRows = messages.map((message) => {
      const messageType = isSystemMessage(message) ? "System" : "User";
      const senderLabel = isSystemMessage(message)
        ? "System"
        : message.sender?.fullName?.trim() ||
          (message.senderId ? `User ${message.senderId.slice(0, 8)}` : "Unknown User");
      const riskFlags = getMessageRiskFlags(message);
      const attachmentSummary =
        message.attachments.length > 0
          ? ` | Attachments: ${message.attachments
              .map((attachment) => attachment.name)
              .join("; ")}`
          : "";
      const contentBase = getVisibleMessageContent(message);
      const content =
        riskFlags.length === 0 || message.isDeleted
          ? `${contentBase}${attachmentSummary}`
          : `${contentBase}${attachmentSummary} | Warning: ${POLICY_WARNING_MESSAGE} Matched flags: ${riskFlags.join(", ")}.`;

      return [
        formatLegalTimestamp(message.createdAt),
        senderLabel,
        messageType,
        sanitizeExcelContent(content),
      ];
    });

    const worksheetRows = [
      ["Metadata", "Value", "", ""],
      ["Project", projectTitle, "", ""],
      ["Project ID", projectId, "", ""],
      ["Exported At", formatLegalTimestamp(exportedAt.toISOString()), "", ""],
      ["", "", "", ""],
      ["Timestamp", "Sender", "Type", "Content"],
      ...dataRows,
      ["", "", "", ""],
      ["Legal Footer", LEGAL_EXPORT_FOOTER, "", ""],
    ];

    const safeProjectLabel = (projectTitle || projectId)
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "Project";
    const safeTimestamp = exportedAt.toISOString().replace(/[:.]/g, "-");
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 24 },
      { wch: 14 },
      { wch: 100 },
    ];
    worksheet["!autofilter"] = {
      ref: "A6:D6",
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chat Record");
    XLSX.writeFile(workbook, `Project_${safeProjectLabel}_${safeTimestamp}_ChatRecord.xlsx`, {
      compression: true,
    });
    toast.success("Chat record exported as Excel.");
  }, [messages, projectId, projectTitle]);

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

  useEffect(() => {
    if (!isOpen) {
      setEditingMessageId(null);
      setEditingValue("");
      setPendingAttachments([]);
      setHighlightedMessageId(null);
      closeMentionPopover();
    }
  }, [closeMentionPopover, isOpen]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditingValue("");
    setPendingAttachments([]);
    setHighlightedMessageId(null);
    closeMentionPopover();
  }, [closeMentionPopover, projectId]);

  return (
    <Sheet
      modal={false}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <SheetContent
        side="right"
        showOverlay={false}
        className="h-screen w-96 max-w-[100vw] gap-0 border-l border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[24rem]"
      >
        <header className="border-b border-slate-200 px-4 py-4 pr-14">
          <div className="mb-3">
            <SheetTitle className="text-sm font-semibold text-slate-900">
              {projectTitle}
            </SheetTitle>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Online</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportChat}
              disabled={!projectId || messages.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              <span>Export Record</span>
            </button>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
            >
              <Sparkles className="h-4 w-4" />
              <span>AI Summary</span>
            </button>
          </div>
        </header>

        {latestPinnedMessage && (
          <div className="border-b border-amber-200 bg-amber-50/80 px-4 py-3">
            <button
              type="button"
              onClick={() => scrollToMessage(latestPinnedMessage.id)}
              className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-left transition-colors hover:bg-white"
            >
              <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                  Pinned message
                </p>
                <p className="mt-1 truncate text-sm text-slate-700">
                  {(latestPinnedMessage.sender?.fullName || "Unknown User")}:{" "}
                  {getVisibleMessageContent(latestPinnedMessage) ||
                    latestPinnedMessage.attachments[0]?.name ||
                    "Attachment"}
                </p>
              </div>
            </button>
          </div>
        )}

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
              const systemMessage = isSystemMessage(message);
              const riskFlags = getMessageRiskFlags(message);
              const isRiskFlagged = !message.isDeleted && riskFlags.length > 0;
              const isMe =
                Boolean(resolvedCurrentUserId) &&
                message.senderId === resolvedCurrentUserId;
              const isEditing = editingMessageId === message.id;
              const isBusy = activeMessageActionId === message.id;

              if (systemMessage) {
                return (
                  <div
                    key={message.id}
                    ref={(node) => {
                      messageRefs.current[message.id] = node;
                    }}
                    className="flex justify-center"
                  >
                    <div className="max-w-[85%] text-center">
                      <p className="text-xs italic text-slate-500">{message.content}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              }

              const senderLabel = isMe
                ? "You"
                : message.sender?.fullName ||
                  (message.senderId ? `User ${message.senderId.slice(0, 6)}` : "Unknown User");
              const bubbleClassName = message.isDeleted
                ? "border border-rose-300 bg-rose-50/80 text-rose-700 shadow-sm"
                : isMe
                  ? isRiskFlagged
                    ? "rounded-tr-md bg-rose-600 text-white ring-1 ring-rose-200"
                    : "rounded-tr-md bg-blue-600 text-white"
                  : isRiskFlagged
                    ? "rounded-tl-md border border-rose-200 bg-rose-50 text-rose-950 shadow-sm"
                    : "rounded-tl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200";
              const editingShellClassName = isMe
                ? "rounded-tr-md bg-blue-600 text-white shadow-lg ring-1 ring-blue-300/70"
                : "rounded-tl-md border border-slate-200 bg-white text-slate-800 shadow-sm ring-1 ring-slate-200";
              const warningClassName = isMe ? "justify-end text-right text-rose-700" : "text-rose-700";
              const actionTriggerClassName = message.isDeleted
                ? "border border-rose-200 bg-white text-rose-600 hover:bg-rose-100"
                : isMe
                  ? "border border-white/20 bg-white/15 text-white hover:bg-white/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";

              return (
                <div
                  key={message.id}
                  ref={(node) => {
                    messageRefs.current[message.id] = node;
                  }}
                  className={`group relative flex ${
                    isMe ? "justify-end" : "justify-start"
                  } ${highlightedMessageId === message.id ? "rounded-2xl ring-2 ring-amber-300/80 ring-offset-2 ring-offset-slate-50" : ""}`}
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
                      className={
                        isEditing
                          ? "text-sm leading-relaxed"
                          : `relative rounded-2xl px-3 py-2 pr-12 text-sm leading-relaxed ${
                              message.isDeleted ? "italic" : ""
                            } ${bubbleClassName}`
                      }
                    >
                      {isEditing ? (
                        <div
                          className={`space-y-3 rounded-2xl px-4 py-4 ${editingShellClassName}`}
                        >
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                              isMe ? "text-blue-100/90" : "text-slate-500"
                            }`}
                          >
                            Editing message
                          </p>
                          <textarea
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            rows={3}
                            autoFocus
                            disabled={isBusy}
                            className={`min-h-[104px] w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-relaxed outline-none transition-colors ${
                              isMe
                                ? "border-white/20 bg-white/10 text-white placeholder:text-blue-100/80 focus:border-white/50 focus:bg-white/15"
                                : "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500"
                            }`}
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant={isMe ? "secondary" : "outline"}
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={isBusy}
                              className={isMe ? "bg-white/15 text-white hover:bg-white/20" : undefined}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleSaveEdit(message.id)}
                              disabled={isBusy || editingValue.trim().length === 0}
                              className={
                                isMe
                                  ? "bg-white text-blue-700 hover:bg-blue-50"
                                  : undefined
                              }
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              <span>{isBusy ? "Saving..." : "Save"}</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div
                            className={`absolute right-2 top-2 z-10 transition-all duration-150 ${
                              message.isDeleted
                                ? "opacity-100"
                                : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                            }`}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Message actions"
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors ${actionTriggerClassName}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    console.log("Mark as evidence clicked", {
                                      messageId: message.id,
                                      projectId: message.projectId,
                                    });
                                    toast.info("Evidence flag action triggered");
                                  }}
                                  disabled={message.isDeleted}
                                >
                                  <Flag className="h-4 w-4" />
                                  <span>Mark as evidence</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    void handleTogglePin(message);
                                  }}
                                  disabled={isBusy || message.isDeleted}
                                >
                                  {message.isPinned ? (
                                    <PinOff className="h-4 w-4" />
                                  ) : (
                                    <Pin className="h-4 w-4" />
                                  )}
                                  <span>{message.isPinned ? "Unpin" : "Pin"}</span>
                                </DropdownMenuItem>
                                {isMe && !message.isDeleted && (
                                  <DropdownMenuItem
                                    onSelect={() => handleStartEdit(message)}
                                    disabled={isBusy}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    <span>Edit</span>
                                  </DropdownMenuItem>
                                )}
                                {isMe && (
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      void handleDeleteMessage(message.id);
                                    }}
                                    disabled={isBusy || message.isDeleted}
                                    className="text-rose-600 focus:text-rose-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Delete</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {message.isDeleted ? (
                            <p className="italic text-slate-500">{DELETED_MESSAGE_PLACEHOLDER}</p>
                          ) : message.content ? (
                            <p className="whitespace-pre-wrap break-words">
                              {renderMessageWithMentions(
                                message.content,
                                projectMembers,
                                isMe,
                              )}
                            </p>
                          ) : null}

                          {!message.isDeleted && message.attachments.length > 0 && (
                            <div className="grid gap-2">
                              {message.attachments.map((attachment) =>
                                isImageAttachment(attachment) ? (
                                  <a
                                    key={`${message.id}-${attachment.url}`}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block overflow-hidden rounded-xl border border-black/10 bg-black/5"
                                  >
                                    <img
                                      src={attachment.url}
                                      alt={attachment.name}
                                      className="max-h-56 w-full object-cover"
                                      loading="lazy"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={`${message.id}-${attachment.url}`}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                                      isMe
                                        ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    }`}
                                  >
                                    <FileText className="h-4 w-4 shrink-0" />
                                    <span className="truncate text-sm">{attachment.name}</span>
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {isRiskFlagged && (
                      <p
                        className={`mt-2 flex items-start gap-1 text-[11px] leading-relaxed ${warningClassName}`}
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{POLICY_WARNING_MESSAGE}</span>
                      </p>
                    )}
                    <p
                      className={`${isRiskFlagged ? "mt-2" : "mt-1"} text-[10px] ${
                        isMe ? "text-right text-slate-400" : "text-slate-400"
                      }`}
                    >
                      {formatMessageTime(message.createdAt)}
                      {message.isEdited && !message.isDeleted ? ` · ${EDITED_MESSAGE_LABEL}` : ""}
                      {message.isPinned ? " · Pinned" : ""}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-4">
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleAttachmentInputChange(event);
              }}
            />
            {shouldShowCommandPopover && (
              <div className="absolute -top-28 left-0 right-0 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {availableSlashCommands.map((command, index) => {
                  const Icon = command.icon;

                  return (
                    <button
                      key={command.key}
                      type="button"
                      onClick={() => handleCommandQuickAction(command.key)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 ${
                        index > 0 ? "mt-1" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${command.iconClassName}`} />
                      <span className="font-medium">{command.key}</span>
                      <span className="text-xs text-slate-500">{command.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {pendingAttachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.url}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
                  >
                    {isImageAttachment(attachment) ? (
                      <span className="font-medium text-slate-700">Image</span>
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="max-w-[12rem] truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingAttachment(attachment.url)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                      aria-label={`Remove ${attachment.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Popover
              open={shouldShowMentionPopover}
              onOpenChange={(open) => {
                if (!open) {
                  closeMentionPopover();
                }
              }}
            >
              <PopoverAnchor asChild>
                <div className="absolute bottom-11 left-14 h-0 w-0" aria-hidden="true" />
              </PopoverAnchor>
              <PopoverContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-[22rem] p-0"
              >
                <Command className="rounded-xl">
                  <CommandList className="max-h-64">
                    <CommandEmpty>No matching member.</CommandEmpty>
                    <CommandGroup heading="Mention project member">
                      {filteredMentionMembers.map((member, index) => (
                        <CommandItem
                          key={member.id}
                          value={`${member.fullName}-${member.id}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onSelect={() => handleSelectMention(member)}
                          className={
                            index === activeMentionIndex
                              ? "bg-accent text-accent-foreground"
                              : undefined
                          }
                        >
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">
                              {member.fullName}
                            </span>
                            <span className="text-xs text-slate-500">
                              {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <form onSubmit={handleComposerSubmit} className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAttachmentPickerClick}
                disabled={!projectId || isSending || isUploadingAttachments}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                aria-label="Attach files"
              >
                {isUploadingAttachments ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onClick={handleInputSelectionChange}
                onKeyDown={handleInputKeyDown}
                onSelect={handleInputSelectionChange}
                disabled={!projectId || isSending || isUploadingAttachments}
                className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder="Type message, use @mention, attach files, or '/' for commands"
              />
              <button
                type="submit"
                disabled={!canSendCurrentMessage}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send message"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Send</span>
              </button>
            </form>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

