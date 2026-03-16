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

const APPEAL_REASON_MIN_LENGTH = 200;

interface AppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { reason: string }) => Promise<void>;
  deadlineText?: string;
}

export const AppealDialog = memo(function AppealDialog({
  open,
  onOpenChange,
  onSubmit,
  deadlineText,
}: AppealDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setReason("");
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < APPEAL_REASON_MIN_LENGTH) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({ reason: trimmedReason });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [onOpenChange, onSubmit, reason, reset]);

  const canProceed = reason.trim().length >= APPEAL_REASON_MIN_LENGTH;

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-amber-600" />
            Appeal Verdict
          </DialogTitle>
          <DialogDescription>
            File a formal appeal against the issued verdict. Appeals are reviewed by
            a Tier 2 administrator.
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
              State the factual or procedural basis for the appeal clearly. The
              backend requires at least 200 characters.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Reason <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why the verdict should be reconsidered. Reference concrete facts, evidence, timeline details, or procedural issues."
                rows={8}
                className="resize-none text-sm"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  {reason.length} characters
                  {reason.length > 0 && reason.length < APPEAL_REASON_MIN_LENGTH ? (
                    <span className="ml-1 text-amber-500">
                      (min {APPEAL_REASON_MIN_LENGTH})
                    </span>
                  ) : null}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                Review Appeal
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Confirm appeal submission
              </div>
              <p className="text-xs text-amber-700">
                The case will be escalated for admin review. The original verdict may
                be upheld, modified, or overturned.
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

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setStep(1)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || !canProceed}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Submit Appeal"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
