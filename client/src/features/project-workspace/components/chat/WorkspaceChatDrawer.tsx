import {
  memo,
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
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Search,
  Send,
  Trash2,
  Video,
  X,
  Zap,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { Workbook, type Fill } from "exceljs";
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
  deleteWorkspaceChatMessage,
  editWorkspaceChatMessage,
  emailWorkspaceChatExport,
  fetchTaskSubmissions,
  fetchWorkspaceChatMessages,
  reviewSubmission,
  toggleWorkspaceChatPin,
} from "../../api";
import type {
  Task,
  TaskSubmission,
  WorkspaceChatAttachment,
  WorkspaceChatEditHistoryEntry,
  WorkspaceChatMentionMember,
  WorkspaceChatMessage,
  WorkspaceChatReplySummary,
} from "../../types";
import { uploadImageToServer } from "../../utils/file-upload.service";
import {
  connectNamespacedSocket,
} from "@/shared/realtime/socket";
import { getApiErrorDetails } from "@/shared/utils/apiError";
import { getStoredJson } from "@/shared/utils/storage";
import {
  emailWorkspaceChatExportFile,
  WORKSPACE_CHAT_EXPORT_EMAIL_SUCCESS_MESSAGE,
} from "../../chat-export-email";

interface WorkspaceChatDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  projectId?: string;
  currentUserId?: string;
  projectMembers?: WorkspaceChatMentionMember[];
  workspaceTasks?: Task[];
  availableMilestoneIds?: string[];
  canReviewTasks?: boolean;
  canBrokerReviewTasks?: boolean;
  canClientReviewTasks?: boolean;
  canUseTaskCommand?: boolean;
  taskCommandUnavailableMessage?: string | null;
  defaultMilestoneId?: string | null;
  projectTitle?: string;
  showCommandPopover?: boolean;
  onTaskCreated?: (task: Task) => void;
}

interface MentionContextState {
  startIndex: number;
  endIndex: number;
  query: string;
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
const DELETED_MESSAGE_PLACEHOLDER = "[Message deleted]";
const EDITED_MESSAGE_LABEL = "Edited";
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
const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;
const JITSI_URL_PATTERN = /https:\/\/meet\.jit\.si\/[^\s]+/i;
const MENTION_HIGHLIGHT_CLASSNAME =
  "rounded bg-blue-50 px-1 font-semibold text-blue-700";
const OWN_MENTION_HIGHLIGHT_CLASSNAME =
  "rounded bg-blue-200/80 px-1 font-semibold text-blue-900";
const SEARCH_HIGHLIGHT_CLASSNAME =
  "rounded bg-amber-200 px-1 font-semibold text-slate-900";
const OWN_SEARCH_HIGHLIGHT_CLASSNAME =
  "rounded bg-amber-200/95 px-1 font-semibold text-slate-900";
const VIDEO_CALL_MESSAGE_PREFIX = "Video meeting room created:";

type WorkspaceVideoCallMatch = {
  url: string;
  roomName: string;
  beforeText: string;
  afterText: string;
  isExplicitVideoCall: boolean;
};

const getStoredCurrentUserId = (): string | undefined => {
  const user = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);
  if (!user?.id) return undefined;
  return user.id;
};

const getStoredCurrentUserRole = (): string | null => {
  const user = getStoredJson<{ role?: string }>(STORAGE_KEYS.USER);
  return user?.role?.toUpperCase() ?? null;
};

const normalizeForRiskScan = (content: string): string => {
  return content.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
};

const normalizeMentionSearchValue = (content: string): string => {
  return normalizeForRiskScan(content).replace(/\s+/g, " ").trim();
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeJitsiUrl = (value: string): string =>
  value.trim().replace(/[),.;!?]+$/, "");

const getJitsiRoomNameFromUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    const roomName = parsedUrl.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return decodeURIComponent(roomName || url);
  } catch {
    return url;
  }
};

