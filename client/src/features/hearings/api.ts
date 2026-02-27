import { apiClient } from "@/shared/api/client";
import type {
  EndHearingInput,
  ExtendHearingInput,
  InviteSupportInput,
  RescheduleHearingInput,
  ScheduleHearingInput,
  DisputeHearingSummary,
  HearingScheduleResult,
  HearingStatus,
  SpeakerRole,
  HearingAttendanceSummary,
  HearingQuestionSummary,
  HearingStatementSummary,
  HearingTimelineEvent,
  SupportCandidate,
  HearingWorkspaceSummary,
  VerdictSummary,
  AppealInput,
  HearingVerdictInput,
  VerdictReadiness,
} from "./types";

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

const unwrapData = <T>(response: ApiEnvelope<T> | T): T => {
  if (
    response &&
    typeof response === "object" &&
    "data" in (response as ApiEnvelope<T>)
  ) {
    return ((response as ApiEnvelope<T>).data ?? response) as T;
  }
  return response as T;
};

export const scheduleHearing = async (
  input: ScheduleHearingInput,
): Promise<HearingScheduleResult> => {
  const response = await apiClient.post<ApiEnvelope<HearingScheduleResult>>(
    "/disputes/hearings/schedule",
    input,
  );
  return unwrapData<HearingScheduleResult>(response);
};

export const startHearing = async (hearingId: string) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/start`);
};

export const pauseHearing = async (hearingId: string, reason: string) => {
  return await apiClient.patch(`/disputes/hearings/${hearingId}/pause`, {
    reason,
  });
};

export const resumeHearing = async (hearingId: string) => {
  return await apiClient.patch(`/disputes/hearings/${hearingId}/resume`, {});
};

export const endHearing = async (
  hearingId: string,
  input: EndHearingInput,
) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/end`, {
    hearingId,
    summary: input.summary,
    findings: input.findings,
    pendingActions: input.pendingActions,
    forceEnd: input.forceEnd,
    noShowNote: input.noShowNote,
  });
};

export const rescheduleHearing = async (
  hearingId: string,
  input: RescheduleHearingInput,
): Promise<HearingScheduleResult> => {
  const response = await apiClient.post<ApiEnvelope<HearingScheduleResult>>(
    `/disputes/hearings/${hearingId}/reschedule`,
    {
      hearingId,
      scheduledAt: input.scheduledAt,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      agenda: input.agenda,
      requiredDocuments: input.requiredDocuments,
      externalMeetingLink: input.externalMeetingLink,
      isEmergency: input.isEmergency,
    },
  );
  return unwrapData<HearingScheduleResult>(response);
};

