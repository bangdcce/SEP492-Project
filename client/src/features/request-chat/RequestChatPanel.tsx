import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Paperclip, Send, X } from "lucide-react";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";
import { connectNamespacedSocket } from "@/shared/realtime/socket";
import { getStoredJson } from "@/shared/utils/storage";
import {
  fetchRequestChatMessages,
  sendRequestChatMessage,
  uploadRequestChatAttachments,
} from "./api";
import type { RequestChatAttachment, RequestChatMessage } from "./types";

interface RequestChatPanelProps {
  requestId: string;
  className?: string;
  readOnly?: boolean;
}

const normalizeMessage = (
  value: Partial<RequestChatMessage> | null | undefined,
): RequestChatMessage | null => {
  if (!value?.id || !value.requestId || !value.createdAt) {
    return null;
  }

  return {
    id: value.id,
    requestId: value.requestId,
    senderId: value.senderId ?? null,
    replyToId: value.replyToId ?? null,
    messageType: value.messageType === "SYSTEM" ? "SYSTEM" : "USER",
    content: value.content || "",
    attachments: Array.isArray(value.attachments) ? value.attachments : [],
    isEdited: Boolean(value.isEdited),
    editHistory: Array.isArray(value.editHistory) ? value.editHistory : [],
    isDeleted: Boolean(value.isDeleted),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt || value.createdAt,
    sender: value.sender || null,
    replyTo: value.replyTo || null,
  };
};

const sortMessages = (messages: RequestChatMessage[]) =>
  [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

const mergeMessage = (
  current: RequestChatMessage[],
  incoming: RequestChatMessage,
) => sortMessages([incoming, ...current.filter((message) => message.id !== incoming.id)]);

const isImageAttachment = (attachment: RequestChatAttachment) =>
  String(attachment.type || "").toLowerCase().startsWith("image/");

const resolveAttachmentUrl = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_CONFIG.BASE_URL.replace(/\/+$/, "")}/${raw.replace(/^\/+/, "")}`;
};

export function RequestChatPanel({
  requestId,
  className,
  readOnly = false,
}: RequestChatPanelProps) {
  const [messages, setMessages] = useState<RequestChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<RequestChatAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const currentUser = useMemo(
    () => getStoredJson<{ id?: string; role?: string; fullName?: string }>(STORAGE_KEYS.USER),
    [],
  );

  useEffect(() => {
    let mounted = true;

    const loadMessages = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchRequestChatMessages(requestId, { limit: 100 });
        if (!mounted) return;
        setMessages(
          sortMessages(
            (response.data || [])
              .map((message) => normalizeMessage(message))
              .filter((message): message is RequestChatMessage => Boolean(message)),
          ),
        );
      } catch (error) {
        console.error("Failed to load request chat", error);
        if (mounted) {
          setError("Could not load this request thread.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadMessages();
    return () => {
      mounted = false;
    };
  }, [requestId]);

  useEffect(() => {
    const socket = connectNamespacedSocket("/ws/request-chat");
    const join = () => {
      socket.emit("joinRequestChat", { requestId });
    };

    const handleNewMessage = (incoming: Partial<RequestChatMessage>) => {
      const normalized = normalizeMessage(incoming);
      if (!normalized || normalized.requestId !== requestId) {
        return;
      }
      setMessages((current) => mergeMessage(current, normalized));
    };

    const handleRequestChatError = (payload: unknown) => {
      const message =
        typeof payload === "object" &&
        payload !== null &&
        typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "Request chat connection error";

      setError(message);
    };

    join();
    socket.on("connect", join);
    socket.on("newRequestMessage", handleNewMessage);
    socket.on("requestChatError", handleRequestChatError);

    return () => {
      socket.emit("leaveRequestChat", { requestId });
      socket.off("connect", join);
      socket.off("newRequestMessage", handleNewMessage);
      socket.off("requestChatError", handleRequestChatError);
    };
  }, [requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pendingAttachments.length]);

  const handleUploadFiles = async (files: FileList | null) => {
    if (readOnly) return;

    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;

    try {
      setUploading(true);
      setError(null);
      const response = await uploadRequestChatAttachments(requestId, nextFiles);
      setPendingAttachments((current) => [...current, ...(response.data || [])]);
    } catch (error) {
      console.error("Failed to upload request chat attachments", error);
      setError("Attachment upload failed. Please try again with a supported file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSend = async () => {
    if (readOnly) return;
    if ((!draft.trim() && pendingAttachments.length === 0) || sending) {
      return;
    }

    try {
      setSending(true);
      setError(null);
      const response = await sendRequestChatMessage(requestId, {
        content: draft.trim(),
        attachments: pendingAttachments,
      });
      const normalized = normalizeMessage(response.data);
      if (normalized) {
        setMessages((current) => mergeMessage(current, normalized));
      }
      setDraft("");
      setPendingAttachments([]);
    } catch (error) {
      console.error("Failed to send request chat message", error);
      setError("Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Request Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No discussion yet. Use this thread to clarify scope, budget assumptions, and spec revisions.
              </p>
            ) : (
              messages.map((message) => {
                const isOwnMessage =
                  message.senderId && currentUser?.id && message.senderId === currentUser.id;
                const isSystem = message.messageType === "SYSTEM";

                return (
                  <div
                    key={message.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      isSystem
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : isOwnMessage
                          ? "border-teal-200 bg-teal-50"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {isSystem ? "System" : message.sender?.fullName || message.sender?.role || "Participant"}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {message.content ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                        {message.content}
                      </p>
                    ) : null}
                    {message.attachments.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {message.attachments.map((attachment) => {
                          const attachmentUrl = resolveAttachmentUrl(attachment.url);

                          return (
                            <a
                              key={`${message.id}-${attachment.storagePath || attachment.url}`}
                              href={attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                            >
                              {isImageAttachment(attachment) ? (
                                <img
                                  src={attachmentUrl}
                                  alt={attachment.name}
                                  className="h-32 w-full object-cover"
                                  loading="lazy"
                                />
                              ) : null}
                              <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                <span className="truncate font-medium text-slate-900">
                                  {attachment.name}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {isImageAttachment(attachment) ? "Preview" : "Open"}
                                </span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {pendingAttachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.storagePath || attachment.url}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
              >
                <span className="max-w-[220px] truncate">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPendingAttachments((current) =>
                      current.filter(
                        (item) =>
                          (item.storagePath || item.url) !==
                          (attachment.storagePath || attachment.url),
                      ),
                    )
                  }
                  className="text-slate-500 transition-colors hover:text-slate-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {readOnly ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            You have read-only access to this request thread.
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Discuss unclear requirements, budget assumptions, milestone tradeoffs, or spec revisions..."
              className="min-h-[100px]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => void handleUploadFiles(event.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : "Attach Files"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, DOC, DOCX, XLSX, PPTX, PNG, JPG, WEBP, TXT, CSV.
                </p>
              </div>
              <Button type="button" onClick={() => void handleSend()} disabled={sending || uploading}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
