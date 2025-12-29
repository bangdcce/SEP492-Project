import { apiClient } from '../../shared/api/client';
import type {
  ProjectRequest,
  GetRequestsParams,
  AssignBrokerPayload,
} from './types';

export const projectRequestsApi = {
  getAll: (params?: GetRequestsParams) => {
    return apiClient.get<ProjectRequest[]>('/project-requests', { params });
  },

  assignBroker: (id: string, payload: AssignBrokerPayload) => {
    return apiClient.patch<ProjectRequest>(
      `/project-requests/${id}/assign`,
      payload
    );
  },
};
