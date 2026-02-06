import { apiClient } from '../../shared/api/client';
import type {
  ProjectRequest,
  GetRequestsParams,
} from './types';

export const projectRequestsApi = {
  getAll: (params?: GetRequestsParams) => {
    return apiClient.get<ProjectRequest[]>('/project-requests', { params });
  },

  getById: (id: string) => {
    return apiClient.get<ProjectRequest>(`/project-requests/${id}`);
  },

  update: (id: string, data: any) => {
    return apiClient.patch<ProjectRequest>(`/project-requests/${id}`, data);
  },

  assignBroker: (id: string) => {
    return apiClient.patch<ProjectRequest>(
      `/project-requests/${id}/assign`
    );
  },

  applyToRequest: (id: string, coverLetter: string) => {
    return apiClient.post(
      `/project-requests/${id}/apply`,
      { coverLetter }
    );
  },

  rejectProposal: (proposalId: string) => {
    return apiClient.post(`/project-requests/proposals/${proposalId}/reject`);
  },

  cancelInvitation: (proposalId: string) => {
    return apiClient.post(`/project-requests/proposals/${proposalId}/cancel`);
  },
};
