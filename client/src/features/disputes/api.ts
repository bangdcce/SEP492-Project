import { apiClient } from "@/shared/api/client";
import {
  cachedFetch,
  getCachedValue,
  invalidateCacheByPrefix,
  setCachedValue,
} from "@/shared/utils/requestCache";
import { STORAGE_KEYS } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";
import { getFileNameFromDisposition } from "@/shared/utils/download";
import type {
  DisputeActivity,
  DisputeEvidence,
  DisputeEvidenceQuota,
  DisputeFilters,
  InternalMember,
  DisputeNote,
  DisputeSummary,
  PaginatedDisputesResponse,
  DisputeComplexity,
  DisputeMessage,
  DisputeScheduleProposal,
  SchedulingWorklistResponse,
  DisputeDossier,
} from "./types/dispute.types";
import type { CreateDisputeDto } from "./types/dispute.dto";
import type { DisputePhase } from "../staff/types/staff.types";
import type {
  KanbanBoard,
  Milestone,
} from "@/features/project-workspace/types";

export interface ProjectBoard {
  tasks: KanbanBoard;
  milestones: Milestone[];
}

export interface DisputeAppealInput {
  reason: string;
  additionalEvidence?: string[];
}

export interface DisputeAppealVerdictInput {
  result: string;
  adminComment?: string;
  faultType: string;
  faultyParty: string;
  reasoning: {
    violatedPolicies: string[];
    factualFindings: string;
    legalAnalysis: string;
    conclusion: string;
    supportingEvidenceIds?: string[];
    policyReferences?: string[];
    legalReferences?: string[];
    contractReferences?: string[];
    evidenceReferences?: string[];
    analysis?: string;
    remedyRationale?: string;
    trustPenaltyRationale?: string;
  };
  amountToFreelancer: number;
  amountToClient: number;
  trustScorePenalty?: number;
  banUser?: boolean;
  banDurationDays?: number;
  warningMessage?: string;
  overridesVerdictId: string;
  overrideReason: string;
}

export interface DisputeRuleCatalogItem {
  code: string;
  title: string;
  category:
    | "CONTRACT_PERFORMANCE"
    | "DELIVERY_QUALITY"
    | "DEADLINE_DELAY"
    | "PAYMENT_ESCROW"
    | "SCOPE_CHANGE"
    | "COOPERATION_DUTY"
    | "FRAUD_MISREPRESENTATION"
    | "EVIDENCE_INTEGRITY"
    | "HEARING_CONDUCT";
  summary: string;
  legalBasis: string[];
  operationalGuidance: string[];
}

type CacheOptions = {
  preferCache?: boolean;
  ttlMs?: number;
};

const DISPUTES_LIST_TTL_MS = 30_000;
const DISPUTE_DETAIL_TTL_MS = 60_000;
const DISPUTE_ACTIVITY_TTL_MS = 30_000;
const DISPUTE_COMPLEXITY_TTL_MS = 5 * 60_000;

const getDisputesCacheScope = () => {
  const user = getStoredJson<{ id?: string; role?: string }>(STORAGE_KEYS.USER);
  if (!user?.id) {
    return "anonymous";
  }
  return `${user.role || "unknown"}:${user.id}`;
};

const buildQueryParams = (filters?: DisputeFilters) => {
  const params = new URLSearchParams();
  if (!filters) return params;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });

  return params;
};

export const getDisputes = async (
  filters?: DisputeFilters,
  options?: CacheOptions,
): Promise<PaginatedDisputesResponse> => {
  const params = buildQueryParams(filters);
  const key = `disputes:list:${getDisputesCacheScope()}:${params.toString() || "all"}`;
  const fetcher = () =>
    apiClient.get<PaginatedDisputesResponse>(`/disputes?${params.toString()}`);
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTES_LIST_TTL_MS,
  );
};

