import React, { memo, useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { AlertTriangle, Clock, Pause } from "lucide-react";

interface PauseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

export const PauseHearingDialog = memo(function PauseHearingDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: PauseDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason("");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-amber-500" />
            Pause Hearing Session
          </AlertDialogTitle>
          <AlertDialogDescription>
            Pausing will prevent all participants from sending messages until
            the session is resumed. Please provide a reason for the record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter the reason for pausing this hearing..."
          rows={3}
          className="text-sm"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {loading ? "Pausing..." : "Pause session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

interface EndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    summary: string;
    findings: string;
    noShowNote?: string;
    forceEnd?: boolean;
  }) => void;
  loading: boolean;
  verdictAnnounced?: boolean;
}

export const EndHearingDialog = memo(function EndHearingDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  verdictAnnounced = false,
}: EndDialogProps) {
  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [noShowNote, setNoShowNote] = useState("");
  const [forceEnd, setForceEnd] = useState(false);

  useEffect(() => {
    if (open) {
      setForceEnd(verdictAnnounced);
    }
  }, [open, verdictAnnounced]);

  const handleConfirm = useCallback(() => {
    const summaryTrimmed = summary.trim();
    const findingsTrimmed = findings.trim();
    const resolvedSummary =
      summaryTrimmed ||
      (verdictAnnounced ? "Hearing closed after verdict announcement." : "");
    const resolvedFindings =
      findingsTrimmed ||
      (verdictAnnounced
        ? "Verdict has been announced and recorded for this dispute."
        : "");

    if (!resolvedSummary || !resolvedFindings) {
      return;
    }

    onConfirm({
      summary: resolvedSummary,
      findings: resolvedFindings,
      noShowNote: noShowNote.trim() || undefined,
      forceEnd: forceEnd || undefined,
    });
  }, [findings, forceEnd, noShowNote, onConfirm, summary, verdictAnnounced]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            End Hearing Session
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This action will <strong>permanently end</strong> the hearing
                session. Once ended:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>No further messages or evidence can be submitted</li>
                <li>The hearing transcript will be finalized</li>
                <li>All participants will be disconnected</li>
              </ul>
              <p className="font-medium text-rose-700">This cannot be undone.</p>
              {verdictAnnounced ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  Verdict has already been announced. You can keep minutes concise
                  and optionally force-close unanswered questions.
                </p>
              ) : null}

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Summary {verdictAnnounced ? "(optional)" : "*"}
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="Brief summary of the hearing session..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Findings {verdictAnnounced ? "(optional)" : "*"}
                </label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="Key findings or conclusions..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  No-show note (required when required participant is absent)
                </label>
                <textarea
                  value={noShowNote}
                  onChange={(e) => setNoShowNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="Document absence details if applicable..."
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={forceEnd}
                  onChange={(event) => setForceEnd(event.target.checked)}
                />
                Force-close unanswered questions when finalizing this hearing.
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || (!verdictAnnounced && (!summary.trim() || !findings.trim()))}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {loading ? "Ending..." : "End hearing"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

interface ExtendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (additionalMinutes: number, reason: string) => void;
  loading: boolean;
}

const EXTEND_OPTIONS = [15, 30, 45, 60] as const;

export const ExtendHearingDialog = memo(function ExtendHearingDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: ExtendDialogProps) {
  const [minutes, setMinutes] = useState<number>(15);
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim() || minutes <= 0) return;
    onConfirm(minutes, reason.trim());
    setReason("");
    setMinutes(15);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Extend Hearing Duration
          </AlertDialogTitle>
          <AlertDialogDescription>
            Add extra time to the current hearing session. Select the amount and
            provide a reason for the extension.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Additional time
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EXTEND_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setMinutes(opt)}
                  className={`h-9 rounded-md border text-sm font-medium transition-colors ${
                    minutes === opt
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt}m
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for extending the hearing..."
            rows={2}
            className="text-sm"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {loading ? "Extending..." : `Extend by ${minutes}m`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