export const extendHearingDuration = async (
  hearingId: string,
  input: ExtendHearingInput,
) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/extend`, {
    hearingId,
    additionalMinutes: input.additionalMinutes,
    reason: input.reason,
  });
};

export const getHearingSupportCandidates = async (
  hearingId: string,
): Promise<SupportCandidate[]> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/support-candidates`,
  );
  const payload = (response as { data?: SupportCandidate[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const inviteSupportStaff = async (
  hearingId: string,
  input: InviteSupportInput,
) => {
  return await apiClient.post(
    `/disputes/hearings/${hearingId}/invite-support`,
    {
      hearingId,
      userId: input.userId,
      participantRole: input.participantRole,
      reason: input.reason,
    },
  );
};

export const getHearingsByDispute = async (
  disputeId: string,
): Promise<DisputeHearingSummary[]> => {
  const response = await apiClient.get(
    `/disputes/hearings/dispute/${disputeId}`,
  );
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
  const payload =
    (response as { data?: DisputeHearingSummary }).data ?? response;
  return payload as DisputeHearingSummary;
};

export const getHearingWorkspace = async (
  hearingId: string,
): Promise<HearingWorkspaceSummary> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/workspace`,
  );
  const payload =
    (response as { data?: HearingWorkspaceSummary }).data ?? response;
  return payload as HearingWorkspaceSummary;
};

export const updateSpeakerControl = async (
  hearingId: string,
  speakerRole: SpeakerRole,
) => {
  return await apiClient.patch(
    `/disputes/hearings/${hearingId}/speaker-control`,
    {
      hearingId,
      speakerRole,
    },
  );
};

export const openHearingEvidenceIntake = async (
  hearingId: string,
  reason: string,
) => {
  return await apiClient.post(
    `/disputes/hearings/${hearingId}/evidence-intake/open`,
    {
      reason,
    },
  );
};

export const closeHearingEvidenceIntake = async (hearingId: string) => {
  return await apiClient.post(
    `/disputes/hearings/${hearingId}/evidence-intake/close`,
    {},
  );
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
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/questions`,
  );
  const payload =
    (response as { data?: HearingQuestionSummary[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getHearingTimeline = async (
  hearingId: string,
): Promise<HearingTimelineEvent[]> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/timeline`,
  );
  const payload =
    (response as { data?: HearingTimelineEvent[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const getHearingAttendance = async (
  hearingId: string,
): Promise<HearingAttendanceSummary> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/attendance`,
  );
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

export const answerHearingQuestion = async (
  hearingId: string,
  questionId: string,
  answer: string,
) => {
  return await apiClient.patch(
    `/disputes/hearings/${hearingId}/questions/${questionId}/answer`,
    { answer },
  );
};

export const cancelHearingQuestion = async (
  hearingId: string,
  questionId: string,
) => {
  return await apiClient.patch(
    `/disputes/hearings/${hearingId}/questions/${questionId}/cancel`,
    {},
  );
};

export const transitionHearingPhase = async (
  hearingId: string,
  phase: string,
) => {
  return await apiClient.patch(`/disputes/hearings/${hearingId}/phase`, {
    hearingId,
    phase,
  });
};

export const submitHearingStatement = async (
  hearingId: string,
  input: {
    type: string;
    title?: string;
    content?: string;
    attachments?: string[];
    replyToStatementId?: string;
    draftId?: string;
    isDraft?: boolean;
  },
) => {
  return await apiClient.post(`/disputes/hearings/${hearingId}/statements`, {
    hearingId,
    ...input,
  });
};

export const dispatchHearingReminders = async (
  at?: string,
): Promise<{
  referenceAt?: string;
  dispatched?: number;
  skipped?: number;
  dispatches?: Array<{
    hearingId: string;
    userId: string;
    reminderType: string;
  }>;
}> => {
  const response = await apiClient.post<
    ApiEnvelope<{
      referenceAt?: string;
      dispatched?: number;
      skipped?: number;
      dispatches?: Array<{
        hearingId: string;
        userId: string;
        reminderType: string;
      }>;
    }>
  >("/disputes/hearings/reminders/dispatch", at ? { at } : {});
  return unwrapData(response);
};

/* ────────── Verdict API ────────── */

export const getDisputeVerdict = async (
  disputeId: string,
): Promise<VerdictSummary | null> => {
  const response = await apiClient.get<ApiEnvelope<VerdictSummary | null>>(
    `/disputes/${disputeId}/verdict`,
  );
  return unwrapData<VerdictSummary | null>(response);
};

export const submitAppeal = async (
  disputeId: string,
  input: AppealInput,
): Promise<void> => {
  await apiClient.post(`/disputes/${disputeId}/appeal`, input);
};

export const getHearingVerdictReadiness = async (
  hearingId: string,
): Promise<VerdictReadiness> => {
  const response = await apiClient.get<ApiEnvelope<VerdictReadiness>>(
    `/disputes/hearings/${hearingId}/verdict-readiness`,
  );
  return unwrapData<VerdictReadiness>(response);
};

export const issueHearingVerdict = async (
  hearingId: string,
  input: HearingVerdictInput,
): Promise<{
  verdict: VerdictSummary;
  hearing: DisputeHearingSummary;
  checklist: Record<string, boolean>;
  unmetChecklist: string[];
  unmetChecklistDetails: string[];
  context: VerdictReadiness["context"];
  transferSummary?: {
    distribution?: {
      amountToClient?: number;
      amountToFreelancer?: number;
    };
    transferCount?: number;
  };
}> => {
  const response = await apiClient.post<
    ApiEnvelope<{
      verdict: VerdictSummary;
      hearing: DisputeHearingSummary;
      checklist: Record<string, boolean>;
      unmetChecklist: string[];
      unmetChecklistDetails: string[];
      context: VerdictReadiness["context"];
      transferSummary?: {
        distribution?: {
          amountToClient?: number;
          amountToFreelancer?: number;
        };
        transferCount?: number;
      };
    }>
  >(`/disputes/hearings/${hearingId}/verdict`, input);
  return unwrapData(response);
};

/* ────────── Evidence Export API ────────── */

export const downloadEvidencePackage = async (
  disputeId: string,
): Promise<void> => {
  const response = await apiClient.get(
    `/disputes/${disputeId}/evidence/export`,
    {
      responseType: "blob",
    },
  );
  const blob = new Blob([response.data as BlobPart], {
    type: "application/zip",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const disposition = (response.headers as Record<string, string>)[
    "content-disposition"
  ];
  const match = disposition?.match(/filename="?([^"]+)"?/);
  a.download = match?.[1] || `evidence_${disputeId.slice(0, 8)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