export const getQueueDisputes = async (
  filters?: DisputeFilters,
  options?: CacheOptions,
): Promise<PaginatedDisputesResponse> => {
  const params = buildQueryParams(filters);
  const key = `disputes:queue:${getDisputesCacheScope()}:${params.toString() || "all"}`;
  const fetcher = () =>
    apiClient.get<PaginatedDisputesResponse>(
      `/disputes/queue?${params.toString()}`,
    );
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTES_LIST_TTL_MS,
  );
};

export const getCaseloadDisputes = async (
  filters?: DisputeFilters,
  options?: CacheOptions,
): Promise<PaginatedDisputesResponse> => {
  const params = buildQueryParams(filters);
  const key = `disputes:caseload:${getDisputesCacheScope()}:${params.toString() || "all"}`;
  const fetcher = () =>
    apiClient.get<PaginatedDisputesResponse>(
      `/disputes/caseload?${params.toString()}`,
    );
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTES_LIST_TTL_MS,
  );
};

export const getMyDisputes = async (
  filters?: DisputeFilters,
  options?: CacheOptions,
): Promise<PaginatedDisputesResponse> => {
  const params = buildQueryParams(filters);
  const key = `disputes:mine:${getDisputesCacheScope()}:${params.toString() || "all"}`;
  const fetcher = () =>
    apiClient.get<PaginatedDisputesResponse>(
      `/disputes/my?${params.toString()}`,
    );
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTES_LIST_TTL_MS,
  );
};

export const getDisputeDetail = async (
  disputeId: string,
  options?: CacheOptions,
): Promise<DisputeSummary> => {
  const key = `disputes:detail:${disputeId}`;
  const fetcher = () => apiClient.get<DisputeSummary>(`/disputes/${disputeId}`);
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTE_DETAIL_TTL_MS,
  );
};

export const getDisputeRuleCatalog = async (): Promise<DisputeRuleCatalogItem[]> => {
  return await apiClient.get<DisputeRuleCatalogItem[]>("/disputes/rules/catalog");
};

export const createDispute = async (
  input: CreateDisputeDto,
): Promise<DisputeSummary> => {
  return await apiClient.post<DisputeSummary>("/disputes", input);
};

export const submitDisputeAppeal = async (
  disputeId: string,
  input: DisputeAppealInput,
): Promise<DisputeSummary> => {
  return await apiClient.post<DisputeSummary>(`/disputes/${disputeId}/appeal`, input);
};

export const resolveDisputeAppeal = async (
  disputeId: string,
  input: DisputeAppealVerdictInput,
): Promise<DisputeSummary> => {
  return await apiClient.patch<DisputeSummary>(`/disputes/${disputeId}/appeal/resolve`, input);
};

export const getProjectBoard = async (
  projectId: string,
): Promise<ProjectBoard> => {
  return await apiClient.get<ProjectBoard>(`/tasks/board/${projectId}`);
};

export const updateDisputePhase = async (
  disputeId: string,
  phase: DisputePhase,
) => {
  return await apiClient.patch(`/disputes/${disputeId}/phase`, { phase });
};

export const getDisputeActivities = async (
  disputeId: string,
  includeInternal?: boolean,
  options?: CacheOptions,
): Promise<DisputeActivity[]> => {
  const params = new URLSearchParams();
  if (includeInternal) params.append("includeInternal", "true");
  const key = `disputes:activities:${disputeId}:${params.toString()}`;
  const fetcher = () =>
    apiClient.get<DisputeActivity[]>(
      `/disputes/${disputeId}/activities?${params.toString()}`,
    );
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTE_ACTIVITY_TTL_MS,
  );
};

export const getDisputeNotes = async (
  disputeId: string,
  includeInternal?: boolean,
): Promise<DisputeNote[]> => {
  const params = new URLSearchParams();
  if (includeInternal) params.append("includeInternal", "true");
  return await apiClient.get<DisputeNote[]>(
    `/disputes/${disputeId}/notes?${params.toString()}`,
  );
};

