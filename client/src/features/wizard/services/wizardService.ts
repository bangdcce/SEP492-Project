
import axiosClient from "@/lib/axiosClient";

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
  answers: {
    questionId: string;
    optionId?: string;
    valueText?: string;
  }[];
}

export const wizardService = {
  getQuestions: async (): Promise<WizardQuestion[]> => {
    const response = await axiosClient.get("/wizard/questions");
    return response.data;
  },

  submitRequest: async (data: CreateProjectRequestDto) => {
    const response = await axiosClient.post("/project-requests", data);
    return response.data;
  },
  
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axiosClient.post("/project-requests/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }
};
