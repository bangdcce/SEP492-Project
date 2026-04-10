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

  createCommercialChangeRequest: (
    id: string,
    payload: {
      proposedBudget: number;
      proposedTimeline?: string;
      proposedClientFeatures?: Array<{
        title: string;
        description: string;
        priority?: "MUST_HAVE" | "SHOULD_HAVE" | "NICE_TO_HAVE" | null;
      }>;
      reason: string;
      parentSpecId?: string;
    },
  ) => {
    return apiClient.post<ProjectRequest>(
      `/project-requests/${id}/commercial-change-requests`,
      payload,
    );
  },

  respondCommercialChangeRequest: (
    id: string,
    changeRequestId: string,
    payload: {
      action: "APPROVE" | "REJECT";
      note?: string;
      acknowledgeOutOfRangeBudgetWarning?: boolean;
    },
  ) => {
    return apiClient.post<ProjectRequest>(
      `/project-requests/${id}/commercial-change-requests/${changeRequestId}/respond`,
      payload,
    );
  },
};
