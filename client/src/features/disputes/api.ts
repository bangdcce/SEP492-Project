import { apiClient } from "@/shared/api/client";
import type {
  DisputeActivity,
  DisputeEvidence,
  DisputeEvidenceQuota,
  DisputeFilters,
  DisputeNote,
  DisputeSummary,
  PaginatedDisputesResponse,
  DisputeComplexity,
} from "./types/dispute.types";

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
): Promise<PaginatedDisputesResponse> => {
  const params = buildQueryParams(filters);
  return await apiClient.get<PaginatedDisputesResponse>(
    `/disputes?${params.toString()}`,
  );
};

export const getDisputeDetail = async (
  disputeId: string,
): Promise<DisputeSummary> => {
  return await apiClient.get<DisputeSummary>(`/disputes/${disputeId}`);
};

export const getDisputeActivities = async (
  disputeId: string,
  includeInternal?: boolean,
): Promise<DisputeActivity[]> => {
  const params = new URLSearchParams();
  if (includeInternal) params.append("includeInternal", "true");
  return await apiClient.get<DisputeActivity[]>(
    `/disputes/${disputeId}/activities?${params.toString()}`,
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
  return await apiClient.post<DisputeNote>(`/disputes/${disputeId}/notes`, input);
};

export const requestDisputeInfo = async (disputeId: string, reason: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/request-info`, { reason });
};

export const rejectDispute = async (disputeId: string, reason: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/reject`, { reason });
};

export const escalateDispute = async (disputeId: string) => {
  return await apiClient.patch(`/disputes/${disputeId}/escalate`);
};

export const getDisputeComplexity = async (
  disputeId: string,
): Promise<{ data: DisputeComplexity }> => {
  return await apiClient.get<{ data: DisputeComplexity }>(
    `/staff/disputes/${disputeId}/complexity`,
  );
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
    type?: "TEXT" | "IMAGE" | "FILE" | "EVIDENCE_LINK" | "SYSTEM_LOG" | "SETTLEMENT_PROPOSAL" | "ADMIN_ANNOUNCEMENT";
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
