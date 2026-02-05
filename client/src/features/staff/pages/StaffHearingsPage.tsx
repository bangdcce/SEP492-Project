import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, Clock, Video } from "lucide-react";
import { toast } from "sonner";
import { getMyHearings } from "@/features/hearings/api";
import type { DisputeHearingSummary } from "@/features/hearings/types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";

export const StaffHearingsPage = () => {
  const [hearings, setHearings] = useState<DisputeHearingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const currentUserId = currentUser?.id;

  const loadHearings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyHearings({
        status: ["IN_PROGRESS", "SCHEDULED"],
      });
      setHearings(data ?? []);
    } catch (error) {
      console.error("Failed to load hearings:", error);
      toast.error("Could not load hearings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHearings();
  }, [loadHearings]);

  const liveHearings = useMemo(
    () => hearings.filter((hearing) => hearing.status === "IN_PROGRESS"),
    [hearings],
  );
  const upcomingHearings = useMemo(
    () => hearings.filter((hearing) => hearing.status === "SCHEDULED"),
    [hearings],
  );

  const formatSchedule = (hearing: DisputeHearingSummary) => {
    const start = new Date(hearing.scheduledAt);
    if (Number.isNaN(start.getTime())) return "Invalid schedule";
    const duration = hearing.estimatedDurationMinutes ?? 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return `${format(start, "MMM d, yyyy h:mm a")} - ${format(end, "h:mm a")}`;
  };

  const handleOpenDispute = (disputeId: string) => {
    navigate(`/staff/caseload?disputeId=${disputeId}&tab=hearings`);
  };

  const handleOpenRoom = (hearingId: string) => {
    navigate(`/staff/hearings/${hearingId}`);
  };

  const renderHearingCard = (hearing: DisputeHearingSummary) => {
    const shortDisputeId = hearing.disputeId?.slice(0, 8) || "N/A";
    const isModerator = Boolean(
      currentUserId && hearing.moderatorId === currentUserId,
    );

    return (
      <div
        key={hearing.id}
        className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Dispute {shortDisputeId} - Hearing #{hearing.hearingNumber ?? "-"}
              </p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {formatSchedule(hearing)}
              </p>
            </div>

            {hearing.agenda ? (
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Agenda:</span> {hearing.agenda}
              </p>
            ) : null}

            <div className="text-xs text-gray-500 flex flex-wrap gap-3">
              <span>
                Moderator: {isModerator ? "You" : hearing.moderatorId?.slice(0, 8)}
              </span>
              {hearing.isChatRoomActive ? (
                <span className="text-emerald-600 font-medium">Live chat active</span>
              ) : (
                <span>Chat idle</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs border ${
                hearing.status === "IN_PROGRESS"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {hearing.status.replace("_", " ")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenRoom(hearing.id)}
                className="px-3 py-1.5 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-800"
              >
                Open room
              </button>
              <button
                onClick={() => handleOpenDispute(hearing.disputeId)}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Open dispute
              </button>
              {hearing.externalMeetingLink ? (
                <a
                  href={hearing.externalMeetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 inline-flex items-center gap-1"
                >
                  <Video className="w-3 h-3" />
                  Join room
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Hearings</h2>
          <p className="text-gray-500">
            Track hearings you are moderating or participating in.
          </p>
        </div>
        <button
          onClick={loadHearings}
          className="px-3 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Calendar className="w-4 h-4 text-teal-600" />
          Live hearings
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading hearings...</p>
        ) : liveHearings.length === 0 ? (
          <p className="text-sm text-gray-500">No hearings in progress.</p>
        ) : (
          <div className="grid gap-3">{liveHearings.map(renderHearingCard)}</div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Calendar className="w-4 h-4 text-teal-600" />
          Upcoming hearings
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading hearings...</p>
        ) : upcomingHearings.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming hearings scheduled.</p>
        ) : (
          <div className="grid gap-3">{upcomingHearings.map(renderHearingCard)}</div>
        )}
      </div>
    </div>
  );
};
