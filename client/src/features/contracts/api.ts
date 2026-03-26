import { apiClient } from "../../shared/api/client";
import type { Contract, ContractSummary } from "./types";
import { API_CONFIG } from "@/constants";

export const contractsApi = {
  listContracts: (): Promise<ContractSummary[]> => {
    return apiClient.get("/contracts/list");
  },

  getContract: (id: string): Promise<Contract> => {
    return apiClient.get(`/contracts/${id}`);
  },

  initializeContract: (
    specId: string,
    freelancerId?: string,
  ): Promise<Contract> => {
    return apiClient.post(`/contracts/initialize`, { specId, freelancerId });
  },

  updateDraft: (
    id: string,
    payload: {
      title?: string;
      currency?: string;
      milestoneSnapshot?: Array<{
        contractMilestoneKey?: string;
        sourceSpecMilestoneId?: string | null;
        title: string;
        description?: string | null;
        amount: number;
        startDate?: string | null;
        dueDate?: string | null;
        sortOrder?: number | null;
        deliverableType?: string | null;
        retentionAmount?: number | null;
        acceptanceCriteria?: string[] | null;
      }>;
    },
  ): Promise<Contract> => {
    return apiClient.patch(`/contracts/${id}/draft`, payload);
  },

  sendDraft: (id: string): Promise<Contract> => {
    return apiClient.post(`/contracts/${id}/send`, {});
  },

  discardDraft: (
    id: string,
  ): Promise<{
    status: string;
    contractId: string;
  }> => {
    return apiClient.post(`/contracts/${id}/discard`, {});
  },

  signContract: (
    id: string,
    contentHash: string,
  ): Promise<{
    status: string;
    signaturesCount: number;
    requiredSignerCount: number;
    allRequiredSigned: boolean;
  }> => {
    return apiClient.post(`/contracts/sign/${id}`, { contentHash });
  },

  activateContract: (
    id: string,
  ): Promise<{
    status: string;
    alreadyActivated?: boolean;
    activatedAt?: string | null;
    clonedMilestones?: number;
    warning?: string;
  }> => {
    return apiClient.post(`/contracts/activate/${id}`, {});
  },

  createSignatureSession: (
    id: string,
    provider?: string,
  ): Promise<{
    contractId: string;
    provider: string;
    sessionId: string | null;
    status: string;
    callbackPath: string;
    contentHash?: string | null;
    verifiedAt?: string | null;
    certificateSerial?: string | null;
  }> => {
    return apiClient.post(`/contracts/${id}/signature-sessions`, {
      provider,
    });
  },

  downloadPdf: async (id: string): Promise<ArrayBuffer> => {
    return apiClient.get<ArrayBuffer>(`/contracts/${id}/pdf`, {
      responseType: "arraybuffer",
    });
  },

  downloadPdfUrl: (id: string) => {
    return `${API_CONFIG.BASE_URL}/contracts/${id}/pdf`;
  },
};
