import { apiClient } from "@/shared/api/client";
import type {
  EndHearingInput,
  RescheduleHearingInput,
  ScheduleHearingInput,
  DisputeHearingSummary,
  HearingStatus,
  SpeakerRole,
  HearingAttendanceSummary,
  HearingQuestionSummary,
  HearingStatementSummary,
  HearingTimelineEvent,
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

export const getHearingsByDispute = async (
  disputeId: string,
): Promise<DisputeHearingSummary[]> => {
  const response = await apiClient.get(`/disputes/hearings/dispute/${disputeId}`);
  const payload =
    (response as { data?: DisputeHearingSummary[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getMyHearings = async (params?: {
  status?: HearingStatus[];
  from?: string;
  to?: string;
}): Promise<DisputeHearingSummary[]> => {
  const query = new URLSearchParams();
  if (params?.status && params.status.length > 0) {
    query.append("status", params.status.join(","));
  }
  if (params?.from) query.append("from", params.from);
  if (params?.to) query.append("to", params.to);

  const url = query.toString()
    ? `/disputes/hearings/mine?${query.toString()}`
    : "/disputes/hearings/mine";
  const response = await apiClient.get(url);
  const payload =
    (response as { data?: DisputeHearingSummary[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getHearingById = async (
  hearingId: string,
): Promise<DisputeHearingSummary> => {
  const response = await apiClient.get(`/disputes/hearings/${hearingId}`);
  const payload = (response as { data?: DisputeHearingSummary }).data ?? response;
  return payload as DisputeHearingSummary;
};

export const updateSpeakerControl = async (
  hearingId: string,
  speakerRole: SpeakerRole,
) => {
  return await apiClient.patch(`/disputes/hearings/${hearingId}/speaker-control`, {
    hearingId,
    speakerRole,
  });
};

export const getHearingStatements = async (
  hearingId: string,
  params?: { includeDrafts?: boolean },
): Promise<HearingStatementSummary[]> => {
  const query = new URLSearchParams();
  if (params?.includeDrafts) query.append("includeDrafts", "true");

  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/statements?${query.toString()}`,
  );
  const payload =
    (response as { data?: HearingStatementSummary[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getHearingQuestions = async (
  hearingId: string,
): Promise<HearingQuestionSummary[]> => {
  const response = await apiClient.get(`/disputes/hearings/${hearingId}/questions`);
  const payload =
    (response as { data?: HearingQuestionSummary[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getHearingTimeline = async (
  hearingId: string,
): Promise<HearingTimelineEvent[]> => {
  const response = await apiClient.get(`/disputes/hearings/${hearingId}/timeline`);
  const payload =
    (response as { data?: HearingTimelineEvent[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getHearingAttendance = async (
  hearingId: string,
): Promise<HearingAttendanceSummary> => {
  const response = await apiClient.get(`/disputes/hearings/${hearingId}/attendance`);
  const payload =
    (response as { data?: HearingAttendanceSummary }).data ?? response;
  return payload as HearingAttendanceSummary;
};

export const askHearingQuestion = async (
  hearingId: string,
  input: {
    targetUserId: string;
    question: string;
    deadlineMinutes?: number;
  },
) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/questions`, {
    hearingId,
    targetUserId: input.targetUserId,
    question: input.question,
    deadlineMinutes: input.deadlineMinutes,
  });
};
