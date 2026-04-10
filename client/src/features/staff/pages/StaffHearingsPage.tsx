import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, Calendar, Clock, Video } from "lucide-react";
import { toast } from "sonner";
import { getMyHearings } from "@/features/hearings/api";
import type { DisputeHearingSummary } from "@/features/hearings/types";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import {
  getApiErrorDetails,
  isSchemaNotReadyErrorCode,
} from "@/shared/utils/apiError";
import { normalizeExternalMeetingLink } from "@/features/hearings/utils/externalMeetingLink";
import { resolveHearingLifecycle } from "@/features/hearings/utils/hearingLifecycle";
import { useStaffDashboardRealtime } from "@/features/staff/hooks/useStaffDashboardRealtime";

interface StaffHearingsPageProps {
  routeBase?: string;
  title?: string;
  description?: string;
}

const formatEnumLabel = (
  value?: string | null,
  fallback: string = "Not available",
) => {
  if (!value) return fallback;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatTierLabel = (value?: string | null) => {
  if (!value) return null;
  if (value.toUpperCase().startsWith("TIER_")) {
    return `Tier ${value.slice(5)}`;
  }
  return formatEnumLabel(value);
};

export const StaffHearingsPage = ({
  routeBase = "/staff",
  title = "My Hearings",
  description = "Track hearings you are moderating or participating in.",
}: StaffHearingsPageProps) => {
  const [hearings, setHearings] = useState<DisputeHearingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaErrorMessage, setSchemaErrorMessage] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();
  const schemaToastShownRef = useRef(false);

  const currentUser = useMemo(
    () => getStoredJson<{ id?: string }>(STORAGE_KEYS.USER),
    [],
  );
  const currentUserId = currentUser?.id;

  const loadHearings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyHearings({
        lifecycle: "all",
      });
      setHearings(data ?? []);
      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
    } catch (error) {
      const details = getApiErrorDetails(error, "Could not load hearings");
      console.error("Failed to load hearings:", error);
      if (isSchemaNotReadyErrorCode(details.code)) {
        setSchemaErrorMessage(details.message);
        if (!schemaToastShownRef.current) {
          toast.error(details.message);
          schemaToastShownRef.current = true;
        }
        return;
      }

      setSchemaErrorMessage(null);
      schemaToastShownRef.current = false;
      toast.error(details.code ? `[${details.code}] ${details.message}` : details.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHearings();
  }, [loadHearings]);

  useStaffDashboardRealtime({
    onHearingEnded: loadHearings,
    onHearingScheduled: loadHearings,
    onHearingRescheduled: loadHearings,
    onHearingStarted: loadHearings,
    onHearingPaused: loadHearings,
    onHearingResumed: loadHearings,
    onHearingInviteResponded: loadHearings,
    onHearingFollowUpScheduled: loadHearings,
    onVerdictIssued: loadHearings,
  });

  const liveHearings = useMemo(
    () =>
      hearings.filter(
        (hearing) =>
          resolveHearingLifecycle(hearing) !== "ARCHIVED" &&
          (hearing.status === "IN_PROGRESS" || hearing.status === "PAUSED"),
      ),
    [hearings],
  );
  const upcomingHearings = useMemo(
    () =>
      hearings.filter(
        (hearing) =>
          resolveHearingLifecycle(hearing) !== "ARCHIVED" &&
          hearing.status === "SCHEDULED",
      ),
    [hearings],
  );
  const staleHearings = useMemo(
    () =>
      hearings.filter(
        (hearing) =>
          hearing.status === "SCHEDULED" &&
          resolveHearingLifecycle(hearing) === "ARCHIVED",
      ),
    [hearings],
  );

  const formatSchedule = (hearing: DisputeHearingSummary) => {
    const start = new Date(hearing.scheduledAt);
    if (Number.isNaN(start.getTime())) return "Invalid schedule";
    const end = hearing.scheduledEndAt
      ? new Date(hearing.scheduledEndAt)
      : new Date(
          start.getTime() + (hearing.estimatedDurationMinutes ?? 60) * 60 * 1000,
        );
    return `${format(start, "MMM d, yyyy h:mm a")} - ${format(end, "h:mm a")}`;
  };

  const handleOpenDispute = (disputeId: string) => {
    if (routeBase === "/staff") {
      navigate(`/staff/caseload?disputeId=${disputeId}&tab=hearings`);
      return;
    }
    navigate(`${routeBase}/disputes/${disputeId}?tab=hearings`);
  };

  const handleOpenRoom = (hearingId: string) => {
    navigate(`${routeBase}/hearings/${hearingId}`);
  };

  const renderHearingCard = (hearing: DisputeHearingSummary) => {
    const externalMeetingHref = normalizeExternalMeetingLink(
      hearing.externalMeetingLink,
    );
    const isModerator = Boolean(
      currentUserId && hearing.moderatorId === currentUserId,
    );
    const moderatorParticipant = hearing.participants?.find(
      (participant) => participant.role === "MODERATOR",
    );
    const moderatorLabel = isModerator
      ? "You"
      : moderatorParticipant?.user?.fullName ||
        moderatorParticipant?.user?.email ||
        "Assigned moderator";
    const tierLabel = formatTierLabel(hearing.tier);

    return (
      <div
        key={hearing.id}
        className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {hearing.hearingNumber
                  ? `Hearing #${hearing.hearingNumber}`
                  : "Dispute hearing"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {hearing.dispute?.status
                  ? `Case status: ${formatEnumLabel(hearing.dispute.status)}`
                  : "Case status: Not available"}
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
                Moderator: {moderatorLabel}
              </span>
              {hearing.isChatRoomActive ? (
                <span className="text-emerald-600 font-medium">Live chat active</span>
              ) : (
                <span>Chat idle</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              {tierLabel ? (
                <span className="px-2 py-0.5 rounded-full text-xs border bg-slate-100 text-slate-700 border-slate-200">
                  {tierLabel}
                </span>
              ) : null}
              <span
                className={`px-2 py-0.5 rounded-full text-xs border ${
                  hearing.status === "IN_PROGRESS"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : hearing.status === "PAUSED"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {formatEnumLabel(hearing.status)}
              </span>
            </div>
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
              {externalMeetingHref ? (
                <a
                  href={externalMeetingHref}
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
      {schemaErrorMessage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Server schema is not ready</p>
          <p className="mt-1 text-xs text-amber-800">{schemaErrorMessage}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-gray-500">{description}</p>
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
          <p className="text-sm text-gray-500">No live or paused hearings.</p>
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

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Needs follow-up
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading hearings...</p>
        ) : staleHearings.length === 0 ? (
          <p className="text-sm text-gray-500">
            No stale hearings are waiting for manual review.
          </p>
        ) : (
          <div className="grid gap-3">{staleHearings.map(renderHearingCard)}</div>
        )}
      </div>
    </div>
  );
};
