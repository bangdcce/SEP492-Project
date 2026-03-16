import React, {
  memo,
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Gavel,
  HelpCircle,
  ChevronDown,
  Paperclip,
  EyeOff,
  History,
  Scale,
  CornerDownRight,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/components/ui/utils";
import {
  roleBadgeLightClass,
  avatarBgClass,
  getInitials,
  roleLabel,
  relativeTime,
  formatDateTime,
  parseTags,
} from "./constants";
import type { UnifiedTimelineItem } from "./constants";
import type { HearingParticipantRole } from "@/features/hearings/types";

interface UnifiedTimelineProps {
  items: UnifiedTimelineItem[];
  currentUserId?: string | null;
  participantByUser: Map<string, HearingParticipantRole | string>;
  evidenceById: Map<string, { id: string; fileName: string }>;
  onPreviewEvidence: (id: string) => void;
  onAnswerQuestion?: (
    questionId: string,
    answer: string,
  ) => void | Promise<void>;
  onHideMessage?: (messageId: string, reason: string) => void;
  onUnhideMessage?: (messageId: string) => void;
  onSkipQuestion?: (questionId: string) => void;
  canModerate?: boolean;
  nowMs?: number;
}

const renderStatementBlocks = (
  blocks?: Array<{ id?: string; kind?: string; heading?: string | null; body?: string | null }> | null,
) => {
  if (!blocks?.length) return null;

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <div
          key={block.id || `${block.kind || "block"}-${index}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
        >
          {block.heading ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {block.heading}
            </p>
          ) : null}
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {block.body || "No content recorded."}
          </p>
        </div>
      ))}
    </div>
  );
};

export const UnifiedTimeline = memo(function UnifiedTimeline({
  items,
  currentUserId,
  participantByUser,
  evidenceById,
  onPreviewEvidence,
  onAnswerQuestion,
  onHideMessage,
  onUnhideMessage,
  onSkipQuestion,
  canModerate,
  nowMs,
}: UnifiedTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [items.length, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(nearBottom);
    setShowScrollBtn(!nearBottom);
  }, []);

  if (!items.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        <div className="text-center space-y-2">
          <Gavel className="h-8 w-8 mx-auto text-slate-300" />
          <p>No timeline activity yet.</p>
          <p className="text-xs">
            Messages, statements and questions will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto px-4 py-3 space-y-1"
      >
        {items.map((item, index) => {
          if (item.kind === "message")
            return (
              <MessageItem
                key={item.id}
                item={item}
                prevItem={items[index - 1]}
                currentUserId={currentUserId}
                participantByUser={participantByUser}
                evidenceById={evidenceById}
                onPreviewEvidence={onPreviewEvidence}
                onHideMessage={onHideMessage}
                onUnhideMessage={onUnhideMessage}
                canModerate={canModerate}
              />
            );
          if (item.kind === "statement")
            return <StatementItem key={item.id} item={item} />;
          if (item.kind === "verdict")
            return <VerdictTimelineItem key={item.id} item={item} />;
          return (
            <QuestionItem
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              onAnswerQuestion={onAnswerQuestion}
              onSkipQuestion={onSkipQuestion}
              canModerate={canModerate}
              nowMs={nowMs}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-md hover:bg-slate-50 transition-all"
          aria-label="Scroll to latest message"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Latest messages
        </button>
      )}
    </div>
  );
});

/* ─── Message item with grouping ─── */

interface MessageItemProps {
  item: Extract<UnifiedTimelineItem, { kind: "message" }>;
  prevItem?: UnifiedTimelineItem;
  currentUserId?: string | null;
  participantByUser: Map<string, HearingParticipantRole | string>;
  evidenceById: Map<string, { id: string; fileName: string }>;
  onPreviewEvidence: (id: string) => void;
  onHideMessage?: (messageId: string, reason: string) => void;
  onUnhideMessage?: (messageId: string) => void;
  canModerate?: boolean;
}

const MessageItem = memo(function MessageItem({
  item,
  prevItem,
  currentUserId,
  participantByUser,
  evidenceById,
  onPreviewEvidence,
  onHideMessage,
  onUnhideMessage,
  canModerate,
}: MessageItemProps) {
  const m = item.message;
  const senderId = m.senderId || m.sender?.id;
  const isOwn = Boolean(currentUserId && senderId === currentUserId);
  const sender = m.sender?.fullName || m.sender?.email || senderId || "System";
  const hearingRole =
    m.senderHearingRole ||
    (senderId ? participantByUser.get(senderId) : undefined);
  const [hidePrompt, setHidePrompt] = useState(false);
  const [hideReason, setHideReason] = useState("");
  const [hiding, setHiding] = useState(false);

  // Group consecutive messages from same sender
  const isContinuation =
    prevItem?.kind === "message" &&
    !prevItem.message.isHidden &&
    (prevItem.message.senderId || prevItem.message.sender?.id) === senderId &&
    item.sortAt - prevItem.sortAt < 120_000; // within 2 minutes

  // Evidence tags
  const tags = useMemo(() => {
    const raw = [
      ...new Set([
        ...parseTags(m.content),
        ...(m.relatedEvidenceId ? [m.relatedEvidenceId] : []),
      ]),
    ];
    return raw.map((id) => {
      const ev = evidenceById.get(id);
      return { id, label: ev?.fileName || `#EVD-${id.slice(0, 8)}` };
    });
  }, [m.content, m.relatedEvidenceId, evidenceById]);

  // Hidden message placeholder
  if (m.isHidden) {
    return (
      <div className="mt-2 mx-2 flex items-center gap-2 rounded-md bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs text-slate-400 italic">
        <EyeOff className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">
          Message hidden{m.hiddenReason ? `: ${m.hiddenReason}` : ""}
        </span>
        {canModerate && onUnhideMessage && (
          <button
            onClick={() => onUnhideMessage(m.id)}
            className="ml-auto text-xs font-medium text-sky-600 hover:text-sky-800 not-italic transition-colors"
            title="Restore this message"
          >
            Restore
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-2.5",
        isOwn ? "flex-row-reverse" : "flex-row",
        isContinuation ? "mt-0.5" : "mt-3",
      )}
    >
      {/* Avatar  Eonly show on first message of a group */}
      <div className="w-8 shrink-0 pt-0.5">
        {!isContinuation && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      avatarBgClass(String(hearingRole || "")),
                    )}
                  >
                    {getInitials(sender)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {sender} ({roleLabel(hearingRole)})
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] min-w-30",
          isOwn ? "items-end" : "items-start",
        )}
      >
        {/* Sender name + role (only on first of group) */}
        {!isContinuation && (
          <div
            className={cn(
              "flex items-center gap-2 mb-1",
              isOwn ? "flex-row-reverse" : "flex-row",
            )}
          >
            <span className="text-xs font-semibold text-slate-800">
              {sender}
            </span>
            {hearingRole && (
              <Badge
                className={cn(
                  roleBadgeLightClass(String(hearingRole)),
                  "text-xs px-1.5 py-0",
                )}
              >
                {roleLabel(hearingRole)}
              </Badge>
            )}
          </div>
        )}

        {/* Message body */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isOwn
              ? "bg-sky-50 border border-sky-200 text-slate-800"
              : "bg-white border border-slate-200 text-slate-800",
          )}
        >
          {m.content && (
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          )}
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tags.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onPreviewEvidence(id)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100 cursor-pointer transition-colors"
                >
                  <Paperclip className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp + Hide button */}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-2",
            isOwn ? "flex-row-reverse" : "flex-row",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-slate-400">
                {relativeTime(m.createdAt)}
              </p>
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(m.createdAt)}</TooltipContent>
          </Tooltip>

          {/* Hide message button  Emoderators only */}
          {canModerate && onHideMessage && !isOwn && (
            <button
              onClick={() => setHidePrompt(true)}
              className="text-xs text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Hide this message"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Hide reason prompt */}
        {hidePrompt && (
          <div className="mt-1 flex items-center gap-1.5">
            <input
              type="text"
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              placeholder="Reason for hiding…"
              className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-400"
              onKeyDown={(e) => {
                if (e.key === "Escape") setHidePrompt(false);
                if (e.key === "Enter" && hideReason.trim()) {
                  setHiding(true);
                  onHideMessage?.(m.id, hideReason.trim());
                }
              }}
              autoFocus
            />
            <button
              disabled={!hideReason.trim() || hiding}
              onClick={() => {
                setHiding(true);
                onHideMessage?.(m.id, hideReason.trim());
              }}
              className="rounded bg-rose-500 px-2 py-1 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {hiding ? "…" : "Hide"}
            </button>
            <button
              onClick={() => {
                setHidePrompt(false);
                setHideReason("");
              }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

/* ─── Statement item ─── */

interface StatementItemProps {
  item: Extract<UnifiedTimelineItem, { kind: "statement" }>;
}

const STATEMENT_TYPE_STYLES: Record<
  string,
  { border: string; bg: string; text: string; label: string }
> = {
  OPENING: {
    border: "border-l-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    label: "Opening",
  },
  EVIDENCE: {
    border: "border-l-teal-500",
    bg: "bg-teal-50",
    text: "text-teal-700",
    label: "Evidence",
  },
  REBUTTAL: {
    border: "border-l-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
    label: "Rebuttal",
  },
  CLOSING: {
    border: "border-l-purple-500",
    bg: "bg-purple-50",
    text: "text-purple-700",
    label: "Closing",
  },
  QUESTION: {
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Question",
  },
  ANSWER: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Answer",
  },
};

const PARTICIPANT_ROLE_BADGE: Record<string, string> = {
  RAISER: "bg-rose-100 text-rose-700 border-rose-200",
  DEFENDANT: "bg-sky-100 text-sky-700 border-sky-200",
  MODERATOR: "bg-violet-100 text-violet-700 border-violet-200",
  OBSERVER: "bg-slate-100 text-slate-600 border-slate-200",
};

interface StatementVersionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: Extract<UnifiedTimelineItem, { kind: "statement" }>["statement"];
  participantName: string;
}

const StatementVersionDetailDialog = memo(function StatementVersionDetailDialog({
  open,
  onOpenChange,
  statement,
  participantName,
}: StatementVersionDetailDialogProps) {
  const revisions = statement.versionHistory ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-slate-600" />
            Statement Record
          </DialogTitle>
          <DialogDescription>
            Review the current filing and saved draft revisions for {participantName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-slate-300 bg-slate-900 text-white">
                Current version
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                v{statement.versionNumber ?? 1}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                {statement.status}
              </Badge>
              {statement.platformDeclarationAccepted ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Declaration confirmed
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              {statement.title ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Title
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{statement.title}</p>
                </div>
              ) : null}

              {statement.structuredContent?.length ? (
                renderStatementBlocks(statement.structuredContent)
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {statement.content}
                </p>
              )}

              {statement.citedEvidenceIds?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {statement.citedEvidenceIds.map((evidenceId) => (
                    <Badge
                      key={evidenceId}
                      className="border-slate-200 bg-slate-100 text-[11px] text-slate-600"
                    >
                      Evidence {evidenceId}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                <p>Created: {formatDateTime(statement.createdAt)}</p>
                <p>Updated: {formatDateTime(statement.updatedAt || statement.createdAt)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Revision history</h3>
              <p className="text-xs text-slate-500">
                {revisions.length
                  ? `${revisions.length} saved draft revision${revisions.length > 1 ? "s" : ""}.`
                  : "No prior draft revisions were recorded for this filing."}
              </p>
            </div>

            {revisions.length ? (
              <div className="mt-4 space-y-3">
                {revisions
                  .slice()
                  .sort((left, right) => right.versionNumber - left.versionNumber)
                  .map((revision) => (
                    <article
                      key={`${revision.versionNumber}-${revision.savedAt}`}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                          v{revision.versionNumber}
                        </Badge>
                        <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                          {revision.status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          Saved {formatDateTime(revision.savedAt)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-3">
                        {revision.changeSummary ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Change summary
                            </p>
                            <p className="mt-1 text-sm text-slate-700">{revision.changeSummary}</p>
                          </div>
                        ) : null}

                        {revision.title ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Title
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-900">
                              {revision.title}
                            </p>
                          </div>
                        ) : null}

                        {revision.structuredContent?.length ? (
                          renderStatementBlocks(revision.structuredContent)
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                            {revision.content}
                          </p>
                        )}

                        {revision.citedEvidenceIds?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {revision.citedEvidenceIds.map((evidenceId) => (
                              <Badge
                                key={evidenceId}
                                className="border-slate-200 bg-slate-100 text-[11px] text-slate-600"
                              >
                                Evidence {evidenceId}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
              </div>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
});

const StatementItem = memo(function StatementItem({
  item,
}: StatementItemProps) {
  const s = item.statement;
  const [detailOpen, setDetailOpen] = useState(false);
  const name =
    s.participant?.user?.fullName ||
    s.participant?.user?.email ||
    s.participantId;
  const role = s.participant?.role;
  const style = STATEMENT_TYPE_STYLES[s.type] || STATEMENT_TYPE_STYLES.OPENING;

  return (
    <div className="mt-3 mx-2">
      <div
        className={cn(
          "rounded-lg border-l-4 border p-3",
          style.border,
          style.bg,
          "border-slate-200/80",
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Gavel className={cn("h-4 w-4", style.text)} />
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              style.text,
            )}
          >
            {style.label} Statement
          </span>
          <Badge
            className={cn(
              "text-xs border",
              PARTICIPANT_ROLE_BADGE[role || ""] ||
                PARTICIPANT_ROLE_BADGE.OBSERVER,
            )}
          >
            {role ? roleLabel(role) : "Unknown"}
          </Badge>
          <Badge
            className={
              s.status === "SUBMITTED"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-xs"
                : "border-slate-200 bg-slate-50 text-slate-600 text-xs"
            }
          >
            {s.status}
          </Badge>
          <Badge className="border-slate-200 bg-white text-slate-600 text-xs">
            v{s.versionNumber ?? 1}
          </Badge>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-700">{name}</p>
        {s.replyToStatementId && (
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
            <CornerDownRight className="h-3 w-3" />
            In reply to a previous statement
          </p>
        )}
        {s.title && (
          <p className="mt-1 text-sm font-medium text-slate-900">{s.title}</p>
        )}
        {s.structuredContent?.length ? (
          <div className="mt-2">
            {renderStatementBlocks(
              s.structuredContent.map((block) => ({
                ...block,
                heading: block.heading,
                body: block.body,
              })),
            )}
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {s.content}
          </p>
        )}
        {s.citedEvidenceIds?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.citedEvidenceIds.map((evidenceId) => (
              <Badge
                key={evidenceId}
                className="border-slate-200 bg-slate-100 text-[11px] text-slate-600"
              >
                Evidence {evidenceId}
              </Badge>
            ))}
          </div>
        ) : null}
        {s.versionHistory?.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-slate-500">
              Revision log: {s.versionHistory.length} earlier draft
              {s.versionHistory.length > 1 ? "s" : ""}.
            </p>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <History className="h-3 w-3" />
              View details
            </button>
          </div>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-1.5 text-xs text-slate-400">
              {relativeTime(s.createdAt)}
            </p>
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(s.createdAt)}</TooltipContent>
        </Tooltip>
      </div>
      <StatementVersionDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        statement={s}
        participantName={name}
      />
    </div>
  );
});

/* ─── Question item ─── */

interface QuestionItemProps {
  item: Extract<UnifiedTimelineItem, { kind: "question" }>;
  currentUserId?: string | null;
  onAnswerQuestion?: (
    questionId: string,
    answer: string,
  ) => void | Promise<void>;
  onSkipQuestion?: (questionId: string) => void;
  canModerate?: boolean;
  nowMs?: number;
}

const QuestionItem = memo(function QuestionItem({
  item,
  currentUserId,
  onAnswerQuestion,
  onSkipQuestion,
  canModerate,
  nowMs,
}: QuestionItemProps) {
  const q = item.question;
  const isTarget = Boolean(currentUserId && q.targetUserId === currentUserId);
  const canAnswer =
    isTarget && q.status === "PENDING_ANSWER" && Boolean(onAnswerQuestion);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitAnswer = useCallback(async () => {
    if (!answerText.trim() || !onAnswerQuestion || submitting) return;
    setSubmitting(true);
    try {
      await onAnswerQuestion(q.id, answerText.trim());
      setAnswerText("");
    } catch {
      // error is handled by the parent callback
    } finally {
      setSubmitting(false);
    }
  }, [answerText, onAnswerQuestion, q.id, submitting]);

  return (
    <div className="mt-3 mx-2">
      <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-200 bg-amber-50/50 p-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Question
          </span>
          <Badge
            className={
              q.status === "ANSWERED"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-xs"
                : "border-amber-200 bg-amber-100 text-amber-800 text-xs"
            }
          >
            {q.status}
          </Badge>
          <span className="text-xs text-slate-500">
            ↁE{q.targetUser?.fullName || q.targetUser?.email || q.targetUserId}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-medium text-slate-900">
          {q.question}
        </p>
        {q.answer && (
          <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2">
            <p className="text-xs font-semibold text-emerald-700">Answer:</p>
            <p className="text-sm text-slate-700">{q.answer}</p>
          </div>
        )}

        {/* Answer input for the targeted user */}
        {canAnswer && (
          <div className="mt-2 space-y-2">
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="Type your answer…"
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !answerText.trim()}
              className="h-8 rounded-md bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Submitting…" : "Submit Answer"}
            </button>
          </div>
        )}

        {/* Deadline indicator with live countdown for pending questions */}
        {q.status === "PENDING_ANSWER" &&
          q.deadline &&
          (() => {
            const deadlineMs = new Date(q.deadline).getTime();
            const now = nowMs ?? Date.now();
            const remainMs = deadlineMs - now;
            const overdue = remainMs <= 0;
            const mins = Math.floor(Math.abs(remainMs) / 60000);
            const secs = Math.floor((Math.abs(remainMs) % 60000) / 1000);
            return (
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  overdue
                    ? "text-rose-600"
                    : remainMs < 60000
                      ? "text-rose-500"
                      : "text-amber-700",
                )}
              >
                Deadline: {formatDateTime(q.deadline)}
                {" · "}
                {overdue
                  ? `Overdue by ${mins}m ${secs}s`
                  : `${mins}m ${secs}s remaining`}
              </p>
            );
          })()}

        {/* Skip / Cancel button for moderators */}
        {canModerate && q.status === "PENDING_ANSWER" && onSkipQuestion && (
          <button
            onClick={() => onSkipQuestion(q.id)}
            className="mt-1.5 h-6 rounded bg-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-300 transition-colors"
          >
            Skip Question
          </button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mt-1.5 text-xs text-slate-400">
              {relativeTime(q.createdAt)}
            </p>
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(q.createdAt)}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

/* ─── Verdict timeline event ─── */

const RESULT_LABELS: Record<string, string> = {
  WIN_CLIENT: "In Favor of Client",
  WIN_FREELANCER: "In Favor of Freelancer",
  SPLIT: "Split Resolution",
};

const VerdictTimelineItem = memo(function VerdictTimelineItem({
  item,
}: {
  item: Extract<UnifiedTimelineItem, { kind: "verdict" }>;
}) {
  const label = RESULT_LABELS[item.verdictResult] ?? item.verdictResult;
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 shadow-sm">
        <Scale className="h-4 w-4 text-amber-700" />
        <span className="text-xs font-semibold text-amber-900">
          Verdict Issued  E{label}
        </span>
        {item.adjudicatorName && (
          <span className="text-xs text-amber-600">
            by {item.adjudicatorName}
          </span>
        )}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
    </div>
  );
});
