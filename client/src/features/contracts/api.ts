import { apiClient } from '../../shared/api/client';
import type { Contract, ContractSummary } from './types';
import { API_CONFIG } from '@/constants';

const buildSignatureHash = async (contractId: string, confirmationText?: string) => {
  const seed = `${contractId}:${Date.now()}:${confirmationText || 'acknowledged'}`;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(seed),
    );
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return `${contractId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const contractsApi = {
  listContracts: (): Promise<ContractSummary[]> => {
    return apiClient.get('/contracts/list');
  },

  getContract: (id: string): Promise<Contract> => {
    return apiClient.get(`/contracts/${id}`);
  },

  initializeContract: (specId: string): Promise<Contract> => {
    return apiClient.post(`/contracts/initialize/${specId}`, {});
  },

  signContract: async (
    id: string,
    confirmationText?: string,
  ): Promise<{
    status: string;
    signaturesCount: number;
    requiredSignerCount: number;
    allRequiredSigned: boolean;
  }> => {
    const signatureHash = await buildSignatureHash(id, confirmationText);
    return apiClient.post(`/contracts/sign/${id}`, { signatureHash });
  },

  activateContract: (id: string): Promise<{
    status: string;
    alreadyActivated?: boolean;
    activatedAt?: string | null;
    clonedMilestones?: number;
    warning?: string;
  }> => {
    return apiClient.post(`/contracts/activate/${id}`, {});
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
