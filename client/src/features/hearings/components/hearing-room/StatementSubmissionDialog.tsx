import React, { memo, useState, useCallback } from "react";
import {
  FileText,
  Gavel,
  MessageSquare,
  Shield,
  HelpCircle,
  Reply,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/Input";
import { cn } from "@/shared/components/ui/utils";
import type { HearingStatementType } from "@/features/hearings/types";

/* ─── Statement type metadata ─── */

interface StatementTypeMeta {
  value: HearingStatementType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const STATEMENT_TYPES: StatementTypeMeta[] = [
  {
    value: "OPENING",
    label: "Opening",
    icon: Gavel,
    description: "Opening statement presenting your case",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    value: "EVIDENCE",
    label: "Evidence",
    icon: FileText,
    description: "Present evidence with explanation",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    value: "REBUTTAL",
    label: "Rebuttal",
    icon: Shield,
    description: "Counter opposing party's arguments",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    value: "CLOSING",
    label: "Closing",
    icon: MessageSquare,
    description: "Final closing statement",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  {
    value: "QUESTION",
    label: "Question",
    icon: HelpCircle,
    description: "Formal question for the record",
    color: "bg-sky-100 text-sky-700 border-sky-200",
  },
  {
    value: "ANSWER",
    label: "Answer",
    icon: Reply,
    description: "Formal answer to a question",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
];

/* ─── Props ─── */

interface StatementSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    type: HearingStatementType;
    title?: string;
    content: string;
    isDraft?: boolean;
  }) => Promise<void>;
  currentPhase?: string;
  /** Participant's role in this hearing  Eused to enforce statement types */
  participantRole?: string | null;
}

/* ─── Statement type enforcement per role + phase ─── */

/**
 * Returns `null` if allowed, or a reason string if the type is blocked
 * for the given role/phase combination.
 */
const getTypeRestriction = (
  type: HearingStatementType,
  role?: string | null,
  phase?: string,
): string | null => {
  // Observers cannot submit any statement
  if (role === "OBSERVER") return "Observers cannot submit statements";

  // QUESTION type is reserved for staff/moderator formal questions via Ask Question
  if (type === "QUESTION" && role !== "MODERATOR") {
    return "Use the Ask Question button instead";
  }

  // Phase-specific restrictions
  if (phase === "PRESENTATION") {
    if (type === "REBUTTAL" && role === "RAISER")
      return "Rebuttals are available in Cross-Examination phase";
    if (type === "CLOSING")
      return "Closing statements are for the Deliberation phase";
  }

  if (phase === "CROSS_EXAMINATION") {
    if (type === "OPENING")
      return "Opening statements belong in the Presentation phase";
    if (type === "CLOSING")
      return "Closing statements are for the Deliberation phase";
  }

  if (phase === "DELIBERATION") {
    if (type === "OPENING")
      return "Opening statements belong in the Presentation phase";
    if (type === "EVIDENCE")
      return "No new evidence may be submitted during deliberation";
    if (type === "REBUTTAL")
      return "Rebuttals are not allowed during deliberation";
  }

  return null;
};

export const StatementSubmissionDialog = memo(
  function StatementSubmissionDialog({
    open,
    onOpenChange,
    onSubmit,
    currentPhase,
    participantRole,
  }: StatementSubmissionDialogProps) {
    const [selectedType, setSelectedType] =
      useState<HearingStatementType>("OPENING");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);

    const reset = useCallback(() => {
      setSelectedType("OPENING");
      setTitle("");
      setContent("");
    }, []);

    const handleSubmit = useCallback(
      async (isDraft: boolean) => {
        if (!content.trim()) return;
        const setter = isDraft ? setSavingDraft : setSubmitting;
        try {
          setter(true);
          await onSubmit({
            type: selectedType,
            title: title.trim() || undefined,
            content: content.trim(),
            isDraft,
          });
          reset();
          if (!isDraft) onOpenChange(false);
        } finally {
          setter(false);
        }
      },
      [content, title, selectedType, onSubmit, onOpenChange, reset],
    );

    /* Suggest type based on phase */
    const suggestedType: HearingStatementType | null =
      currentPhase === "PRESENTATION"
        ? "OPENING"
        : currentPhase === "CROSS_EXAMINATION"
          ? "REBUTTAL"
          : currentPhase === "DELIBERATION"
            ? "CLOSING"
            : null;

    const busy = submitting || savingDraft;
    const selectedMeta = STATEMENT_TYPES.find((t) => t.value === selectedType)!;

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Gavel className="h-5 w-5 text-slate-700" />
              Submit Formal Statement
            </DialogTitle>
            <DialogDescription>
              Submit a formal statement that will be part of the hearing record.
              {suggestedType && (
                <span className="ml-1 text-amber-600">
                  Suggested: {suggestedType.replace(/_/g, " ").toLowerCase()}{" "}
                  for current phase.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Statement type selector */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Statement Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STATEMENT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.value;
                const isSuggested = suggestedType === type.value;
                const restriction = getTypeRestriction(
                  type.value,
                  participantRole,
                  currentPhase,
                );
                const isDisabled = busy || Boolean(restriction);
                return (
                  <div key={type.value} className="relative group">
                    <button
                      onClick={() =>
                        !restriction && setSelectedType(type.value)
                      }
                      className={cn(
                        "flex w-full flex-col items-center gap-1 rounded-lg border p-2.5 text-xs transition-all",
                        isDisabled && "opacity-40 cursor-not-allowed",
                        isSelected && !restriction
                          ? cn(
                              type.color,
                              "ring-2 ring-offset-1 ring-slate-400",
                            )
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                        isSuggested &&
                          !isSelected &&
                          !restriction &&
                          "border-amber-300",
                      )}
                      disabled={isDisabled}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{type.label}</span>
                    </button>
                    {/* Restriction tooltip */}
                    {restriction && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 w-44 rounded bg-slate-800 px-2 py-1 text-xs text-white text-center shadow-lg">
                        {restriction}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">{selectedMeta.description}</p>
          </div>

          {/* Title (optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Title{" "}
              <span className="font-normal normal-case text-slate-400">
                (optional)
              </span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. "Response to contractor's evidence"`}
              disabled={busy}
              className="text-sm"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Content <span className="text-rose-500">*</span>
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your formal statement…"
              rows={6}
              disabled={busy}
              className="text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {content.length} characters
              </span>
              {content.length > 5000 && (
                <span className="text-xs text-amber-600">
                  Consider keeping statements concise
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => void handleSubmit(true)}
              disabled={busy || !content.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {savingDraft ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {savingDraft ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={() => void handleSubmit(false)}
              disabled={busy || !content.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {submitting ? "Submitting…" : "Submit Statement"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);
