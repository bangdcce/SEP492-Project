
import { apiClient } from "@/shared/api/client";

export interface WizardOption {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

export interface WizardQuestion {
  id: string;
  code: string;
  label: string;
  helpText?: string;
  inputType: 'SELECT' | 'CHECKBOX' | 'TEXT' | 'RADIO';
  sortOrder: number;
  options: WizardOption[];
}

export interface CreateProjectRequestDto {
  title: string;
  description: string;
  budgetRange?: string;
  intendedTimeline?: string;
  techPreferences?: string;
  isDraft?: boolean;
  status?: string; // Allowing string to support new enum values
  answers: {
    questionId: string;
    optionId?: string;
    valueText?: string;
  }[];
}

export const wizardService = {
  getQuestions: async (): Promise<WizardQuestion[]> => {
    return await apiClient.get<WizardQuestion[]>("/wizard/questions");
  },

  submitRequest: async (data: CreateProjectRequestDto) => {
    return await apiClient.post("/project-requests", data);
  },
  
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return await apiClient.post("/project-requests/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  updateRequest: async (id: string, data: Partial<CreateProjectRequestDto>) => {
    return await apiClient.patch(`/project-requests/${id}`, data);
  },

  getDrafts: async () => {
    return await apiClient.get("/project-requests/drafts/mine");
  },

  getMatches: async (requestId: string) => {
    return await apiClient.get(`/project-requests/${requestId}/matches`);
  },

  getRequests: async () => {
    return await apiClient.get("/project-requests");
  },

  getRequestById: async (id: string) => {
    return await apiClient.get(`/project-requests/${id}`);
  },

  inviteBroker: async (requestId: string, brokerId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/invite`, { brokerId });
  },

  applyToRequest: async (requestId: string, coverLetter: string) => {
    // Note: This endpoint expects brokerId from token, so we only send coverLetter
    return await apiClient.post(`/project-requests/${requestId}/apply`, { coverLetter });
  },

  acceptBroker: async (requestId: string, brokerId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/accept-broker`, { brokerId });
  },

  approveSpecs: async (requestId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/approve-specs`, {});
  },

  convertToProject: async (requestId: string) => {
     return await apiClient.post(`/project-requests/${requestId}/convert`, {});
  },

  // ── AI Matching Engine ──
  getBrokerMatches: async (requestId: string, options?: { enableAi?: boolean; topN?: number }) => {
    const params = new URLSearchParams();
    params.set('role', 'BROKER');
    if (options?.enableAi !== undefined) params.set('enableAi', String(options.enableAi));
    if (options?.topN !== undefined) params.set('topN', String(options.topN));
    const qs = params.toString();
    return await apiClient.get(`/matching/${requestId}?${qs}`);
  },

  getBrokerMatchesQuick: async (requestId: string) => {
    return await apiClient.get(`/matching/${requestId}?role=BROKER&enableAi=true`);
  },

  getFreelancerMatches: async (requestId: string, options?: { enableAi?: boolean; topN?: number }) => {
    const params = new URLSearchParams();
    params.set('role', 'FREELANCER');
    if (options?.enableAi !== undefined) params.set('enableAi', String(options.enableAi));
    if (options?.topN !== undefined) params.set('topN', String(options.topN));
    const qs = params.toString();
    return await apiClient.get(`/matching/${requestId}?${qs}`);
  },

  getFreelancerMatchesQuick: async (requestId: string) => {
    return await apiClient.get(`/matching/${requestId}?role=FREELANCER&enableAi=true`);
  },
};

