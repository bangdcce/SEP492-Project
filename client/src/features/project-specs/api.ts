import { apiClient } from '../../shared/api/client';
import type { CreateProjectSpecDTO, ProjectSpec } from './types';

export const projectSpecsApi = {
  createSpec: (data: CreateProjectSpecDTO): Promise<ProjectSpec> => {
    return apiClient.post('/project-specs', data);
  },
  
  getSpec: (id: string): Promise<ProjectSpec> => {
    return apiClient.get(`/project-specs/${id}`);
  },
};
