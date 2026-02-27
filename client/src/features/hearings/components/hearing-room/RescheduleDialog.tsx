import React, { memo, useState, useCallback } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/Input";
import { rescheduleHearing } from "@/features/hearings/api";
import { toast } from "sonner";

/* ─── Props ─── */

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hearingId: string;
  onRescheduled?: () => void;
}

export const RescheduleDialog = memo(function RescheduleDialog({
  open,
  onOpenChange,
  hearingId,
  onRescheduled,
}: RescheduleDialogProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [agenda, setAgenda] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!scheduledAt) return toast.error("Please select a date and time");
    try {
      setSubmitting(true);
      await rescheduleHearing(hearingId, {
        hearingId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        estimatedDurationMinutes: durationMinutes,
        agenda: agenda.trim() || undefined,
        isEmergency,
      });
      toast.success("Hearing rescheduled successfully");
      onRescheduled?.();
      onOpenChange(false);
      /* Reset */
      setScheduledAt("");
      setDurationMinutes(60);
      setAgenda("");
      setIsEmergency(false);
    } catch {
      toast.error("Could not reschedule the hearing");
    } finally {
      setSubmitting(false);
    }
  }, [
    scheduledAt,
    durationMinutes,
    agenda,
    isEmergency,
    hearingId,
    onRescheduled,
    onOpenChange,
  ]);

  /* Minimum datetime = now + 1 hour */
  const minDate = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-slate-700" />
            Reschedule Hearing
          </DialogTitle>
          <DialogDescription>
            Set a new date/time for this hearing. All participants will be
            notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date/Time */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              New Date &amp; Time <span className="text-rose-500">*</span>
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minDate}
              disabled={submitting}
              className="text-sm"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estimated Duration (minutes)
            </label>
            <Input
              type="number"
              min={15}
              max={480}
              step={15}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
              disabled={submitting}
              className="text-sm"
            />
          </div>

          {/* Agenda */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Updated Agenda{" "}
              <span className="font-normal normal-case text-slate-400">
                (optional)
              </span>
            </label>
            <Textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Describe what will be covered in the rescheduled hearing…"
              rows={3}
              disabled={submitting}
              className="text-sm resize-none"
            />
          </div>

          {/* Emergency */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700">
              Mark as emergency rescheduling
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !scheduledAt}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" />
            )}
            {submitting ? "Rescheduling…" : "Reschedule"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