const extractWorkspaceVideoCall = (content: string): WorkspaceVideoCallMatch | null => {
  if (!content) {
    return null;
  }

  const urlMatch = content.match(JITSI_URL_PATTERN);
  if (!urlMatch) {
    return null;
  }

  const rawUrl = urlMatch[0] ?? "";
  const url = normalizeJitsiUrl(rawUrl);
  const matchIndex = urlMatch.index ?? 0;
  const prefixIndex = content.indexOf(VIDEO_CALL_MESSAGE_PREFIX);
  const isExplicitVideoCall = prefixIndex !== -1 && prefixIndex <= matchIndex;

  let beforeText = content.slice(0, matchIndex);
  if (isExplicitVideoCall) {
    beforeText = beforeText.replace(VIDEO_CALL_MESSAGE_PREFIX, "").trimStart();
  }

  return {
    url,
    roomName: getJitsiRoomNameFromUrl(url),
    beforeText,
    afterText: content.slice(matchIndex + rawUrl.length),
    isExplicitVideoCall,
  };
};

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

  const getNameFromUrl = (input: string) => {
    try {
      const parsed = new URL(input);
      const fileNameFromHash = new URLSearchParams(parsed.hash.replace(/^#/, "")).get(
        "filename"
      );
      if (fileNameFromHash?.trim()) {
        return decodeURIComponent(fileNameFromHash);
      }

      const fileNameFromQuery = parsed.searchParams.get("filename");
      if (fileNameFromQuery?.trim()) {
        return decodeURIComponent(fileNameFromQuery);
      }
    } catch {
      const hash = input.split("#")[1] || "";
      const fileNameFromHash = new URLSearchParams(hash).get("filename");
      if (fileNameFromHash?.trim()) {
        return decodeURIComponent(fileNameFromHash);
      }
    }

    return input.split("/").pop()?.split("?")[0] || "attachment";
  };

  const name =
    typeof value.name === "string" && value.name.trim().length > 0
      ? value.name.trim()
      : getNameFromUrl(url);
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

const getReplyPreviewText = (
  message: Pick<WorkspaceChatMessage, "content" | "attachments" | "isDeleted"> |
    Pick<WorkspaceChatReplySummary, "content" | "attachments" | "isDeleted">,
): string => {
  if (message.isDeleted) {
    return DELETED_MESSAGE_PLACEHOLDER;
  }

  if (message.content.trim()) {
    return message.content.trim();
  }

  if (message.attachments.length > 0) {
    return `Attachment: ${message.attachments[0].name}`;
  }

  return "Empty message";
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

const normalizeWorkspaceChatReplySummary = (
  value: Partial<WorkspaceChatReplySummary> | null | undefined,
): WorkspaceChatReplySummary | null => {
  if (!value?.id) {
    return null;
  }

  return {
    id: value.id,
    messageType: value.messageType === "SYSTEM" ? "SYSTEM" : "USER",
    content: typeof value.content === "string" ? value.content : "",
    attachments: normalizeAttachments(value.attachments),
    isDeleted: Boolean(value.isDeleted),
    createdAt: toIsoDate(value.createdAt),
    sender: value.sender
      ? {
          id: value.sender.id,
          fullName: value.sender.fullName,
          role: value.sender.role,
        }
      : null,
  };
};

const renderHighlightedText = (
  text: string,
  searchTerm: string,
  keyPrefix: string,
  isOwnMessage: boolean,
): ReactNode[] => {
  if (!text) {
    return [];
  }

  if (!searchTerm.trim()) {
    return [text];
  }

  const escapedSearch = escapeRegex(searchTerm.trim());
  const searchRegex = new RegExp(`(${escapedSearch})`, "gi");
  const parts = text.split(searchRegex).filter((segment) => segment.length > 0);

  if (parts.length === 1) {
    return [text];
  }

  let partIndex = 0;
  return parts.map((part) => {
    const isMatch = part.toLowerCase() === searchTerm.trim().toLowerCase();
    const node = isMatch ? (
      <span
        key={`${keyPrefix}-search-${partIndex}`}
        className={isOwnMessage ? OWN_SEARCH_HIGHLIGHT_CLASSNAME : SEARCH_HIGHLIGHT_CLASSNAME}
      >
        {part}
      </span>
    ) : (
      <span key={`${keyPrefix}-text-${partIndex}`}>{part}</span>
    );
    partIndex += 1;
    return node;
  });
};

const renderTextWithLinksAndHighlight = (
  text: string,
  searchTerm: string,
  keyPrefix: string,
  isOwnMessage: boolean,
): ReactNode[] => {
  if (!text) {
    return [];
  }

  const segments: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0] ?? "";
    const matchStart = match.index ?? 0;

    if (cursor < matchStart) {
      segments.push(
        ...renderHighlightedText(
          text.slice(cursor, matchStart),
          searchTerm,
          `${keyPrefix}-segment-${matchIndex}`,
          isOwnMessage,
        ),
      );
    }

    segments.push(
      <a
        key={`${keyPrefix}-url-${matchIndex}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className={
          isOwnMessage
            ? "whitespace-normal break-words underline underline-offset-2 [overflow-wrap:anywhere] text-white"
            : "whitespace-normal break-words text-blue-600 underline underline-offset-2 [overflow-wrap:anywhere]"
        }
      >
        {renderHighlightedText(
          url,
          searchTerm,
          `${keyPrefix}-url-highlight-${matchIndex}`,
          isOwnMessage,
        )}
      </a>,
    );

    cursor = matchStart + url.length;
    matchIndex += 1;
  }

  if (cursor < text.length) {
    segments.push(
      ...renderHighlightedText(
        text.slice(cursor),
        searchTerm,
        `${keyPrefix}-tail`,
        isOwnMessage,
      ),
    );
  }

  return segments.length > 0 ? segments : [text];
};

const renderStandardMessageContent = (
  content: string,
  members: WorkspaceChatMentionMember[],
  isOwnMessage: boolean,
  searchTerm = "",
): ReactNode => {
  if (!content) {
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
    return renderTextWithLinksAndHighlight(content, searchTerm, "message", isOwnMessage);
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
      segments.push(
        ...renderTextWithLinksAndHighlight(
          content.slice(cursor, mentionStart),
          searchTerm,
          `segment-${matchCount}`,
          isOwnMessage,
        ),
      );
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
    return renderTextWithLinksAndHighlight(content, searchTerm, "message", isOwnMessage);
  }

  if (cursor < content.length) {
    segments.push(
      ...renderTextWithLinksAndHighlight(
        content.slice(cursor),
        searchTerm,
        "segment-tail",
        isOwnMessage,
      ),
    );
  }

  return segments;
};

type JitsiCallCardProps = {
  callUrl: string;
  roomName: string;
  isOwnMessage: boolean;
  searchTerm: string;
  onJoinCall?: (url: string) => void;
};

const JitsiCallCard = ({
  callUrl,
  roomName,
  isOwnMessage,
  searchTerm,
  onJoinCall,
}: JitsiCallCardProps) => {
  const cardClassName = isOwnMessage
    ? "border-blue-100/90 bg-white/90 text-slate-900 shadow-[0_8px_24px_-20px_rgba(37,99,235,0.4)]"
    : "border-slate-200 bg-white/95 text-slate-900 shadow-[0_8px_24px_-22px_rgba(15,23,42,0.18)]";
  const iconShellClassName = isOwnMessage
    ? "border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-50/80 text-blue-700"
    : "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 text-blue-700";
  const badgeClassName = isOwnMessage
    ? "border-blue-100 bg-blue-50/80 text-blue-700"
    : "border-slate-200 bg-white/90 text-slate-600";
  const roomShellClassName = isOwnMessage
    ? "border-blue-100/80 bg-blue-50/40"
    : "border-slate-200/80 bg-slate-50/80";
  const roomLabelClassName = isOwnMessage ? "text-blue-700/70" : "text-slate-500";
  const roomValueClassName = isOwnMessage
    ? "text-slate-800"
    : "text-slate-700";
  const primaryActionClassName =
    "h-8 rounded-lg bg-blue-600 px-3 text-[12px] font-medium text-white shadow-none hover:bg-blue-700";
  const secondaryActionClassName =
    "h-8 rounded-lg border-slate-200 bg-white/80 px-3 text-[12px] font-medium text-slate-700 shadow-none hover:bg-white hover:text-slate-900";

  return (
    <div
      className={`w-full max-w-full overflow-hidden rounded-2xl border px-3 py-2.5 text-left ${cardClassName}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconShellClassName}`}
        >
          <Video className="h-3.5 w-3.5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
                Video Call Started
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${badgeClassName}`}
            >
              Jitsi
            </span>
          </div>

          <div
            className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 ${roomShellClassName}`}
          >
            <p
              className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] ${roomLabelClassName}`}
            >
              Room
            </p>
            <div
              className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-medium leading-5 ${roomValueClassName}`}
              title={roomName}
            >
              {renderHighlightedText(
                roomName,
                searchTerm,
                `video-call-room-${roomName}`,
                isOwnMessage,
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-0.5 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              className={`w-full justify-center gap-1.5 sm:w-auto ${primaryActionClassName}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onJoinCall?.(callUrl);
              }}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Join Call</span>
            </Button>
            <Button variant="outline" size="sm" asChild className={secondaryActionClassName}>
              <a
                href={callUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in new tab</span>
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const renderMessageContent = (
  content: string,
  members: WorkspaceChatMentionMember[],
  isOwnMessage: boolean,
  searchTerm = "",
  options?: { onJoinCall?: (url: string) => void },
): ReactNode => {
  const videoCallMatch = extractWorkspaceVideoCall(content);
  if (!videoCallMatch) {
    return renderStandardMessageContent(content, members, isOwnMessage, searchTerm);
  }

  const leadingText = videoCallMatch.beforeText.trim();
  const trailingText = videoCallMatch.afterText.trim();

  return (
    <div className="min-w-0 max-w-full space-y-3">
      {leadingText ? (
        <div className="min-w-0 whitespace-pre-wrap break-words">
          {renderStandardMessageContent(leadingText, members, isOwnMessage, searchTerm)}
        </div>
      ) : null}

      <JitsiCallCard
        callUrl={videoCallMatch.url}
        roomName={videoCallMatch.roomName}
        isOwnMessage={isOwnMessage}
        searchTerm={searchTerm}
        onJoinCall={options?.onJoinCall}
      />

      {trailingText ? (
        <div className="min-w-0 whitespace-pre-wrap break-words">
          {renderStandardMessageContent(trailingText, members, isOwnMessage, searchTerm)}
        </div>
      ) : null}
    </div>
  );
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
    replyToId: value.replyToId ?? null,
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
    replyTo: normalizeWorkspaceChatReplySummary(value.replyTo),
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

const findSortedMessageInsertIndex = (
  messages: WorkspaceChatMessage[],
  createdAt: string,
): number => {
  const targetTime = new Date(createdAt).getTime();

  for (let index = 0; index < messages.length; index += 1) {
    const currentTime = new Date(messages[index].createdAt).getTime();
    if (currentTime > targetTime) {
      return index;
    }
  }

  return messages.length;
};

const upsertSortedMessage = (
  current: WorkspaceChatMessage[],
  incoming: WorkspaceChatMessage,
): WorkspaceChatMessage[] => {
  const existingIndex = current.findIndex((message) => message.id === incoming.id);

  if (existingIndex < 0) {
    const nextMessages = current.slice();
    nextMessages.splice(
      findSortedMessageInsertIndex(nextMessages, incoming.createdAt),
      0,
      incoming,
    );
    return nextMessages;
  }

  const existingMessage = current[existingIndex];
  if (existingMessage === incoming) {
    return current;
  }

  if (existingMessage.createdAt === incoming.createdAt) {
    const nextMessages = current.slice();
    nextMessages[existingIndex] = incoming;
    return nextMessages;
  }

  const nextMessages = current.slice();
  nextMessages.splice(existingIndex, 1);
  nextMessages.splice(
    findSortedMessageInsertIndex(nextMessages, incoming.createdAt),
    0,
    incoming,
  );
  return nextMessages;
};

const messageMatchesSearch = (
  message: WorkspaceChatMessage,
  searchTerm: string,
): boolean => {
  const normalizedQuery = searchTerm.trim().toLowerCase();
  if (!normalizedQuery || message.isDeleted) {
    return false;
  }

  return message.content.toLowerCase().includes(normalizedQuery);
};

const upsertSearchResultsWithMessage = (
  current: WorkspaceChatMessage[],
  incoming: WorkspaceChatMessage,
  searchTerm: string,
): WorkspaceChatMessage[] => {
  if (!searchTerm.trim()) {
    return current;
  }

  const existingIndex = current.findIndex((message) => message.id === incoming.id);
  const matchesSearch = messageMatchesSearch(incoming, searchTerm);

  if (!matchesSearch) {
    if (existingIndex < 0) {
      return current;
    }

    return current.filter((message) => message.id !== incoming.id);
  }

  return upsertSortedMessage(current, incoming);
};

const formatMessageTime = (isoTimestamp: string): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
};

const formatAuditTimestamp = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHour = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
  const offsetMinute = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second} UTC${offsetSign}${offsetHour}:${offsetMinute}`;
};

const decodeHtmlEntities = (value: string): string => {
  if (!value || !value.includes("&")) {
    return value;
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizeExportText = (value: string): string => {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\t/g, " ")
    .trim();
};

const formatExportFileTimestamp = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hour}-${minute}`;
};

