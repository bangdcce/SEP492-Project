
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
    formData.append("attachments", file);
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
     const response = await apiClient.post(`/project-requests/${requestId}/convert`, {});
     return response.data;
  },

  rejectProposal: async (proposalId: string) => {
    const response = await apiClient.post(`/project-requests/proposals/${proposalId}/reject`);
    return response.data;
  },

  cancelInvitation: async (proposalId: string) => {
    const response = await apiClient.post(`/project-requests/proposals/${proposalId}/cancel`);
    return response.data;
  },

  rejectAllProposals: async (requestId: string) => {
    const response = await apiClient.post(`/project-requests/${requestId}/reject-all-proposals`);
    return response.data;
  },
};