export const getDisputeInternalMembers = async (
  disputeId: string,
): Promise<InternalMember[]> => {
  const response = await apiClient.get(`/disputes/${disputeId}/internal-members`);
  const payload = (response as { data?: InternalMember[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const addDisputeNote = async (
  disputeId: string,
  input: {
    content: string;
    isInternal?: boolean;
    isPinned?: boolean;
    noteType?: string;
    attachments?: string[];
  },
): Promise<DisputeNote> => {
  return await apiClient.post<DisputeNote>(
    `/disputes/${disputeId}/notes`,
    input,
  );
};

export const requestDisputeInfo = async (disputeId: string, reason: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/request-info`, {
    reason,
  });
};

export const provideDisputeInfo = async (
  disputeId: string,
  input: { message?: string; evidenceIds?: string[] },
) => {
  return await apiClient.patch(`/disputes/${disputeId}/provide-info`, input);
};

export const triageDispute = async (
  disputeId: string,
  input: {
    action: "ACCEPT" | "REJECT" | "REQUEST_INFO" | "COMPLETE_PREVIEW";
    reason?: string;
    deadlineAt?: string;
  },
) => {
  return await apiClient.patch(`/disputes/${disputeId}/triage`, input);
};

export const completeDisputePreview = async (
  disputeId: string,
  note?: string,
) => {
  return await apiClient.patch(`/disputes/${disputeId}/preview/complete`, {
    note,
  });
};

export const getDisputeDossier = async (disputeId: string): Promise<DisputeDossier> => {
  return await apiClient.get<DisputeDossier>(`/disputes/${disputeId}/dossier`);
};

export const exportDisputeDossier = async (
  disputeId: string,
): Promise<{ blob: Blob; fileName: string }> => {
  const response = await apiClient.getResponse<Blob>(`/disputes/${disputeId}/dossier/export`, {
    responseType: "blob" as const,
  });

  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(
      response.headers["content-disposition"],
      `dispute-${disputeId.slice(0, 8)}-dossier.zip`,
    ),
  };
};

export const getDisputeLedger = async (disputeId: string) => {
  return await apiClient.get(`/disputes/${disputeId}/ledger`);
};

export const getDisputeEscalationPolicy = async (disputeId: string) => {
  return await apiClient.get(`/disputes/${disputeId}/escalation-policy`);
};

export const getDisputeAutoScheduleOptions = async (
  disputeId: string,
  limit: number = 5,
) => {
  return await apiClient.get(
    `/disputes/${disputeId}/auto-schedule/options?limit=${Math.max(1, Math.floor(limit))}`,
  );
};

export const getSchedulingWorklist =
  async (): Promise<SchedulingWorklistResponse> => {
    return await apiClient.get<SchedulingWorklistResponse>(
      "/disputes/scheduling/worklist",
    );
  };

export const markDisputeViewed = async (disputeId: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/viewed`);
};

export const getSchedulingProposals = async (
  disputeId: string,
): Promise<DisputeScheduleProposal[]> => {
  const response = await apiClient.get(
    `/disputes/${disputeId}/scheduling/proposals`,
  );
  const payload =
    (
      response as {
        items?: DisputeScheduleProposal[];
        data?: { items?: DisputeScheduleProposal[] };
      }
    ).data ?? response;
  if (Array.isArray((payload as { items?: DisputeScheduleProposal[] }).items)) {
    return (payload as { items: DisputeScheduleProposal[] }).items;
  }
  return [];
};

export const createSchedulingProposal = async (
  disputeId: string,
  input: { startTime: string; endTime: string; note?: string },
): Promise<DisputeScheduleProposal> => {
  const response = await apiClient.post(
    `/disputes/${disputeId}/scheduling/proposals`,
    input,
  );
  const payload =
    (
      response as {
        proposal?: DisputeScheduleProposal;
        data?: { proposal?: DisputeScheduleProposal };
      }
    ).data ?? response;
  return (payload as { proposal: DisputeScheduleProposal }).proposal;
};

export const deleteSchedulingProposal = async (
  disputeId: string,
  proposalId: string,
) => {
  return await apiClient.delete(
    `/disputes/${disputeId}/scheduling/proposals/${proposalId}`,
  );
};

export const submitSchedulingProposals = async (
  disputeId: string,
): Promise<{ submitted: number }> => {
  const response = await apiClient.post(
    `/disputes/${disputeId}/scheduling/proposals/submit`,
    {},
  );
  const payload =
    (response as { data?: { submitted?: number } }).data ?? response;
  return { submitted: (payload as { submitted?: number }).submitted ?? 0 };
};

export const triggerDisputeAutoSchedule = async (
  disputeId: string,
  tuning?: {
    minNoticeMinutes?: number;
    lookaheadDays?: number;
    forceNearTermMinutes?: number;
    bypassReason?: string;
  },
) => {
  return await apiClient.post(`/disputes/${disputeId}/auto-schedule`, tuning);
};

export const cancelDispute = async (disputeId: string, reason?: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/cancel`, { reason });
};

export const getDisputeQueueCount = async (): Promise<{
  count: number;
  statuses: string[];
}> => {
  return await apiClient.get(`/disputes/queue/count`);
};

export const rejectDispute = async (disputeId: string, reason: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/reject`, { reason });
};

export const escalateDispute = async (disputeId: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/escalate`);
};

export const acceptDispute = async (disputeId: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/accept`);
};

export const getDisputeComplexity = async (
  disputeId: string,
  options?: CacheOptions,
): Promise<{ data: DisputeComplexity }> => {
  const key = `disputes:complexity:${disputeId}`;
  const fetcher = () =>
    apiClient.get<{ data: DisputeComplexity }>(
      `/staff/disputes/${disputeId}/complexity`,
    );
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? DISPUTE_COMPLEXITY_TTL_MS,
  );
};