const getSystemEventCategory = (message: WorkspaceChatMessage): string => {
  const normalizedContent = normalizeForRiskScan(message.content || "");

  if (
    message.taskId ||
    /\btask\b|\bsubtask\b|\/task\b/.test(normalizedContent)
  ) {
    return "Task";
  }

  if (/\bsubmission\b|\breview\b|\bapprove\b|\breject\b/.test(normalizedContent)) {
    return "Submission";
  }

  if (/\bmilestone\b/.test(normalizedContent)) {
    return "Milestone";
  }

  if (/\bfund\b|\bescrow\b|\bpayout\b|\bpayment\b/.test(normalizedContent)) {
    return "Funding";
  }

  if (/\bworkspace\b|\bchat\b|\bjoined\b|\bleft\b|\bvideo\b/.test(normalizedContent)) {
    return "Workspace";
  }

  return "General";
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

type WorkspaceChatMessageRowProps = {
  message: WorkspaceChatMessage;
  currentUserId: string | null;
  projectMembers: WorkspaceChatMentionMember[];
  normalizedSearchQuery: string;
  editingValue?: string;
  isEditing: boolean;
  isBusy: boolean;
  isHighlighted: boolean;
  onEditingValueChange: (value: string) => void;
  onReply: (messageId: string) => void;
  onStartEdit: (message: WorkspaceChatMessage) => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string) => Promise<void> | void;
  onDeleteMessage: (messageId: string) => Promise<void> | void;
  onTogglePin: (message: WorkspaceChatMessage) => Promise<void> | void;
  onScrollToMessage: (messageId: string) => void;
  onJoinVideoCall: (url: string) => void;
  registerMessageRef: (messageId: string, node: HTMLDivElement | null) => void;
};

