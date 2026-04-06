import { apiClient } from "@/shared/api/client";
import type {
  AdminReviewReport,
  PaginatedAdminReviewReports,
  ReviewReportStatus,
} from "../types";

export const getPendingReports = async (filters?: {
  page?: number;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  return apiClient.get<PaginatedAdminReviewReports>(
    `/reports${queryString ? `?${queryString}` : ""}`,
  );
};

export const getReportById = async (reportId: string) => {
  return apiClient.get<AdminReviewReport>(`/reports/${reportId}`);
};

export const resolveReport = async (
  reportId: string,
  input: {
    status: Extract<ReviewReportStatus, "RESOLVED" | "REJECTED">;
    adminNote?: string;
    deleteReview?: boolean;
  },
) => {
  return apiClient.patch<AdminReviewReport>(`/reports/${reportId}/resolve`, input);
};
