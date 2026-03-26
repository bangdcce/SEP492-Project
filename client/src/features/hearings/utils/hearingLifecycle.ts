import { EventStatus } from "@/features/calendar/types";
import type {
  DisputeHearingSummary,
  HearingLifecycle,
  HearingStatus,
} from "@/features/hearings/types";

const ACTIVE_HEARING_STATUSES = new Set<HearingStatus>([
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
]);

const ACTIVE_EVENT_STATUSES = new Set<EventStatus>([
  EventStatus.PENDING_CONFIRMATION,
  EventStatus.SCHEDULED,
  EventStatus.IN_PROGRESS,
]);

export const resolveHearingLifecycle = (
  hearing: Pick<DisputeHearingSummary, "lifecycle" | "status" | "graceEndsAt">,
): HearingLifecycle => {
  if (
    hearing.status === "SCHEDULED" &&
    hearing.graceEndsAt &&
    !Number.isNaN(new Date(hearing.graceEndsAt).getTime()) &&
    Date.now() >= new Date(hearing.graceEndsAt).getTime()
  ) {
    return "ARCHIVED";
  }

  if (hearing.lifecycle) {
    return hearing.lifecycle;
  }

  return ACTIVE_HEARING_STATUSES.has(hearing.status) ? "ACTIVE" : "ARCHIVED";
};

export const splitHearingsByLifecycle = (hearings: DisputeHearingSummary[]) => {
  const active: DisputeHearingSummary[] = [];
  const archived: DisputeHearingSummary[] = [];

  hearings.forEach((hearing) => {
    if (resolveHearingLifecycle(hearing) === "ACTIVE") {
      active.push(hearing);
      return;
    }

    archived.push(hearing);
  });

  return { active, archived };
};

export const isActiveCalendarHearingStatus = (status: EventStatus) => {
  return ACTIVE_EVENT_STATUSES.has(status);
};

export const isArchivedCalendarHearingStatus = (status: EventStatus) => {
  return !isActiveCalendarHearingStatus(status);
};
