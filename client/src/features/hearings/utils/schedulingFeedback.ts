type SchedulingMode = "schedule" | "reschedule";

type SchedulingErrorLike = {
  code?: string;
  message: string;
};

export const HEARING_RESCHEDULE_FREEZE_HOURS = 24;

export const getSchedulingErrorMessage = (
  details: SchedulingErrorLike,
  mode: SchedulingMode,
) => {
  const message = details.message || "Unexpected scheduling error.";
  const normalized = message.toLowerCase();

  if (
    details.code === "HEARING_RESCHEDULE_FROZEN" ||
    normalized.includes("locked within 24 hours") ||
    normalized.includes("too close to the scheduled time to reschedule")
  ) {
    return `Rescheduling is locked within ${HEARING_RESCHEDULE_FREEZE_HOURS} hours of the hearing start. Use the emergency path only for true exceptions.`;
  }

  if (
    normalized.includes(
      "externalmeetinglink must be a valid url or supported google meet code",
    ) ||
    normalized.includes("invalid external meeting link") ||
    normalized.includes("google meet code")
  ) {
    return "Manual meeting link must be a full URL. If you use Google Meet, it must use a real code like abc-defg-hij.";
  }

  if (normalized.includes("hearing schedule conflicts detected")) {
    return "The proposed slot conflicts with participant availability or existing bookings. Choose another time or use auto-schedule.";
  }

  if (normalized.includes("invalid scheduledat timestamp")) {
    return "Pick a valid date and time before submitting.";
  }

  if (normalized.includes("reschedule limit reached")) {
    return "This hearing has already reached the reschedule limit. Use manual intervention instead of another change request.";
  }

  if (normalized.includes("only the assigned moderator or admin can reschedule")) {
    return "Only the assigned moderator or an admin can reschedule this hearing.";
  }

  if (normalized.includes("hearings require at least 24 hours notice")) {
    return "New hearings need at least 24 hours of notice unless you mark the request as an emergency.";
  }

  if (normalized.includes("emergency hearings require at least 1 hour notice")) {
    return "Emergency hearings still require at least 1 hour of notice.";
  }

  return mode === "reschedule"
    ? `Could not reschedule hearing. ${message}`
    : `Could not schedule hearing. ${message}`;
};
