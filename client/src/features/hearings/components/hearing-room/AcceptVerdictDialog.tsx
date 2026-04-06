import { memo, useCallback, useState } from "react";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DISPUTE_DISCLAIMER_COPY,
  DISPUTE_DISCLAIMER_VERSION,
} from "@/features/disputes/constants/disputeLegal";

interface AcceptVerdictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    disclaimerAccepted: boolean;
    waiveAppealRights: boolean;
    disclaimerVersion: string;
  }) => Promise<void>;
}

export const AcceptVerdictDialog = memo(function AcceptVerdictDialog({
  open,
  onOpenChange,
  onSubmit,
}: AcceptVerdictDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setDisclaimerAccepted(false);
    setWaiverAccepted(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!disclaimerAccepted || !waiverAccepted) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        disclaimerAccepted: true,
        waiveAppealRights: true,
        disclaimerVersion: DISPUTE_DISCLAIMER_VERSION,
      });
      reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [disclaimerAccepted, onOpenChange, onSubmit, reset, waiverAccepted]);

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
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Accept Verdict
          </DialogTitle>
          <DialogDescription>
            Accepting the verdict confirms that you agree with this ruling and waive your right to appeal it later.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              If both dispute parties accept the same Tier 1 verdict, the system can release the verdict funds to internal wallets immediately instead of waiting for the appeal deadline.
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(event) => setDisclaimerAccepted(event.target.checked)}
                className="mt-0.5"
              />
              <span>{DISPUTE_DISCLAIMER_COPY}</span>
            </label>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!disclaimerAccepted}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              This action is specific to your account. After you accept the verdict, you cannot submit a formal appeal from this account anymore.
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={waiverAccepted}
                onChange={(event) => setWaiverAccepted(event.target.checked)}
                className="mt-0.5"
              />
              <span>I accept this verdict and waive my appeal rights for this dispute.</span>
            </label>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !waiverAccepted}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {submitting ? "Submitting..." : "Accept Verdict"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
