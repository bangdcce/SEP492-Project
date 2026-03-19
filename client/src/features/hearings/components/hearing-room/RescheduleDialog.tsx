import React, { memo, useCallback, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
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
import { getApiErrorDetails } from "@/shared/utils/apiError";
import {
  getSchedulingErrorMessage,
  HEARING_RESCHEDULE_FREEZE_HOURS,
} from "@/features/hearings/utils/schedulingFeedback";
import { toast } from "sonner";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hearingId: string;
  onRescheduled?: () => void;
}

const DEFAULT_DURATION_MINUTES = 60;

export const RescheduleDialog = memo(function RescheduleDialog({
  open,
  onOpenChange,
  hearingId,
  onRescheduled,
}: RescheduleDialogProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [agenda, setAgenda] = useState("");
  const [externalMeetingLink, setExternalMeetingLink] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const minDate = useMemo(
    () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    [],
  );

  const resetForm = useCallback(() => {
    setScheduledAt("");
    setDurationMinutes(DEFAULT_DURATION_MINUTES);
    setAgenda("");
    setExternalMeetingLink("");
    setIsEmergency(false);
    setConfirmed(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!scheduledAt) {
      toast.error("Please select a date and time.");
      return;
    }

    if (!confirmed) {
      toast.error("Confirm the new schedule before resubmitting.");
      return;
    }

    try {
      setSubmitting(true);
      await rescheduleHearing(hearingId, {
        hearingId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        estimatedDurationMinutes: durationMinutes,
        agenda: agenda.trim() || undefined,
        externalMeetingLink: externalMeetingLink.trim() || undefined,
        isEmergency,
      });

      toast.success("Hearing rescheduled successfully.");
      onRescheduled?.();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      const details = getApiErrorDetails(error, "Could not reschedule the hearing.");
      toast.error(getSchedulingErrorMessage(details, "reschedule"));
    } finally {
      setSubmitting(false);
    }
  }, [
    agenda,
    confirmed,
    durationMinutes,
    externalMeetingLink,
    hearingId,
    isEmergency,
    onOpenChange,
    onRescheduled,
    resetForm,
    scheduledAt,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-slate-700" />
            Reschedule Hearing
          </DialogTitle>
          <DialogDescription>
            Update the hearing slot, then confirm the change before submitting it to participants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Reschedule freeze rule</p>
                <p>
                  Standard reschedules are locked within{" "}
                  {HEARING_RESCHEDULE_FREEZE_HOURS} hours of the hearing start.
                  Emergency reschedule is reserved for true exceptions.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              New Date and Time <span className="text-rose-500">*</span>
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              min={minDate}
              disabled={submitting}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estimated Duration (minutes)
            </label>
            <Input
              type="number"
              min={15}
              max={240}
              step={15}
              value={durationMinutes}
              onChange={(event) =>
                setDurationMinutes(Number(event.target.value) || DEFAULT_DURATION_MINUTES)
              }
              disabled={submitting}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Updated Agenda
            </label>
            <Textarea
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              placeholder="Describe what will be covered in the rescheduled hearing."
              rows={3}
              disabled={submitting}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Manual Meeting Link
            </label>
            <Input
              type="url"
              value={externalMeetingLink}
              onChange={(event) => setExternalMeetingLink(event.target.value)}
              placeholder="https://meet.google.com/... or https://zoom.us/..."
              disabled={submitting}
              className="text-sm"
            />
            <p className="text-[11px] text-slate-500">
              Optional. Use a full URL if you need a manual external room.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(event) => setIsEmergency(event.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-slate-700">
              Emergency reschedule request
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <span className="text-sm text-slate-700">
              I confirmed the new time, duration, and meeting link before notifying participants.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting || !scheduledAt || !confirmed}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-800 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" />
            )}
            {submitting ? "Rescheduling..." : "Reschedule"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
