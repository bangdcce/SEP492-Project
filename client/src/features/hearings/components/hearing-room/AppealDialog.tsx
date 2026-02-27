/**
 * AppealDialog  EDialog for parties to appeal a verdict
 * ──────────────────────────────────────────────────────
 * Two-step form:
 *   1. Select appeal type + write reason
 *   2. Confirmation step
 */

import { memo, useState, useCallback } from "react";
import {
  Scale,
  AlertTriangle,
  Loader2,
  Send,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/components/ui/utils";

/* ─── Appeal types ─── */

interface AppealType {
  value: string;
  label: string;
  description: string;
}

const APPEAL_TYPES: AppealType[] = [
  {
    value: "PROCEDURAL_ERROR",
    label: "Procedural Error",
    description: "The hearing process was not conducted properly",
  },
  {
    value: "NEW_EVIDENCE",
    label: "New Evidence",
    description: "Important evidence was not available during the hearing",
  },
  {
    value: "FACTUAL_ERROR",
    label: "Factual Error",
    description: "The verdict was based on incorrect factual findings",
  },
  {
    value: "DISPROPORTIONATE",
    label: "Disproportionate Outcome",
    description: "The penalty or financial distribution is unfair",
  },
];

/* ─── Props ─── */

interface AppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { reason: string; appealType?: string }) => Promise<void>;
  /** Time remaining before appeal deadline */
  deadlineText?: string;
}

export const AppealDialog = memo(function AppealDialog({
  open,
  onOpenChange,
  onSubmit,
  deadlineText,
}: AppealDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [appealType, setAppealType] = useState<string>("FACTUAL_ERROR");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setAppealType("FACTUAL_ERROR");
    setReason("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) return;
    try {
      setSubmitting(true);
      await onSubmit({
        reason: reason.trim(),
        appealType,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [reason, appealType, onSubmit, onOpenChange, reset]);

  const canProceed = reason.trim().length >= 20;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-amber-600" />
            Appeal Verdict
          </DialogTitle>
          <DialogDescription>
            File a formal appeal against the issued verdict. Your appeal will be
            reviewed by a senior administrator.
            {deadlineText && (
              <span className="ml-1 font-medium text-amber-600">
                Deadline: {deadlineText}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Appeal type + reason */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Appeal type selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Grounds for Appeal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {APPEAL_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setAppealType(type.value)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left text-xs transition-all",
                      appealType === type.value
                        ? "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-200"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs opacity-75">
                      {type.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Reason <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain in detail why you believe the verdict should be reconsidered. Include specific factual points, evidence references, or procedural issues…"
                rows={5}
                className="text-sm resize-none"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  {reason.length} characters
                  {reason.length > 0 && reason.length < 20 && (
                    <span className="text-amber-500 ml-1">
                      (min 20 characters)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Next button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                Review Appeal
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Please confirm your appeal
              </div>
              <p className="text-xs text-amber-700">
                This action cannot be undone. Your appeal will be forwarded to a
                Tier 2 administrator for review. The original verdict may be
                upheld, modified, or overturned.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-xs text-slate-500">
                <span className="font-medium">Grounds:</span>{" "}
                {APPEAL_TYPES.find((t) => t.value === appealType)?.label ??
                  appealType}
              </div>
              <div className="text-xs text-slate-600">
                <span className="font-medium text-slate-500">Reason:</span>{" "}
                {reason}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setStep(1)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Submitting…" : "Submit Appeal"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