export const getDisputeComplexities = async (
  disputeIds: string[],
  options?: CacheOptions,
): Promise<{
  data: Record<string, DisputeComplexity>;
  failedIds: string[];
}> => {
  const uniqueIds = Array.from(new Set(disputeIds)).filter(Boolean);
  if (!uniqueIds.length) return { data: {}, failedIds: [] };

  const preferCache = options?.preferCache !== false;
  const cached: Record<string, DisputeComplexity> = {};
  const missing: string[] = [];

  uniqueIds.forEach((id) => {
    if (preferCache) {
      const cachedValue = getCachedValue<DisputeComplexity>(
        `disputes:complexity:${id}`,
      );
      if (cachedValue) {
        cached[id] = cachedValue;
        return;
      }
    }
    missing.push(id);
  });

  if (!missing.length) {
    return { data: cached, failedIds: [] };
  }

  const response = await apiClient.post<{
    success: boolean;
    data: Record<string, DisputeComplexity>;
    errors?: Record<string, string>;
  }>(`/staff/disputes/complexity/batch`, { disputeIds: missing });

  const dataMap = (response?.data ?? {}) as Record<string, DisputeComplexity>;
  Object.entries(dataMap).forEach(([id, value]) => {
    if (value) {
      setCachedValue(
        `disputes:complexity:${id}`,
        value,
        options?.ttlMs ?? DISPUTE_COMPLEXITY_TTL_MS,
      );
    }
  });

  // Collect failed IDs: explicit errors + IDs not present in either data or errors
  const errorIds = Object.keys(response?.errors ?? {});
  const returnedIds = new Set([...Object.keys(dataMap), ...errorIds]);
  const orphanIds = missing.filter((id) => !returnedIds.has(id));
  const failedIds = [...errorIds, ...orphanIds];

  return { data: { ...cached, ...dataMap }, failedIds };
};

export const invalidateDisputesCache = () => {
  invalidateCacheByPrefix("disputes:list:");
  invalidateCacheByPrefix("disputes:queue:");
  invalidateCacheByPrefix("disputes:caseload:");
  invalidateCacheByPrefix("disputes:mine:");
};

