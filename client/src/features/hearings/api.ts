import { apiClient } from "@/shared/api/client";
import {
  getFileNameFromDisposition,
  triggerBlobDownload,
} from "@/shared/utils/download";
import type {
  EndHearingInput,
  ExtendHearingInput,
  InviteSupportInput,
  RescheduleHearingInput,
  ScheduleHearingInput,
  DisputeHearingSummary,
  HearingScheduleResult,
  HearingLifecycle,
  HearingStatus,
  SpeakerRole,
  HearingAttendanceSummary,
  HearingStatementContentBlock,
  HearingQuestionSummary,
  HearingStatementSummary,
  HearingTimelineEvent,
  SupportCandidate,
  HearingWorkspaceSummary,
  VerdictSummary,
  AppealInput,
  AcceptVerdictInput,
  HearingVerdictInput,
  VerdictReadiness,
} from "./types";
import { coerceExternalMeetingLinkInput } from "./utils/externalMeetingLink";

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
    return (response as ApiEnvelope<T>).data as T;
  }
  return response as T;
};

export const scheduleHearing = async (
  input: ScheduleHearingInput,
): Promise<HearingScheduleResult> => {
  const response = await apiClient.post<ApiEnvelope<HearingScheduleResult>>(
    "/disputes/hearings/schedule",
    {
      ...input,
      externalMeetingLink: coerceExternalMeetingLinkInput(
        input.externalMeetingLink,
      ),
    },
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
      externalMeetingLink: coerceExternalMeetingLinkInput(
        input.externalMeetingLink,
      ),
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
  const payload = unwrapData<SupportCandidate[] | null>(
    response as ApiEnvelope<SupportCandidate[] | null>,
  );
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
  lifecycle?: Lowercase<HearingLifecycle> | "all",
): Promise<DisputeHearingSummary[]> => {
  const query = new URLSearchParams();
  if (lifecycle) {
    query.append("lifecycle", lifecycle);
  }
  const url = query.toString()
    ? `/disputes/hearings/dispute/${disputeId}?${query.toString()}`
    : `/disputes/hearings/dispute/${disputeId}`;
  const response = await apiClient.get(url);
  const payload = unwrapData<DisputeHearingSummary[] | null>(
    response as ApiEnvelope<DisputeHearingSummary[] | null>,
  );
  return Array.isArray(payload) ? payload : [];
};

export const getMyHearings = async (params?: {
  status?: HearingStatus[];
  from?: string;
  to?: string;
  lifecycle?: Lowercase<HearingLifecycle> | "all";
}): Promise<DisputeHearingSummary[]> => {
  const query = new URLSearchParams();
  if (params?.status && params.status.length > 0) {
    query.append("status", params.status.join(","));
  }
  if (params?.from) query.append("from", params.from);
  if (params?.to) query.append("to", params.to);
  if (params?.lifecycle) query.append("lifecycle", params.lifecycle);

  const url = query.toString()
    ? `/disputes/hearings/mine?${query.toString()}`
    : "/disputes/hearings/mine";
  const response = await apiClient.get(url);
  const payload = unwrapData<DisputeHearingSummary[] | null>(
    response as ApiEnvelope<DisputeHearingSummary[] | null>,
  );
  return Array.isArray(payload) ? payload : [];
};

export const getHearingById = async (
  hearingId: string,
): Promise<DisputeHearingSummary> => {
  const response = await apiClient.get(`/disputes/hearings/${hearingId}`);
  const payload = unwrapData<DisputeHearingSummary>(
    response as ApiEnvelope<DisputeHearingSummary>,
  );
  return payload as DisputeHearingSummary;
};

export const getHearingWorkspace = async (
  hearingId: string,
): Promise<HearingWorkspaceSummary> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/workspace`,
  );
  const payload = unwrapData<HearingWorkspaceSummary>(
    response as ApiEnvelope<HearingWorkspaceSummary>,
  );
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
  const payload = unwrapData<HearingStatementSummary[] | null>(
    response as ApiEnvelope<HearingStatementSummary[] | null>,
  );
  return Array.isArray(payload) ? payload : [];
};

export const getHearingQuestions = async (
  hearingId: string,
): Promise<HearingQuestionSummary[]> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/questions`,
  );
  const payload = unwrapData<HearingQuestionSummary[] | null>(
    response as ApiEnvelope<HearingQuestionSummary[] | null>,
  );
  return Array.isArray(payload) ? payload : [];
};

export const getHearingTimeline = async (
  hearingId: string,
): Promise<HearingTimelineEvent[]> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/timeline`,
  );
  const payload = unwrapData<HearingTimelineEvent[] | null>(
    response as ApiEnvelope<HearingTimelineEvent[] | null>,
  );
  return Array.isArray(payload) ? payload : [];
};

export const getHearingAttendance = async (
  hearingId: string,
): Promise<HearingAttendanceSummary> => {
  const response = await apiClient.get(
    `/disputes/hearings/${hearingId}/attendance`,
  );
  const payload = unwrapData<HearingAttendanceSummary>(
    response as ApiEnvelope<HearingAttendanceSummary>,
  );
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
    contentBlocks?: HearingStatementContentBlock[];
    citedEvidenceIds?: string[];
    platformDeclarationAccepted?: boolean;
    changeSummary?: string;
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

export const acceptDisputeVerdict = async (
  disputeId: string,
  input: AcceptVerdictInput,
): Promise<void> => {
  await apiClient.post(`/disputes/${disputeId}/verdict/accept`, input);
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
  const response = await apiClient.getResponse<Blob>(
    `/disputes/${disputeId}/evidence/export`,
    {
      responseType: "blob",
    },
  );
  const blob = new Blob([response.data as BlobPart], { type: "application/zip" });
  triggerBlobDownload(
    blob,
    getFileNameFromDisposition(
      response.headers["content-disposition"],
      `evidence_${disputeId.slice(0, 8)}.zip`,
    ),
  );
};
