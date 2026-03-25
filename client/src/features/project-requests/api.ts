import { apiClient } from '../../shared/api/client';
import type {
  ProjectRequest,
  GetRequestsParams,
  FreelancerRequestAccessItem,
} from './types';

export const projectRequestsApi = {
  getAll: (params?: GetRequestsParams) => {
    return apiClient.get<ProjectRequest[]>('/project-requests', { params });
  },

  getById: (id: string) => {
    return apiClient.get<ProjectRequest>(`/project-requests/${id}`);
  },

  getFreelancerRequestAccessList: () => {
    return apiClient.get<FreelancerRequestAccessItem[]>('/project-requests/freelancer/requests/my');
  },

  applyToRequest: (id: string, coverLetter: string) => {
    return apiClient.post(
      `/project-requests/${id}/apply`,
      { coverLetter }
    );
  },
};
