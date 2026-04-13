import React, {
  memo,
  useRef,
  useState,
  useCallback,
  type ChangeEvent,
} from "react";
import {
  Send,
  Paperclip,
  Upload,
  HelpCircle,
  AlertCircle,
  X,
  Gavel,
} from "lucide-react";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/shared/components/ui/popover";
import { cn } from "@/shared/components/ui/utils";
import { roleLabel } from "./constants";
import type { HearingParticipantSummary } from "@/features/hearings/types";

interface MessageComposerProps {
  canSendMessage: boolean;
  chatBlockedReason: string;
  canUploadEvidence: boolean;
  uploadBlockedReason: string;
  canAttachEvidence: boolean;
  canAskQuestions: boolean;
  sending: boolean;
  evidenceAttaching: boolean;
  evidenceUploading: boolean;
  questionSubmitting: boolean;
  evidence: Array<{ id: string; fileName: string }>;
  participants: HearingParticipantSummary[] | undefined;
  /** Number of pending questions directed at the current user */
  pendingQuestionsForMe?: number;

  onSendMessage: (content: string) => void;
  onAttachEvidence: (evidenceId: string) => void;
  onUploadFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onAskQuestion: (targetUserId: string, question: string) => void;
  onOpenStatementDialog?: () => void;
  onTyping?: () => void;
}

export const MessageComposer = memo(function MessageComposer({
  canSendMessage,
  chatBlockedReason,
  canUploadEvidence,
  uploadBlockedReason,
  canAttachEvidence,
  canAskQuestions,
  sending,
  evidenceAttaching,
  evidenceUploading,
  questionSubmitting,
  evidence,
  participants,
  onSendMessage,
  onAttachEvidence,
  onUploadFile,
  onAskQuestion,
  onOpenStatementDialog,
  onTyping,
  pendingQuestionsForMe,
}: MessageComposerProps) {
  const [messageInput, setMessageInput] = useState("");
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionTargetId, setQuestionTargetId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    if (!messageInput.trim()) return;
    onSendMessage(messageInput.trim());
    setMessageInput("");
  }, [messageInput, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuestion = useCallback(() => {
    if (!questionTargetId || !questionText.trim()) return;
    onAskQuestion(questionTargetId, questionText.trim());
    setQuestionText("");
    setQuestionTargetId("");
    setQuestionOpen(false);
  }, [questionTargetId, questionText, onAskQuestion]);

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      {!canSendMessage && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{chatBlockedReason}</span>
        </div>
      )}

      {/* Pending question alert */}
      {pendingQuestionsForMe && pendingQuestionsForMe > 0 ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <span className="font-medium">
            You have {pendingQuestionsForMe} pending question
            {pendingQuestionsForMe > 1 ? "s" : ""} to answer  Escroll up to find{" "}
            {pendingQuestionsForMe > 1 ? "them" : "it"} in the timeline.
          </span>
        </div>
      ) : null}

      {/* Main input row */}
      <div className="flex items-end gap-2">
        <Textarea
          value={messageInput}
          disabled={!canSendMessage}
          onChange={(e) => {
            setMessageInput(e.target.value);
            if (canSendMessage) {
              onTyping?.();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            canSendMessage
              ? "Type a message… (Enter to send, Shift+Enter for new line)"
              : "Chat is currently restricted"
          }
          className="min-h-10 max-h-30 flex-1 resize-none rounded-lg border-slate-300 bg-white text-sm focus-visible:ring-slate-400"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!canSendMessage || sending || !messageInput.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar row  Ecompact, icons only with tooltips */}
      <div className="mt-2 flex items-center gap-1">
        {/* Attach evidence */}
        {canAttachEvidence && evidence.length > 0 && (
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Attach existing evidence"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Attach</span>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Attach existing evidence to message
              </TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select evidence
              </p>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {evidence.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onAttachEvidence(ev.id)}
                    disabled={evidenceAttaching}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors truncate"
                  >
                    {ev.fileName}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Upload file */}
        {canUploadEvidence ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onUploadFile}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={evidenceUploading}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  aria-label="Upload evidence file"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {evidenceUploading ? "Uploading…" : "Upload"}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Upload new evidence file</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-400 cursor-not-allowed">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Upload</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{uploadBlockedReason}</TooltipContent>
          </Tooltip>
        )}

        {/* Ask question */}
        {canAskQuestions && (
          <Popover open={questionOpen} onOpenChange={setQuestionOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                      questionOpen
                        ? "bg-amber-100 text-amber-800"
                        : "text-slate-600 hover:bg-slate-100",
                    )}
                    aria-label="Ask a question"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Question</span>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Ask a formal question to a participant
              </TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-80 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ask Question
                </p>
                <button
                  onClick={() => setQuestionOpen(false)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
              <select
                value={questionTargetId}
                onChange={(e) => setQuestionTargetId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
              >
                <option value="">Select target participant</option>
                {participants
                  ?.filter((p) => p.role !== "MODERATOR")
                  .map((p) => (
                    <option key={p.id} value={p.userId}>
                      {p.user?.fullName || p.user?.email || p.userId} (
                      {roleLabel(p.role)})
                    </option>
                  ))}
              </select>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                className="text-sm"
                placeholder="Write your question…"
              />
              <button
                onClick={handleQuestion}
                disabled={
                  questionSubmitting ||
                  !questionTargetId ||
                  !questionText.trim()
                }
                className="h-9 w-full rounded-md bg-amber-600 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {questionSubmitting ? "Submitting…" : "Submit Question"}
              </button>
            </PopoverContent>
          </Popover>
        )}

        {/* Formal statement */}
        {onOpenStatementDialog && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenStatementDialog}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Submit formal statement"
              >
                <Gavel className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Statement</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Submit a formal statement to the hearing record
            </TooltipContent>
          </Tooltip>
        )}

        {/* Keyboard hint */}
        <span className="ml-auto text-xs text-slate-400 hidden lg:block">
          Enter to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  );
});
