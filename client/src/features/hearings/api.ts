import { apiClient } from "@/shared/api/client";
import type {
  EndHearingInput,
  RescheduleHearingInput,
  ScheduleHearingInput,
} from "./types";

export const scheduleHearing = async (input: ScheduleHearingInput) => {
  return await apiClient.post("/disputes/hearings/schedule", input);
};

export const startHearing = async (hearingId: string) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/start`);
};

export const endHearing = async (hearingId: string, input?: EndHearingInput) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/end`, {
    hearingId,
    summary: input?.summary,
    findings: input?.findings,
    pendingActions: input?.pendingActions,
    forceEnd: input?.forceEnd,
  });
};

export const rescheduleHearing = async (
  hearingId: string,
  input: RescheduleHearingInput,
) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/reschedule`, {
    hearingId,
    scheduledAt: input.scheduledAt,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    agenda: input.agenda,
    requiredDocuments: input.requiredDocuments,
    externalMeetingLink: input.externalMeetingLink,
    isEmergency: input.isEmergency,
  });
};
