import { memo, useCallback, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scale,
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
import {
  DISPUTE_DISCLAIMER_COPY,
  DISPUTE_DISCLAIMER_VERSION,
} from "@/features/disputes/constants/disputeLegal";

const VERDICT_APPEAL_REASON_MIN_LENGTH = 200;
const REJECTION_APPEAL_REASON_MIN_LENGTH = 50;

interface AppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "verdict" | "rejection";
  onSubmit: (input: {
    reason: string;
    disclaimerAccepted: boolean;
    disclaimerVersion: string;
  }) => Promise<void>;
  deadlineText?: string;
}

export const AppealDialog = memo(function AppealDialog({
  open,
  onOpenChange,
  mode = "verdict",
  onSubmit,
  deadlineText,
}: AppealDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setReason("");
    setDisclaimerAccepted(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedReason = reason.trim();
    const minReasonLength =
      mode === "rejection"
        ? REJECTION_APPEAL_REASON_MIN_LENGTH
        : VERDICT_APPEAL_REASON_MIN_LENGTH;
    if (trimmedReason.length < minReasonLength || !disclaimerAccepted) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        reason: trimmedReason,
        disclaimerAccepted: true,
        disclaimerVersion: DISPUTE_DISCLAIMER_VERSION,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [disclaimerAccepted, mode, onOpenChange, onSubmit, reason, reset]);

  const minReasonLength =
    mode === "rejection"
      ? REJECTION_APPEAL_REASON_MIN_LENGTH
      : VERDICT_APPEAL_REASON_MIN_LENGTH;
  const canProceed = reason.trim().length >= minReasonLength;
  const canSubmit = canProceed && disclaimerAccepted;
  const copy =
    mode === "rejection"
      ? {
          title: "Appeal Rejection",
          description:
            "Request an admin review of a rejected dispute submission. Explain why the dismissal should be overturned.",
          helper:
            "State the factual basis for reopening this dispute. Include what was missed, what evidence matters, and why the rejection was unreasonable.",
          placeholder:
            "Explain why the rejection should be reconsidered. Reference missing evidence, process issues, or facts that justify reopening the dispute.",
          reviewLabel: "Review Rejection Appeal",
          confirmTitle: "Confirm rejection appeal",
          confirmDescription:
            "The case will be routed to an admin for desk review. The rejection may be upheld or the dispute may be reopened.",
          submitLabel: "Submit Rejection Appeal",
        }
      : {
          title: "Appeal Verdict",
          description:
            "File a formal appeal against the issued verdict. Appeals are reviewed by a Tier 2 administrator.",
          helper:
            "State the factual or procedural basis for the appeal clearly. The backend requires a detailed justification.",
          placeholder:
            "Explain why the verdict should be reconsidered. Reference concrete facts, evidence, timeline details, or procedural issues.",
          reviewLabel: "Review Appeal",
          confirmTitle: "Confirm appeal submission",
          confirmDescription:
            "The case will be escalated for admin review. The original verdict may be upheld, modified, or overturned.",
          submitLabel: "Submit Appeal",
        };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="appeal-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-amber-600" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            {copy.description}
            {deadlineText ? (
              <span className="ml-1 font-medium text-amber-600">
                Deadline: {deadlineText}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {copy.helper} The frontend requires at least {minReasonLength} characters.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Reason <span className="text-rose-500">*</span>
              </label>
              <Textarea
                data-testid="appeal-reason-input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={copy.placeholder}
                rows={8}
                className="resize-none text-sm"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  {reason.length} characters
                  {reason.length > 0 && reason.length < minReasonLength ? (
                    <span className="ml-1 text-amber-500">
                      (min {minReasonLength})
                    </span>
                  ) : null}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                data-testid="appeal-review-step"
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                {copy.reviewLabel}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {copy.confirmTitle}
                </div>
                <p className="text-xs text-amber-700">
                  {copy.confirmDescription}
                </p>
              </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Reason
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {reason.trim()}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <input
                data-testid="appeal-disclaimer-checkbox"
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(event) => setDisclaimerAccepted(event.target.checked)}
                className="mt-0.5"
              />
              <span>{DISPUTE_DISCLAIMER_COPY}</span>
            </label>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                data-testid="appeal-back-step"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                data-testid="submit-appeal"
                onClick={() => void handleSubmit()}
                disabled={submitting || !canSubmit}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : copy.submitLabel}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
