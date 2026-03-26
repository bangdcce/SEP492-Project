import { apiClient } from "@/shared/api/client";

export interface WizardOption {
  id: number;
  value: string;
  label: string;
  sortOrder: number;
}

export interface WizardQuestion {
  id: number;
  code: string;
  label: string;
  helpText?: string;
  inputType: "SELECT" | "CHECKBOX" | "TEXT" | "RADIO";
  sortOrder: number;
  isActive?: boolean;
  options: WizardOption[];
}

export interface ProjectRequestAttachment {
  filename: string;
  url: string;
  mimetype?: string | null;
  size?: number | null;
  category?: "requirements" | "attachment";
}

export interface CreateProjectRequestDto {
  title: string;
  description: string;
  budgetRange?: string;
  intendedTimeline?: string;
  techPreferences?: string;
  status?: string;
  wizardProgressStep?: number;
  attachments?: ProjectRequestAttachment[];
  answers: {
    questionId: string;
    optionId?: string;
    valueText?: string;
  }[];
}

export interface UploadProjectRequestFilesResult {
  requirements: ProjectRequestAttachment[];
  attachments: ProjectRequestAttachment[];
}

export const wizardService = {
  getQuestions: async (): Promise<WizardQuestion[]> => {
    return await apiClient.get<WizardQuestion[]>("/wizard/questions");
  },

  submitRequest: async (data: CreateProjectRequestDto) => {
    return await apiClient.post("/project-requests", data);
  },

  uploadFiles: async (
    files: File[],
    category: "requirements" | "attachments" = "attachments",
  ): Promise<UploadProjectRequestFilesResult> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append(category === "requirements" ? "requirements" : "attachments", file);
    });
    return await apiClient.post("/project-requests/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  updateRequest: async (id: string, data: Partial<CreateProjectRequestDto>) => {
    return await apiClient.patch(`/project-requests/${id}`, data);
  },

  publishRequest: async (id: string) => {
    return await apiClient.post(`/project-requests/${id}/publish`, {});
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
    return await apiClient.post(`/project-requests/${requestId}/invite/broker`, { brokerId });
  },

  inviteFreelancer: async (requestId: string, freelancerId: string, message?: string) => {
    return await apiClient.post(`/project-requests/${requestId}/invite/freelancer`, {
      freelancerId,
      message,
    });
  },

  applyToRequest: async (requestId: string, coverLetter: string) => {
    return await apiClient.post(`/project-requests/${requestId}/apply`, { coverLetter });
  },

  acceptBroker: async (requestId: string, brokerId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/accept-broker`, { brokerId });
  },

  deleteRequest: async (id: string) => {
    return await apiClient.delete(`/project-requests/${id}`);
  },

  releaseBrokerSlot: async (requestId: string, proposalId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/release-broker-slot`, {
      proposalId,
    });
  },

  approveSpecs: async (requestId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/approve-specs`, {});
  },

  approveFreelancerInvite: async (requestId: string, proposalId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/approve-freelancer-invite`, {
      proposalId,
    });
  },

  rejectFreelancerInvite: async (requestId: string, proposalId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/reject-freelancer-invite`, {
      proposalId,
    });
  },

  convertToProject: async (requestId: string) => {
    return await apiClient.post(`/project-requests/${requestId}/convert`, {});
  },

  getBrokerMatches: async (requestId: string, options?: { enableAi?: boolean; topN?: number }) => {
    const params = new URLSearchParams();
    params.set("role", "BROKER");
    if (options?.enableAi !== undefined) params.set("enableAi", String(options.enableAi));
    if (options?.topN !== undefined) params.set("topN", String(options.topN));
    const qs = params.toString();
    return await apiClient.get(`/matching/${requestId}?${qs}`);
  },

  getBrokerMatchesQuick: async (requestId: string) => {
    return await apiClient.get(`/matching/${requestId}?role=BROKER&enableAi=false`);
  },

  getFreelancerMatches: async (
    requestId: string,
    options?: { enableAi?: boolean; topN?: number },
  ) => {
    const params = new URLSearchParams();
    params.set("role", "FREELANCER");
    if (options?.enableAi !== undefined) params.set("enableAi", String(options.enableAi));
    if (options?.topN !== undefined) params.set("topN", String(options.topN));
    const qs = params.toString();
    return await apiClient.get(`/matching/${requestId}?${qs}`);
  },

  getFreelancerMatchesQuick: async (requestId: string) => {
    return await apiClient.get(`/matching/${requestId}?role=FREELANCER&enableAi=false`);
  },

  // ========== ADMIN METHODS ==========

  // View all wizard questions (includes inactive)
  getAllQuestionsForAdmin: async (): Promise<WizardQuestion[]> => {
    return await apiClient.get<WizardQuestion[]>("/admin/wizard/questions");
  },

  // Create new wizard question
  createWizardQuestion: async (data: Partial<WizardQuestion>) => {
    return await apiClient.post("/admin/wizard/questions", data);
  },

  // View detail of a specific wizard question
  getQuestionDetailForAdmin: async (id: number): Promise<WizardQuestion> => {
    return await apiClient.get<WizardQuestion>(`/admin/wizard/questions/${id}`);
  },

  // Update wizard question
  updateWizardQuestion: async (id: number, data: Partial<WizardQuestion>) => {
    return await apiClient.put(`/admin/wizard/questions/${id}`, data);
  },

  // Delete wizard question
  deleteWizardQuestion: async (id: number) => {
    return await apiClient.delete(`/admin/wizard/questions/${id}`);
  },
};
