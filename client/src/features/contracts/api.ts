import { apiClient } from '../../shared/api/client';
import type { Contract } from './types';
import { API_CONFIG } from '@/constants';

export const contractsApi = {
  getContract: (id: string): Promise<Contract> => {
    return apiClient.get(`/contracts/${id}`);
  },

  initializeContract: (specId: string): Promise<Contract> => {
    return apiClient.post(`/contracts/initialize/${specId}`, {});
  },

  signContract: (id: string, _password?: string): Promise<{ status: string }> => {
    // In real flow, we verify password hash. For now just send signature hash placeholder
    return apiClient.post(`/contracts/sign/${id}`, { signatureHash: 'client-side-hash' });
  },

  downloadPdfUrl: (id: string) => {
    return `${API_CONFIG.BASE_URL}/contracts/${id}/pdf`;
  },
};
