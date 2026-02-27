import { apiClient } from '../../shared/api/client';
import type {
  CreateClientSpecDTO,
  CreateProjectSpecDTO,
  ProjectSpec,
} from './types';

export interface SpecMutationResponse {
  spec: ProjectSpec;
  warnings: string[];
}

export const projectSpecsApi = {
  // ── Phase 1: Client Spec ────────────────────────────────────────────────

  createClientSpec: (data: CreateClientSpecDTO): Promise<SpecMutationResponse> => {
    return apiClient.post('/project-specs/client-spec', data);
  },

  updateClientSpec: (specId: string, data: CreateClientSpecDTO): Promise<SpecMutationResponse> => {
    return apiClient.patch(`/project-specs/${specId}/client-spec`, data);
  },

  submitForClientReview: (specId: string): Promise<ProjectSpec> => {
    return apiClient.post(`/project-specs/${specId}/submit-for-client-review`);
  },

  clientReviewSpec: (
    specId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<ProjectSpec> => {
    return apiClient.post(`/project-specs/${specId}/client-review`, {
      action,
      reason,
    });
  },

  getClientSpec: (requestId: string): Promise<ProjectSpec> => {
    return apiClient.get(`/project-specs/client-spec/${requestId}`);
  },

  getPendingClientReview: (): Promise<ProjectSpec[]> => {
    return apiClient.get('/project-specs/client-review');
  },

  // ── Phase 2: Full Spec ──────────────────────────────────────────────────

  createFullSpec: (
    data: CreateProjectSpecDTO,
  ): Promise<SpecMutationResponse> => {
    return apiClient.post('/project-specs/full-spec', data);
  },

  updateFullSpec: (
    specId: string,
    data: CreateProjectSpecDTO,
  ): Promise<SpecMutationResponse> => {
    return apiClient.patch(`/project-specs/${specId}/full-spec`, data);
  },

  submitForFinalReview: (specId: string): Promise<ProjectSpec> => {
    return apiClient.post(`/project-specs/${specId}/submit-for-final-review`);
  },

  signSpec: (specId: string): Promise<ProjectSpec> => {
    return apiClient.post(`/project-specs/${specId}/sign`);
  },

  getFullSpec: (parentSpecId: string): Promise<ProjectSpec> => {
    return apiClient.get(`/project-specs/full-spec/${parentSpecId}`);
  },

  getSpecsInFinalReview: (): Promise<ProjectSpec[]> => {
    return apiClient.get('/project-specs/final-review');
  },

  // ── Shared ──────────────────────────────────────────────────────────────

  getSpec: (id: string): Promise<ProjectSpec> => {
    return apiClient.get(`/project-specs/${id}`);
  },

  getSpecsByRequest: (requestId: string): Promise<ProjectSpec[]> => {
    return apiClient.get(`/project-specs/by-request/${requestId}`);
  },

  getPendingSpecs: (): Promise<ProjectSpec[]> => {
    return apiClient.get('/project-specs/pending');
  },

  /** Staff audit (legacy) */
  auditSpec: (
    id: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<ProjectSpec> => {
    return apiClient.post(`/project-specs/${id}/audit`, { action, reason });
  },

  /** Legacy: create full spec directly */
  createSpec: (data: CreateProjectSpecDTO): Promise<SpecMutationResponse> => {
    return apiClient.post('/project-specs', data);
  },
};