const WorkspaceChatMessageRow = memo(function WorkspaceChatMessageRow({
  message,
  currentUserId,
  projectMembers,
  normalizedSearchQuery,
  editingValue,
  isEditing,
  isBusy,
  isHighlighted,
  onEditingValueChange,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteMessage,
  onTogglePin,
  onScrollToMessage,
  onJoinVideoCall,
  registerMessageRef,
}: WorkspaceChatMessageRowProps) {
  const systemMessage = isSystemMessage(message);
  const riskFlags = getMessageRiskFlags(message);
  const isRiskFlagged = !message.isDeleted && riskFlags.length > 0;
  const isMe = Boolean(currentUserId) && message.senderId === currentUserId;
  const replyPreview = !message.isDeleted ? message.replyTo : null;
  const containsVideoCall = Boolean(extractWorkspaceVideoCall(message.content));

  if (systemMessage) {
    return (
      <div
        ref={(node) => {
          registerMessageRef(message.id, node);
        }}
        className="flex min-w-0 max-w-full justify-center py-1"
      >
        <div
          className={
            containsVideoCall
              ? "min-w-0 w-full max-w-[min(100%,22rem)]"
              : "min-w-0 max-w-[85%] text-center"
          }
        >
          <div
            className={
              containsVideoCall
                ? "min-w-0 max-w-full"
                : "min-w-0 max-w-full whitespace-pre-wrap break-words text-xs font-normal text-gray-400 [overflow-wrap:anywhere]"
            }
          >
            {renderMessageContent(
              message.content,
              projectMembers,
              false,
              normalizedSearchQuery,
              { onJoinCall: onJoinVideoCall },
            )}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
            <span>{formatMessageTime(message.createdAt)}</span>
            {!message.isDeleted && (
              <button
                type="button"
                onClick={() => onReply(message.id)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:text-blue-600"
              >
                <Reply className="h-3 w-3" />
                <span>Reply</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const senderLabel = isMe
    ? "You"
    : message.sender?.fullName ||
      (message.senderId ? `User ${message.senderId.slice(0, 6)}` : "Unknown User");
  const bubbleClassName = message.isDeleted
    ? "rounded-2xl border border-rose-100 bg-white text-rose-700"
    : isMe
      ? isRiskFlagged
        ? "rounded-2xl rounded-tr-md border border-rose-100 bg-rose-50 text-rose-900"
        : "rounded-2xl rounded-tr-md border border-blue-100 bg-blue-50 text-blue-900"
      : isRiskFlagged
        ? "rounded-2xl rounded-tl-md border border-rose-100 bg-rose-50 text-rose-900"
        : "rounded-2xl rounded-tl-md border border-gray-100 bg-white text-gray-900";
  const editingShellClassName = isMe
    ? "rounded-2xl rounded-tr-md border border-blue-100 bg-blue-50 text-blue-900"
    : "rounded-2xl rounded-tl-md border border-gray-100 bg-white text-gray-900";
  const warningClassName = isMe ? "justify-end text-right text-rose-700" : "text-rose-700";
  const actionTriggerClassName = message.isDeleted
    ? "text-rose-400 hover:text-rose-600"
    : "text-gray-400 hover:text-blue-600";

  return (
    <div
      ref={(node) => {
        registerMessageRef(message.id, node);
      }}
      className={`group relative flex min-w-0 max-w-full ${
        isMe ? "justify-end" : "justify-start"
      } ${isHighlighted ? "rounded-2xl ring-2 ring-amber-300/80 ring-offset-2 ring-offset-slate-50" : ""}`}
    >
      <div
        className={`flex min-w-0 max-w-[85%] flex-col ${isMe ? "items-end" : "items-start"}`}
      >
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
              ? "min-w-0 max-w-full text-sm leading-relaxed"
              : `relative min-w-0 max-w-full rounded-2xl px-5 py-3 pr-12 text-sm leading-relaxed ${bubbleClassName}`
          }
        >
          {isEditing ? (
            <div
              className={`min-w-0 max-w-full space-y-3 rounded-2xl px-4 py-4 ${editingShellClassName}`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  isMe ? "text-blue-100/90" : "text-slate-500"
                }`}
              >
                Editing message
              </p>
              <textarea
                value={editingValue ?? ""}
                onChange={(event) => onEditingValueChange(event.target.value)}
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
                  onClick={onCancelEdit}
                  disabled={isBusy}
                  className={isMe ? "bg-white/15 text-white hover:bg-white/20" : undefined}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void onSaveEdit(message.id);
                  }}
                  disabled={isBusy || !editingValue?.trim()}
                  className={isMe ? "bg-white text-blue-700 hover:bg-blue-50" : undefined}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>{isBusy ? "Saving..." : "Save"}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={`absolute -top-3 right-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-0.5 rounded-md border border-gray-200 bg-white p-0.5 shadow-sm transition-opacity duration-150 ${
                  message.isDeleted
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                }`}
              >
                {!message.isDeleted && (
                  <button
                    type="button"
                    onClick={() => onReply(message.id)}
                    disabled={isBusy}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Reply to message"
                  >
                    <Reply className="h-4 w-4" />
                  </button>
                )}
                {isMe && !message.isDeleted && (
                  <button
                    type="button"
                    onClick={() => onStartEdit(message)}
                    disabled={isBusy}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Edit message"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {isMe && (
                  <button
                    type="button"
                    onClick={() => {
                      void onDeleteMessage(message.id);
                    }}
                    disabled={isBusy || message.isDeleted}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="More message actions"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${actionTriggerClassName}`}
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
                        void onTogglePin(message);
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {message.isDeleted ? (
                <p className="text-gray-500">{DELETED_MESSAGE_PLACEHOLDER}</p>
              ) : (
                <>
                  {replyPreview && (
                    <button
                      type="button"
                      onClick={() => onScrollToMessage(replyPreview.id)}
                      className={`min-w-0 max-w-full w-full rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                        isMe
                          ? "border-blue-100 bg-white/70 text-blue-900 hover:bg-white"
                          : "border-gray-100 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <p className="font-semibold">
                        {replyPreview.sender?.fullName || "Unknown User"}
                      </p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words opacity-90">
                        {getReplyPreviewText(replyPreview)}
                      </p>
                    </button>
                  )}
                  {message.content ? (
                    <div
                      className={
                        containsVideoCall
                          ? "min-w-0 max-w-full"
                          : "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                      }
                    >
                      {renderMessageContent(
                        message.content,
                        projectMembers,
                        isMe,
                        normalizedSearchQuery,
                        { onJoinCall: onJoinVideoCall },
                      )}
                    </div>
                  ) : null}
                </>
              )}

              {!message.isDeleted && message.attachments.length > 0 && (
                <div className="grid min-w-0 max-w-full gap-2">
                  {message.attachments.map((attachment) =>
                    isImageAttachment(attachment) ? (
                      <a
                        key={`${message.id}-${attachment.url}`}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-full overflow-hidden rounded-xl border border-gray-100 bg-white"
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
                        className={`flex min-w-0 max-w-full items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                          isMe
                            ? "border-blue-100 bg-white/70 text-blue-900 hover:bg-white"
                            : "border-gray-100 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
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
});

export function WorkspaceChatDrawer({
  isOpen = true,
  onClose,
  projectId,
  currentUserId,
  projectMembers = [],
  workspaceTasks = [],
  availableMilestoneIds = [],
  canReviewTasks = false,
  canBrokerReviewTasks,
  canClientReviewTasks,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceChatMessage[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null);
  const [isCallWindowMinimized, setIsCallWindowMinimized] = useState(false);
  const [isCallWindowExpanded, setIsCallWindowExpanded] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const joinedProjectIdRef = useRef<string | null>(null);
  const joinInFlightRef = useRef<Promise<void> | null>(null);
  const lastSendAttemptAtRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const activeSearchQueryRef = useRef("");

  const resolvedCurrentUserId = currentUserId ?? getStoredCurrentUserId() ?? null;
  const resolvedCurrentUserRole = getStoredCurrentUserRole();
  const canActAsBrokerReviewer =
    canBrokerReviewTasks ?? resolvedCurrentUserRole === "BROKER";
  const canActAsClientReviewer =
    canClientReviewTasks ?? resolvedCurrentUserRole === "CLIENT";
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
  const workspaceTaskLookup = useMemo(() => {
    const byId = new Map<string, Task>();
    for (const task of workspaceTasks) {
      byId.set(task.id, task);
    }
    return byId;
  }, [workspaceTasks]);
  const allKnownMessages = useMemo(() => {
    const byId = new Map<string, WorkspaceChatMessage>();
    for (const message of messages) {
      byId.set(message.id, message);
    }
    for (const message of searchResults) {
      byId.set(message.id, message);
    }
    return byId;
  }, [messages, searchResults]);
  const replyingToMessage = useMemo(
    () =>
      replyingToMessageId
        ? allKnownMessages.get(replyingToMessageId) ?? null
        : null,
    [allKnownMessages, replyingToMessageId],
  );
  const normalizedSearchQuery = debouncedSearchQuery.trim();
  const isSearchActive = normalizedSearchQuery.length > 0;
  const visibleMessages = isSearchActive ? searchResults : messages;
  useEffect(() => {
    activeSearchQueryRef.current = normalizedSearchQuery;
  }, [normalizedSearchQuery]);
  const latestPinnedMessage = useMemo(() => {
    let latestMessage: WorkspaceChatMessage | null = null;

    for (const message of messages) {
      if (!message.isPinned || isSystemMessage(message) || message.isDeleted) {
        continue;
      }

      if (
        !latestMessage ||
        new Date(message.updatedAt).getTime() > new Date(latestMessage.updatedAt).getTime()
      ) {
        latestMessage = message;
      }
    }

    return latestMessage;
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

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

    return availableMilestoneIds[0] ?? null;
  }, [availableMilestoneIds, defaultMilestoneId]);

  const resolveTaskForApproval = useCallback(
    async (taskIdentifier: string): Promise<Task | null> => {
      if (!projectId || workspaceTaskLookup.size === 0) {
        return null;
      }

      const normalizedIdentifier = taskIdentifier.trim().toLowerCase();
      const availableTasks = Array.from(workspaceTaskLookup.values());

      const exactIdMatch = availableTasks.find(
        (task) => task.id.toLowerCase() === normalizedIdentifier,
      );
      if (exactIdMatch) {
        return exactIdMatch;
      }

      const exactTitleMatches = availableTasks.filter(
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

      const partialTitleMatches = availableTasks.filter((task) =>
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
    [projectId, workspaceTaskLookup],
  );

  const resolveLatestActionableSubmission = useCallback(
    (submissions: TaskSubmission[]): TaskSubmission | null => {
      const openSubmissions = submissions.filter(
        (submission) =>
          submission.status === "PENDING" ||
          submission.status === "PENDING_CLIENT_REVIEW",
      );

      if (openSubmissions.length === 0) {
        return null;
      }

      openSubmissions.sort((first, second) => {
        if (first.version !== second.version) {
          return second.version - first.version;
        }

        return (
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
        );
      });

      const preferredStatus = canActAsBrokerReviewer && !canActAsClientReviewer
        ? "PENDING"
        : canActAsClientReviewer && !canActAsBrokerReviewer
          ? "PENDING_CLIENT_REVIEW"
          : null;

      if (preferredStatus) {
        return (
          openSubmissions.find(
            (submission) => submission.status === preferredStatus,
          ) ?? null
        );
      }

      return openSubmissions[0];
    },
    [canActAsBrokerReviewer, canActAsClientReviewer],
  );

  const upsertMutatedMessage = useCallback((message: WorkspaceChatMessage) => {
    setMessages((currentMessages) => upsertSortedMessage(currentMessages, message));
    setSearchResults((currentMessages) =>
      upsertSearchResultsWithMessage(
        currentMessages,
        message,
        activeSearchQueryRef.current,
      ),
    );
  }, []);

  const clearReplyTarget = useCallback(() => {
    setReplyingToMessageId(null);
  }, []);

  const handleJoinVideoCall = useCallback((url: string) => {
    const normalizedUrl = normalizeJitsiUrl(url);
    if (!normalizedUrl) {
      return;
    }

    setIsCallWindowMinimized(false);
    setIsCallWindowExpanded(false);
    setActiveCallUrl(normalizedUrl);
  }, []);

  const handleLeaveVideoCall = useCallback(() => {
    setActiveCallUrl(null);
    setIsCallWindowMinimized(false);
    setIsCallWindowExpanded(false);
  }, []);

  const handleReplyToMessage = useCallback((messageId: string) => {
    setReplyingToMessageId(messageId);
    inputRef.current?.focus();
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

  const registerMessageRef = useCallback(
    (messageId: string, node: HTMLDivElement | null) => {
      messageRefs.current[messageId] = node;
    },
    [],
  );

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
            const uploaded = await uploadImageToServer(file);
            return {
              url: uploaded.url,
              name: uploaded.fileName || file.name || "attachment",
              type: uploaded.fileType || file.type || "application/octet-stream",
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
        const response = await toggleWorkspaceChatPin(projectId, message.id, !message.isPinned);
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

  const handleEditingValueChange = useCallback((value: string) => {
    setEditingValue(value);
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
        const response = await editWorkspaceChatMessage(projectId, messageId, trimmedContent);
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
        const response = await deleteWorkspaceChatMessage(projectId, messageId);
        const normalized = normalizeWorkspaceMessage(response.data);
        if (normalized) {
          upsertMutatedMessage(normalized);
        }
        if (editingMessageId === messageId) {
          handleCancelEdit();
        }
        if (replyingToMessageId === messageId) {
          clearReplyTarget();
        }
      } catch (error) {
        const messageText = getApiErrorDetails(error, "Failed to delete message").message;
        console.error("Failed to delete workspace message", error);
        toast.error(messageText);
      } finally {
        setActiveMessageActionId(null);
      }
    },
    [
      clearReplyTarget,
      editingMessageId,
      handleCancelEdit,
      projectId,
      replyingToMessageId,
      upsertMutatedMessage,
    ],
  );

  const ensureProjectRoomJoin = useCallback(
    (socket: Socket, targetProjectId: string, timeoutMs = 6000): Promise<void> => {
      if (joinedProjectIdRef.current === targetProjectId) {
        return Promise.resolve();
      }

      if (!socket.connected) {
        return Promise.reject(new Error("Socket is not connected"));
      }

      if (
        joinedProjectIdRef.current &&
        joinedProjectIdRef.current !== targetProjectId
      ) {
        socket.emit("leaveProjectChat", {
          projectId: joinedProjectIdRef.current,
        });
        joinedProjectIdRef.current = null;
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

  const sendMessagePayload = useCallback(
    async ({
      content,
      attachments = [],
      replyToId = null,
      successToast,
    }: {
      content: string;
      attachments?: WorkspaceChatAttachment[];
      replyToId?: string | null;
      successToast?: string | null;
    }) => {
      if (!projectId) {
        throw new Error("Missing project context");
      }

      const socket = connectNamespacedSocket(WORKSPACE_CHAT_NAMESPACE);

      await waitForSocketConnection(socket, 10000);
      await ensureProjectRoomJoin(socket, projectId);
      lastSendAttemptAtRef.current = Date.now();

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error("Send message timeout"));
        }, 6000);

        socket.emit(
          "sendProjectMessage",
          {
            projectId,
            content,
            attachments,
            replyToId: replyToId ?? undefined,
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

      if (successToast) {
        toast.success(successToast);
      }
    },
    [ensureProjectRoomJoin, projectId],
  );

  const sendQuickVideoCall = useCallback(async () => {
    if (!projectId || isSending || isUploadingAttachments) {
      return;
    }

    const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const roomId = `Workspace_${safeProjectId}_${randomSuffix}`;
    const meetingUrl = `https://meet.jit.si/${roomId}`;
    const messageContent = `${VIDEO_CALL_MESSAGE_PREFIX} ${meetingUrl}`;

    setIsSending(true);
    try {
      await sendMessagePayload({
        content: messageContent,
        replyToId: replyingToMessageId,
        successToast: "Video call link sent.",
      });
      clearReplyTarget();
      closeMentionPopover();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start video call";
      console.error("Failed to send workspace video call link", error);
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [
    clearReplyTarget,
    closeMentionPopover,
    isSending,
    isUploadingAttachments,
    projectId,
    replyingToMessageId,
    sendMessagePayload,
  ]);

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

        if (!createdTask?.id) {
          throw new Error(
            "Task command did not return a persisted task. Please try again or use Create Task.",
          );
        }

        onTaskCreated?.(createdTask);
        setInputValue("");
        clearReplyTarget();
        closeMentionPopover();
        toast.success(`Task created: ${createdTask.title}`);
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
        toast.error("You do not have permission to approve tasks in this project.");
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
        const pendingSubmission = resolveLatestActionableSubmission(submissions);
        if (!pendingSubmission) {
          toast.error("This task does not have a submission waiting for your review yet.");
          return;
        }

        const reviewResult = await reviewSubmission(targetTask.id, pendingSubmission.id, {
          status: "APPROVED",
        });
        const approvedTask = reviewResult.task;

        onTaskCreated?.(approvedTask);
        setInputValue("");
        clearReplyTarget();
        closeMentionPopover();
        toast.success(
          pendingSubmission.status === "PENDING"
            ? "Broker review completed and sent to client."
            : "Client approval completed. Task marked DONE.",
        );
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

    setIsSending(true);

    try {
      await sendMessagePayload({
        content: trimmedInput,
        attachments: pendingAttachments,
        replyToId: replyingToMessageId,
      });
      setInputValue("");
      setPendingAttachments([]);
      clearReplyTarget();
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
      clearReplyTarget,
      closeMentionPopover,
      getTaskCommandErrorMessage,
      inputValue,
      isSending,
      isUploadingAttachments,
      onTaskCreated,
      pendingAttachments,
      projectId,
      replyingToMessageId,
      resolvedTaskCommandUnavailableMessage,
      resolveLatestActionableSubmission,
      resolveTaskForApproval,
      resolveTaskMilestoneId,
      sendMessagePayload,
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
      if (isMentionOpen && mentionContext) {
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
      isMentionOpen,
      mentionContext,
    ],
  );

  const handleExportChat = useCallback(async () => {
    if (!projectId) {
      toast.error("Missing project context. Unable to export chat.");
      return;
    }

    if (visibleMessages.length === 0) {
      toast.error("There are no chat records to export yet.");
      return;
    }

    try {
      const exportedAt = new Date();
      const exporterRole = resolvedCurrentUserRole || "UNKNOWN";
      const exporterMember = resolvedCurrentUserId
        ? projectMembers.find((member) => member.id === resolvedCurrentUserId)
        : undefined;
      const exportedBy = exporterMember
        ? `${exporterMember.fullName} (${exporterMember.role})`
        : resolvedCurrentUserId
          ? `${resolvedCurrentUserId} (${exporterRole})`
          : "Unknown user";

      const exportMessages = visibleMessages;
      const totalMessages = exportMessages.length;
      const systemMessages = exportMessages.filter((message) => isSystemMessage(message)).length;
      const userMessages = totalMessages - systemMessages;
      const userConversationMessages = exportMessages.filter((message) => !isSystemMessage(message));
      const systemEventMessages = exportMessages.filter((message) => isSystemMessage(message));
      const totalAttachments = exportMessages.reduce(
        (total, message) => total + message.attachments.length,
        0,
      );
      const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local timezone";
      const timezoneLabel = `${timezoneName} (${formatAuditTimestamp(exportedAt.toISOString()).split(" ").at(-1) || "UTC"})`;

      const timestampRange = exportMessages.reduce(
        (range, message) => {
          const timestamp = new Date(message.createdAt).getTime();
          if (Number.isNaN(timestamp)) {
            return range;
          }

          return {
            earliest: range.earliest == null ? timestamp : Math.min(range.earliest, timestamp),
            latest: range.latest == null ? timestamp : Math.max(range.latest, timestamp),
          };
        },
        { earliest: null as number | null, latest: null as number | null },
      );

      const participantsById = new Map<
        string,
        { id: string; fullName: string; role: string | null }
      >();
      for (const member of projectMembers) {
        participantsById.set(member.id, {
          id: member.id,
          fullName: member.fullName,
          role: member.role,
        });
      }
      for (const message of exportMessages) {
        if (!message.senderId) {
          continue;
        }
        if (participantsById.has(message.senderId)) {
          continue;
        }
        participantsById.set(message.senderId, {
          id: message.senderId,
          fullName:
            message.sender?.fullName?.trim() || `User ${message.senderId.slice(0, 8)}`,
          role: message.sender?.role || null,
        });
      }

      const participants = Array.from(participantsById.values());
      const participantCount = participants.length;
      const participantNames =
        participants.length === 0
          ? "N/A"
          : participants
              .map((participant) => participant.fullName)
              .sort((left, right) => left.localeCompare(right))
              .join(", ");

      const userRoleCountMap = participants.reduce<Record<string, number>>((counts, participant) => {
        const normalizedRole = String(participant.role || "OTHER").toUpperCase();
        counts[normalizedRole] = (counts[normalizedRole] ?? 0) + 1;
        return counts;
      }, {});
      const participantsByRoleSummary = Object.entries(userRoleCountMap)
        .sort(([leftRole], [rightRole]) => leftRole.localeCompare(rightRole))
        .map(([role, count]) => `${role}: ${count}`)
        .join(" | ");

      const styleHeaderRow = (sheet: ReturnType<Workbook["addWorksheet"]>, rowNumber: number, color: string) => {
      const row = sheet.getRow(rowNumber);
      row.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      row.height = 24;
    };

    const styleDataRow = (
      row: ReturnType<ReturnType<Workbook["addWorksheet"]>["addRow"]>,
      options?: {
        wrapColumns?: number[];
        centerColumns?: number[];
        rowFill?: Fill | null;
      },
    ) => {
      const wrapColumns = options?.wrapColumns ?? [];
      const centerColumns = options?.centerColumns ?? [];

      row.eachCell((cell, columnNumber) => {
        cell.font = { name: "Arial", size: 10, color: { argb: "FF111827" } };
        cell.alignment = {
          vertical: "top",
          horizontal: centerColumns.includes(columnNumber) ? "center" : "left",
          wrapText: wrapColumns.includes(columnNumber),
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
        if (options?.rowFill) {
          cell.fill = options.rowFill;
        }
      });
    };

    const workbook = new Workbook();
    workbook.creator = "InterDev Workspace Chat";
    workbook.created = exportedAt;
    workbook.modified = exportedAt;

    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { width: 30 },
      { width: 88 },
    ];

    summarySheet.addRow(["Workspace Chat Export Summary", ""]);
    summarySheet.mergeCells("A1:B1");
    const summaryTitleCell = summarySheet.getCell("A1");
    summaryTitleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    summaryTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    summaryTitleCell.alignment = { vertical: "middle", horizontal: "left" };
    summarySheet.getRow(1).height = 24;

    const summaryRows: Array<[string, string | number]> = [
      ["Project title", projectTitle || "Project Workspace Chat"],
      ["Project ID", projectId],
      ["Exported at", formatAuditTimestamp(exportedAt.toISOString())],
      ["Exported by", exportedBy],
      ["Timezone", timezoneLabel],
      [
        "Export scope",
        isSearchActive
          ? "Filtered/search export (current filtered messages)"
          : "Full loaded chat (current loaded messages)",
      ],
      [
        "Message range",
        timestampRange.earliest != null && timestampRange.latest != null
          ? `${formatAuditTimestamp(new Date(timestampRange.earliest).toISOString())} -> ${formatAuditTimestamp(
              new Date(timestampRange.latest).toISOString(),
            )}`
          : "N/A",
      ],
      ["Participant count", participantCount],
      ["Participant names", participantNames],
      ["Participants by role", participantsByRoleSummary || "N/A"],
      ["System event count", systemMessages],
      ["Total messages", totalMessages],
      ["User messages", userMessages],
      ["Total attachments", totalAttachments],
      [
        "Search/filter context",
        isSearchActive
          ? `Search query: "${normalizedSearchQuery}". Export source: current filtered messages.`
          : "No search filter. Export source: current loaded messages.",
      ],
    ];

    for (const [label, value] of summaryRows) {
      const row = summarySheet.addRow([label, value]);
      row.getCell(1).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F2937" } };
      row.getCell(2).font = { name: "Arial", size: 11, color: { argb: "FF111827" } };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFF3F8" },
      };
      row.getCell(1).alignment = { vertical: "top" };
      row.getCell(2).alignment = { vertical: "top", wrapText: true };
    }

    const summaryDividerRow = summarySheet.addRow(["", ""]);
    summaryDividerRow.height = 10;
    const legalTitleRow = summarySheet.addRow(["Export / Legal note", LEGAL_EXPORT_FOOTER]);
    legalTitleRow.getCell(1).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF7C2D12" } };
    legalTitleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF7ED" },
    };
    legalTitleRow.getCell(2).font = { name: "Arial", size: 10, color: { argb: "FF7C2D12" } };
    legalTitleRow.getCell(2).alignment = { vertical: "top", wrapText: true };

    const messagesSheet = workbook.addWorksheet("Messages", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    messagesSheet.columns = [
      { header: "Timestamp", key: "timestamp", width: 22 },
      { header: "Sender", key: "sender", width: 24 },
      { header: "Sender Role", key: "senderRole", width: 16 },
      { header: "Message Type", key: "messageType", width: 14 },
      { header: "Message Text", key: "messageText", width: 58 },
      { header: "Reply To Sender", key: "replyToSender", width: 22 },
      { header: "Reply To Snippet", key: "replyToSnippet", width: 34 },
      { header: "Attachment Count", key: "attachmentCount", width: 16 },
      { header: "Attachment Summary", key: "attachmentSummary", width: 34 },
      { header: "Flags", key: "flags", width: 20 },
      { header: "Risk Flags", key: "riskFlags", width: 26 },
      { header: "Task Title", key: "taskTitle", width: 28 },
    ];

    styleHeaderRow(messagesSheet, 1, "FF0F766E");
    messagesSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: messagesSheet.columnCount },
    };

    const systemFill: Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF6FF" },
    };
    const deletedFill: Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    const pinnedFill: Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFBEB" },
    };
    const riskFill: Fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF2F2" },
    };

    for (const message of userConversationMessages) {
      const isSystem = isSystemMessage(message);
      const senderLabel = isSystem
        ? "System"
        : message.sender?.fullName?.trim() ||
          (message.senderId ? `User ${message.senderId.slice(0, 8)}` : "Unknown User");
      const senderRole = message.sender?.role || (isSystem ? "SYSTEM" : "UNKNOWN");
      const visibleContent = normalizeExportText(
        decodeHtmlEntities(getVisibleMessageContent(message)),
      );
      const replyToSender = message.replyTo?.sender?.fullName || "";
      const replyToSnippet = message.replyTo
        ? normalizeExportText(getReplyPreviewText(message.replyTo))
        : "";
      const riskFlags = message.isDeleted ? [] : getMessageRiskFlags(message);
      const attachmentSummary =
        message.attachments.length === 0
          ? ""
          : message.attachments.length === 1
            ? message.attachments[0].name
            : `${message.attachments.length} files: ${message.attachments
                .map((attachment) => attachment.name)
                .join("; ")}`;
      const flags = [
        message.isEdited ? "EDITED" : null,
        message.isDeleted ? "DELETED" : null,
        message.isPinned ? "PINNED" : null,
      ]
        .filter((flag): flag is string => Boolean(flag))
        .join(" | ");
      const task = message.taskId ? workspaceTaskLookup.get(message.taskId) : undefined;

      const row = messagesSheet.addRow({
        timestamp: formatAuditTimestamp(message.createdAt),
        sender: senderLabel,
        senderRole,
        messageType: isSystem ? "System" : "User",
        messageText: visibleContent,
        replyToSender,
        replyToSnippet,
        attachmentCount: message.attachments.length,
        attachmentSummary,
        flags,
        riskFlags: riskFlags.join(", "),
        taskTitle: task?.title || "",
      });

      const rowFill = message.isDeleted
        ? deletedFill
        : riskFlags.length > 0
          ? riskFill
          : message.isPinned
            ? pinnedFill
            : isSystem
              ? systemFill
              : null;

      styleDataRow(row, {
        centerColumns: [8],
        wrapColumns: [5, 7, 9, 10, 11, 12],
        rowFill,
      });
    }

    if (systemEventMessages.length > 0) {
      const systemSheet = workbook.addWorksheet("System Events", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      systemSheet.columns = [
        { header: "Timestamp", key: "timestamp", width: 22 },
        { header: "Category", key: "category", width: 16 },
        { header: "Event Type", key: "messageType", width: 14 },
        { header: "Event Text", key: "messageText", width: 56 },
        { header: "Reply To Sender", key: "replyToSender", width: 22 },
        { header: "Reply To Snippet", key: "replyToSnippet", width: 34 },
        { header: "Attachment Summary", key: "attachmentSummary", width: 34 },
        { header: "Risk Flags", key: "riskFlags", width: 24 },
      ];

      styleHeaderRow(systemSheet, 1, "FF1D4ED8");
      systemSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: systemSheet.columnCount },
      };

      for (const message of systemEventMessages) {
        const riskFlags = message.isDeleted ? [] : getMessageRiskFlags(message);
        const row = systemSheet.addRow({
          timestamp: formatAuditTimestamp(message.createdAt),
          category: getSystemEventCategory(message),
          messageType: "System",
          messageText: normalizeExportText(decodeHtmlEntities(getVisibleMessageContent(message))),
          replyToSender: message.replyTo?.sender?.fullName || "",
          replyToSnippet: message.replyTo
            ? normalizeExportText(getReplyPreviewText(message.replyTo))
            : "",
          attachmentSummary:
            message.attachments.length === 0
              ? ""
              : message.attachments.map((attachment) => attachment.name).join("; "),
          riskFlags: riskFlags.join(", "),
        });

        styleDataRow(row, {
          wrapColumns: [4, 6, 7, 8],
          rowFill: systemFill,
        });
      }
    }

    const attachmentRows = exportMessages.flatMap((message) => {
      const isSystem = isSystemMessage(message);
      const senderLabel = isSystem
        ? "System"
        : message.sender?.fullName?.trim() ||
          (message.senderId ? `User ${message.senderId.slice(0, 8)}` : "Unknown User");
      const senderRole = message.sender?.role || (isSystem ? "SYSTEM" : "UNKNOWN");

      return message.attachments.map((attachment) => ({
        timestamp: formatAuditTimestamp(message.createdAt),
        sender: senderLabel,
        senderRole,
        fileName: normalizeExportText(decodeHtmlEntities(attachment.name)),
        fileType: attachment.type,
        fileUrl: attachment.url,
        messageId: message.id,
        projectId: message.projectId,
      }));
    });

    if (attachmentRows.length > 0) {
      const attachmentsSheet = workbook.addWorksheet("Attachments", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      attachmentsSheet.columns = [
        { header: "Message Timestamp", key: "timestamp", width: 22 },
        { header: "Sender", key: "sender", width: 24 },
        { header: "Sender Role", key: "senderRole", width: 16 },
        { header: "File Name", key: "fileName", width: 36 },
        { header: "File Type", key: "fileType", width: 20 },
        { header: "File URL", key: "fileUrl", width: 56 },
        { header: "Message ID", key: "messageId", width: 18 },
        { header: "Project ID", key: "projectId", width: 18 },
      ];

      styleHeaderRow(attachmentsSheet, 1, "FF334155");
      attachmentsSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: attachmentsSheet.columnCount },
      };

      for (const rowData of attachmentRows) {
        const row = attachmentsSheet.addRow(rowData);
        styleDataRow(row, {
          wrapColumns: [4, 6],
        });
      }
    }

    const auditSheet = workbook.addWorksheet("Audit", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    auditSheet.columns = [
      { width: 24 },
      { width: 22 },
      { width: 20 },
      { width: 18 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 14 },
    ];

    auditSheet.addRow(["Audit Metadata", ""]);
    auditSheet.mergeCells("A1:J1");
    const auditTitleCell = auditSheet.getCell("A1");
    auditTitleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    auditTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
    auditTitleCell.alignment = { vertical: "middle", horizontal: "left" };
    auditSheet.getRow(1).height = 24;

    const auditMetaRows: Array<[string, string | number]> = [
      ["Project ID", projectId],
      ["Generated at", formatAuditTimestamp(exportedAt.toISOString())],
      ["Exported by", exportedBy],
      ["Message count", totalMessages],
      ["Attachment count", totalAttachments],
      [
        "Search/filter context",
        isSearchActive ? `Search query: "${normalizedSearchQuery}"` : "No search query",
      ],
      ["Legal / export note", LEGAL_EXPORT_FOOTER],
    ];

    for (const [label, value] of auditMetaRows) {
      const row = auditSheet.addRow([label, value]);
      row.getCell(1).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F2937" } };
      row.getCell(2).font = { name: "Arial", size: 10, color: { argb: "FF111827" } };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
      row.getCell(2).alignment = { vertical: "top", wrapText: true };
      auditSheet.mergeCells(`B${row.number}:J${row.number}`);
      for (let column = 1; column <= 10; column += 1) {
        row.getCell(column).border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      }
    }

    const auditTableStartRow = auditSheet.rowCount + 3;
    auditSheet.getCell(`A${auditTableStartRow}`).value = "Technical Message Mapping";
    auditSheet.getCell(`A${auditTableStartRow}`).font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FF111827" },
    };

    const auditTableHeaderRowNumber = auditTableStartRow + 1;
    const auditHeaders = [
      "Timestamp",
      "Message ID",
      "Project ID",
      "Sender ID",
      "Sender Role",
      "Task ID",
      "Milestone ID",
      "Reply To ID",
      "Message Type",
      "Attachment Count",
    ];
    const auditHeaderRow = auditSheet.getRow(auditTableHeaderRowNumber);
    auditHeaders.forEach((header, index) => {
      auditHeaderRow.getCell(index + 1).value = header;
    });
    styleHeaderRow(auditSheet, auditTableHeaderRowNumber, "FF374151");
    auditSheet.autoFilter = {
      from: { row: auditTableHeaderRowNumber, column: 1 },
      to: { row: auditTableHeaderRowNumber, column: auditHeaders.length },
    };

    for (const message of exportMessages) {
      const relatedTask = message.taskId ? workspaceTaskLookup.get(message.taskId) : undefined;
      const row = auditSheet.addRow([
        formatAuditTimestamp(message.createdAt),
        message.id,
        message.projectId,
        message.senderId || "",
        message.sender?.role || (isSystemMessage(message) ? "SYSTEM" : ""),
        message.taskId || "",
        relatedTask?.milestoneId || "",
        message.replyToId || "",
        message.messageType,
        message.attachments.length,
      ]);

      styleDataRow(row, {
        centerColumns: [10],
      });
    }

    const safeProjectLabel = (projectTitle || projectId)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project";
    const fileName = `WorkspaceChat_${safeProjectLabel}_${formatExportFileTimestamp(
      exportedAt,
    )}_record.xlsx`;

      const workbookBuffer = await workbook.xlsx.writeBuffer();
      const successMessage = await emailWorkspaceChatExportFile(
        {
          projectId,
          fileName,
          workbookBuffer,
        },
        {
          sendExport: emailWorkspaceChatExport,
        },
      );

      toast.success(successMessage || WORKSPACE_CHAT_EXPORT_EMAIL_SUCCESS_MESSAGE);
    } catch (error) {
      toast.error(getApiErrorDetails(error).message || "Failed to email the chat log export.");
    }
  }, [
    emailWorkspaceChatExport,
    isSearchActive,
    normalizedSearchQuery,
    projectId,
    projectMembers,
    projectTitle,
    resolvedCurrentUserId,
    resolvedCurrentUserRole,
    visibleMessages,
    workspaceTaskLookup,
  ]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !isOpen ||
      !projectId ||
      normalizedSearchQuery.length > 0 ||
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
      const response = await fetchWorkspaceChatMessages(projectId, {
        limit: HISTORY_PAGE_SIZE,
        offset,
      });

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
  }, [hasMore, isHistoryLoading, isOpen, normalizedSearchQuery.length, offset, projectId]);

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
        const response = await fetchWorkspaceChatMessages(projectId, {
          limit: HISTORY_PAGE_SIZE,
          offset: 0,
        });

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
    if (!isOpen || !projectId || normalizedSearchQuery.length === 0) {
      setSearchResults([]);
      setIsSearchLoading(false);
      return;
    }

    let cancelled = false;
    setIsSearchLoading(true);

    const loadSearchResults = async () => {
      try {
        const response = await fetchWorkspaceChatMessages(projectId, {
          limit: 50,
          offset: 0,
          query: normalizedSearchQuery,
        });

        if (cancelled) {
          return;
        }

        const normalized = (response.data || [])
          .map((message) => normalizeWorkspaceMessage(message))
          .filter((message): message is WorkspaceChatMessage => Boolean(message));

        setSearchResults(sortMessagesAsc(normalized));
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to search workspace chat messages", error);
        toast.error("Failed to search messages");
      } finally {
        if (!cancelled) {
          setIsSearchLoading(false);
        }
      }
    };

    void loadSearchResults();

    return () => {
      cancelled = true;
    };
  }, [isOpen, normalizedSearchQuery, projectId]);

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
      const normalizedMessage = normalizeWorkspaceMessage(incoming);
      if (!normalizedMessage || normalizedMessage.projectId !== projectId) {
        return;
      }

      const shouldAutoScroll = isNearBottom();
      upsertMutatedMessage(normalizedMessage);

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
  }, [
    ensureProjectRoomJoin,
    isNearBottom,
    isOpen,
    projectId,
    scrollToBottom,
    upsertMutatedMessage,
  ]);

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
      setReplyingToMessageId(null);
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setSearchResults([]);
      closeMentionPopover();
    }
  }, [closeMentionPopover, isOpen]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditingValue("");
    setPendingAttachments([]);
    setActiveCallUrl(null);
    setIsCallWindowMinimized(false);
    setIsCallWindowExpanded(false);
    setHighlightedMessageId(null);
    setReplyingToMessageId(null);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSearchResults([]);
    closeMentionPopover();
  }, [closeMentionPopover, projectId]);

  const activeCallRoomName = activeCallUrl ? getJitsiRoomNameFromUrl(activeCallUrl) : "";
  const activeCallDisplayLabel = activeCallRoomName || activeCallUrl || "Jitsi call";
  const activeCallWindowClassName = isCallWindowMinimized
    ? "w-[min(88vw,304px)]"
    : isCallWindowExpanded
      ? "h-[min(88vh,760px)] w-[min(92vw,960px)]"
      : "h-[min(78vh,560px)] w-[min(92vw,420px)]";
  const activeCallWindowPositionClassName = isOpen ? "mb-24 sm:mb-0 sm:mr-96" : "";
  const renderedMessages = useMemo(
    () =>
      visibleMessages.map((message) => (
        <WorkspaceChatMessageRow
          key={message.id}
          message={message}
          currentUserId={resolvedCurrentUserId}
          projectMembers={projectMembers}
          normalizedSearchQuery={normalizedSearchQuery}
          editingValue={editingMessageId === message.id ? editingValue : undefined}
          isEditing={editingMessageId === message.id}
          isBusy={activeMessageActionId === message.id}
          isHighlighted={highlightedMessageId === message.id}
          onEditingValueChange={handleEditingValueChange}
          onReply={handleReplyToMessage}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onDeleteMessage={handleDeleteMessage}
          onTogglePin={handleTogglePin}
          onScrollToMessage={scrollToMessage}
          onJoinVideoCall={handleJoinVideoCall}
          registerMessageRef={registerMessageRef}
        />
      )),
    [
      activeMessageActionId,
      editingMessageId,
      editingValue,
      handleCancelEdit,
      handleDeleteMessage,
      handleEditingValueChange,
      handleJoinVideoCall,
      handleReplyToMessage,
      handleSaveEdit,
      handleStartEdit,
      handleTogglePin,
      highlightedMessageId,
      normalizedSearchQuery,
      projectMembers,
      registerMessageRef,
      resolvedCurrentUserId,
      scrollToMessage,
      visibleMessages,
    ],
  );

  return (
    <>
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
          className="z-40 h-screen w-96 max-w-[100vw] gap-0 border-l border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[24rem]"
        >
        <header className="border-b border-slate-200 px-3 py-3 pr-12">
          <div className="mb-2">
            <SheetTitle className="text-sm font-semibold text-slate-900">
              {projectTitle}
            </SheetTitle>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Online</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search messages"
                  className="h-8 w-full rounded-lg border border-transparent bg-white pl-8 pr-8 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500"
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setDebouncedSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                    aria-label="Clear chat search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleExportChat}
                disabled={!projectId || messages.length === 0}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Export record"
                title="Export record"
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export record</span>
              </button>
            </div>

            {latestPinnedMessage && (
              <button
                type="button"
                onClick={() => scrollToMessage(latestPinnedMessage.id)}
                className="flex w-full items-center gap-2 rounded-md border border-orange-100 bg-orange-50 px-2 py-1 text-left text-xs text-orange-700 transition-colors hover:bg-orange-100/70"
              >
                <Pin className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1 flex-1">
                  {(latestPinnedMessage.sender?.fullName || "Unknown User")}:{" "}
                  {getVisibleMessageContent(latestPinnedMessage) ||
                    latestPinnedMessage.attachments[0]?.name ||
                    "Attachment"}
                </span>
              </button>
            )}
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="min-w-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto bg-white px-5 py-5"
        >
          {isLoadingMore && !isSearchActive && (
            <p className="text-center text-xs text-slate-400">Loading older messages...</p>
          )}
          {!projectId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Missing project context. Unable to load chat.
            </div>
          ) : isHistoryLoading && !isSearchActive ? (
            <p className="text-sm text-slate-500">Loading messages...</p>
          ) : isSearchLoading ? (
            <p className="text-sm text-slate-500">Searching messages...</p>
          ) : visibleMessages.length === 0 ? (
            <p className="text-sm text-slate-500">
              {isSearchActive
                ? "No messages matched your search."
                : "No messages yet. Start the conversation."}
            </p>
          ) : (
            renderedMessages
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
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-slate-600"
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

            {replyingToMessage && (
              <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Replying to {replyingToMessage.sender?.fullName || "Unknown User"}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-slate-700">
                    {getReplyPreviewText(replyingToMessage)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearReplyTarget}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Cancel reply"
                >
                  <X className="h-4 w-4" />
                </button>
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
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                className="w-[22rem] border border-gray-200 bg-white p-0 text-slate-900 shadow-lg"
              >
                <Command className="rounded-xl bg-white text-slate-900">
                  <CommandList className="max-h-64">
                    <CommandEmpty className="py-4 text-sm text-slate-500">
                      No matching member.
                    </CommandEmpty>
                    <CommandGroup
                      heading="Mention project member"
                      className="text-slate-900 [&_[cmdk-group-heading]]:text-slate-500"
                    >
                      {filteredMentionMembers.map((member, index) => (
                        <CommandItem
                          key={member.id}
                          value={`${member.fullName}-${member.id}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onSelect={() => handleSelectMention(member)}
                          className={
                            index === activeMentionIndex
                              ? "border border-blue-100 bg-blue-50 text-slate-900"
                              : "text-slate-800 data-[selected=true]:border data-[selected=true]:border-blue-100 data-[selected=true]:bg-blue-50 data-[selected=true]:text-slate-900"
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

            <form
              onSubmit={handleComposerSubmit}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 transition-all focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500"
            >
              <button
                type="button"
                onClick={handleAttachmentPickerClick}
                disabled={!projectId || isSending || isUploadingAttachments}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300"
                aria-label="Attach files"
              >
                {isUploadingAttachments ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Paperclip className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  void sendQuickVideoCall();
                }}
                disabled={!projectId || isSending || isUploadingAttachments}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300"
                aria-label="Start video call"
              >
                {isSending && !inputValue.trim() && pendingAttachments.length === 0 ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Video className="h-5 w-5" />
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
                className="h-9 flex-1 rounded-md border-0 bg-transparent px-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-gray-50"
                placeholder="Type message, use @mention, attach files, or '/' for commands"
              />
              <button
                type="submit"
                disabled={!canSendCurrentMessage}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send message"
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                <span className="sr-only">Send</span>
              </button>
            </form>
          </div>
        </footer>
        </SheetContent>
      </Sheet>

      {activeCallUrl ? (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-end justify-end p-4">
          <div
            className={`pointer-events-auto ml-auto mt-auto flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all ${activeCallWindowClassName} ${activeCallWindowPositionClassName}`}
          >
            {isCallWindowMinimized ? (
              <>
                <div className="flex shrink-0 items-center gap-3 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">Workspace Video Call</p>
                    <p
                      className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-600"
                      title={activeCallDisplayLabel}
                    >
                      Room: {activeCallDisplayLabel}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-slate-500 hover:text-slate-900"
                    onClick={() => {
                      setIsCallWindowMinimized(false);
                    }}
                    aria-label="Restore call window"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-200 bg-slate-50 px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-2 text-xs"
                    onClick={() => {
                      setIsCallWindowMinimized(false);
                    }}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-2 text-xs"
                    asChild
                  >
                    <a href={activeCallUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span>Open</span>
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 px-2 text-xs"
                    onClick={handleLeaveVideoCall}
                  >
                    Leave
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">Workspace Video Call</p>
                    <p
                      className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-600"
                      title={activeCallDisplayLabel}
                    >
                      Room: {activeCallDisplayLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-slate-500 hover:text-slate-900"
                      onClick={() => {
                        setIsCallWindowExpanded((current) => !current);
                      }}
                      aria-label={isCallWindowExpanded ? "Restore call window" : "Expand call window"}
                    >
                      {isCallWindowExpanded ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-slate-500 hover:text-slate-900"
                      onClick={() => {
                        setIsCallWindowMinimized(true);
                        setIsCallWindowExpanded(false);
                      }}
                      aria-label="Minimize call window"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 bg-slate-950/5 p-2.5">
                  <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <iframe
                      title={`Workspace Jitsi Call ${activeCallRoomName || ""}`.trim()}
                      src={activeCallUrl}
                      className="h-full w-full bg-white"
                      allow="camera; microphone; fullscreen; display-capture"
                      allowFullScreen
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <Button variant="outline" size="sm" asChild>
                    <a href={activeCallUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span>Open in new tab</span>
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLeaveVideoCall}
                  >
                    Leave Call
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