export const invalidateDisputeDetailCache = (disputeId?: string) => {
  if (disputeId) {
    invalidateCacheByPrefix(`disputes:detail:${disputeId}`);
    invalidateCacheByPrefix(`disputes:activities:${disputeId}`);
    invalidateCacheByPrefix(`disputes:complexity:${disputeId}`);
    return;
  }
  invalidateCacheByPrefix("disputes:detail:");
  invalidateCacheByPrefix("disputes:activities:");
  invalidateCacheByPrefix("disputes:complexity:");
};

export const getDisputeEvidence = async (
  disputeId: string,
): Promise<DisputeEvidence[]> => {
  return await apiClient.get<DisputeEvidence[]>(
    `/disputes/${disputeId}/evidence`,
  );
};

export const getDisputeEvidenceQuota = async (
  disputeId: string,
): Promise<DisputeEvidenceQuota> => {
  return await apiClient.get<DisputeEvidenceQuota>(
    `/disputes/${disputeId}/evidence/quota`,
  );
};

export const uploadDisputeEvidence = async (
  disputeId: string,
  file: File,
  description?: string,
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (description) {
    formData.append("description", description);
  }

  return await apiClient.post(`/disputes/${disputeId}/evidence`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const flagDisputeEvidence = async (
  disputeId: string,
  evidenceId: string,
  flagReason: string,
) => {
  return await apiClient.post(
    `/disputes/${disputeId}/evidence/${evidenceId}/flag`,
    { flagReason },
  );
};

export const sendDisputeMessage = async (
  disputeId: string,
  input: {
    content: string;
    type?:
      | "TEXT"
      | "IMAGE"
      | "FILE"
      | "EVIDENCE_LINK"
      | "SYSTEM_LOG"
      | "SETTLEMENT_PROPOSAL"
      | "ADMIN_ANNOUNCEMENT";
    replyToMessageId?: string;
    relatedEvidenceId?: string;
    hearingId?: string;
    metadata?: Record<string, any>;
  },
) => {
  return await apiClient.post(`/disputes/${disputeId}/messages`, {
    disputeId,
    type: input.type ?? "TEXT",
    content: input.content,
    replyToMessageId: input.replyToMessageId,
    relatedEvidenceId: input.relatedEvidenceId,
    hearingId: input.hearingId,
    metadata: input.metadata,
  });
};

export const getDisputeMessages = async (
  disputeId: string,
  params?: { hearingId?: string; limit?: number; includeHidden?: boolean },
): Promise<DisputeMessage[]> => {
  const query = new URLSearchParams();
  if (params?.hearingId) query.append("hearingId", params.hearingId);
  if (params?.limit) query.append("limit", String(params.limit));
  if (params?.includeHidden) query.append("includeHidden", "true");

  const response = await apiClient.get(
    `/disputes/${disputeId}/messages?${query.toString()}`,
  );
  const payload = (response as { data?: DisputeMessage[] }).data ?? response;
  return Array.isArray(payload) ? payload : [];
};

export const hideDisputeMessage = async (
  messageId: string,
  hiddenReason: string,
) => {
  return await apiClient.patch(`/disputes/messages/${messageId}/hide`, {
    messageId,
    hiddenReason,
  });
};

export const unhideDisputeMessage = async (messageId: string) => {
  return await apiClient.patch(`/disputes/messages/${messageId}/unhide`);
};

export const resolveDispute = async (
  disputeId: string,
  input: {
    verdict: string;
    adminComment: string;
    faultType: string;
    faultyParty: string;
    reasoning: {
      violatedPolicies: string[];
      factualFindings: string;
      legalAnalysis: string;
      conclusion: string;
      supportingEvidenceIds?: string[];
    };
    splitRatioClient?: number;
    amountToFreelancer?: number;
    amountToClient?: number;
    trustScorePenalty?: number;
    banUser?: boolean;
    banDurationDays?: number;
    warningMessage?: string;
  },
) => {
  return await apiClient.post(`/disputes/${disputeId}/resolve`, input);
};
