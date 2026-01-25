import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  getRescheduleRequests,
  processRescheduleRequest,
} from "../../api";
import { RescheduleRequestStatus, type RescheduleRequest } from "../../types";

export const RescheduleNegotiator = () => {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const activeRequest = useMemo(() => {
    if (!requests.length) {
      return null;
    }
    return requests.find((req) => req.id === selectedRequestId) || requests[0];
  }, [requests, selectedRequestId]);

  const proposedSlots = activeRequest?.proposedTimeSlots || [];
  const hasProposedSlots = proposedSlots.length > 0;

  const canConfirm =
    !!activeRequest &&
    !processing &&
    (hasProposedSlots ? selectedSlotIndex !== null : activeRequest.useAutoSchedule);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getRescheduleRequests({
        status: RescheduleRequestStatus.PENDING,
        limit: 5,
      });
      const items = data.items || [];
      setRequests(items);
      setSelectedRequestId((prev) =>
        items.some((req) => req.id === prev) ? prev : items[0]?.id || null,
      );
    } catch (error) {
      console.error("Failed to load reschedule requests:", error);
      toast.error("Could not load reschedule requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setSelectedSlotIndex(null);
  }, [activeRequest?.id]);

  const formatSlot = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return "Invalid time slot";
    }
    return `${format(startDate, "MMM d, yyyy")} • ${format(
      startDate,
      "h:mm a",
    )} - ${format(endDate, "h:mm a")}`;
  };

  const handleConfirm = async () => {
    if (!activeRequest) {
      return;
    }
    if (hasProposedSlots && selectedSlotIndex === null) {
      toast.error("Please select a time slot");
      return;
    }

    try {
      setProcessing(true);
      const selectedSlot =
        selectedSlotIndex !== null ? proposedSlots[selectedSlotIndex] : null;
      await processRescheduleRequest({
        requestId: activeRequest.id,
        action: "approve",
        selectedNewStartTime: selectedSlot?.start,
      });
      toast.success("Reschedule confirmed");
      await loadRequests();
    } catch (error) {
      console.error("Failed to confirm reschedule:", error);
      toast.error("Could not confirm reschedule");
    } finally {
      setProcessing(false);
    }
  };

  const formatRequestDate = (value?: string) => {
    if (!value) {
      return "Unknown date";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }
    return format(date, "MMM d");
  };

  const requesterLabel =
    activeRequest?.requester?.fullName ||
    activeRequest?.requester?.email ||
    "A user";
  const eventLabel =
    activeRequest?.event?.title || activeRequest?.eventId || "event";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
      <h3 className="font-semibold text-slate-900 mb-2">Reschedule Request</h3>
      {loading ? (
        <p className="text-sm text-gray-500">Loading requests...</p>
      ) : !activeRequest ? (
        <div className="text-sm text-gray-500">
          No pending reschedule requests.
        </div>
      ) : (
        <>
          {requests.length > 1 && (
            <select
              className="w-full mb-3 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={activeRequest.id}
              onChange={(e) => setSelectedRequestId(e.target.value)}
            >
              {requests.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.event?.title || req.eventId} •{" "}
                  {formatRequestDate(req.createdAt)}
                </option>
              ))}
            </select>
          )}

          <p className="text-sm text-gray-500 mb-4">
            {requesterLabel} requested a reschedule for {eventLabel}.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Reason: {activeRequest.reason}
          </p>

          {hasProposedSlots ? (
            <div className="space-y-3">
              {proposedSlots.map((slot, index) => (
                <button
                  key={`${slot.start}-${slot.end}`}
                  onClick={() => setSelectedSlotIndex(index)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left
                    ${
                      selectedSlotIndex === index
                        ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }
                `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        selectedSlotIndex === index
                          ? "bg-teal-100 text-teal-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          selectedSlotIndex === index
                            ? "text-teal-900"
                            : "text-slate-700"
                        }`}
                      >
                        {formatSlot(slot.start, slot.end)}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Proposed slot
                      </p>
                    </div>
                  </div>

                  {selectedSlotIndex === index && (
                    <Check className="w-5 h-5 text-teal-600" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {activeRequest.useAutoSchedule
                ? "No proposed slots available. Auto-schedule will be attempted."
                : "No proposed slots available. Request needs new times."}
            </p>
          )}

          <div className="mt-6">
            <button
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {processing
                ? "Processing..."
                : hasProposedSlots
                  ? "Confirm New Time"
                  : "Auto Schedule"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
