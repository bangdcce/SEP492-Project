import { apiClient } from "@/shared/api/client";

export type StaffApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StaffApplicationUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: string;
  isVerified: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  domains?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  skills?: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
  }>;
}

export interface StaffApplicationRecord {
  id: string | null;
  status: StaffApplicationStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    id: string;
    email: string;
    fullName: string;
  } | null;
  user: StaffApplicationUser | null;
}

export interface StaffApplicationListResponse {
  items: StaffApplicationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getMyStaffApplication = async (): Promise<StaffApplicationRecord> => {
  return apiClient.get<StaffApplicationRecord>("/staff-applications/me");
};

export const listStaffApplications = async (params?: {
  status?: StaffApplicationStatus | "" | "ALL";
  search?: string;
  page?: number;
  limit?: number;
}): Promise<StaffApplicationListResponse> => {
  const query = new URLSearchParams();
  const normalizedStatus =
    params?.status && params.status !== "ALL" ? params.status : undefined;
  const normalizedSearch = params?.search?.trim();

  if (normalizedStatus) {
    query.set("status", normalizedStatus);
  }
  if (normalizedSearch) {
    query.set("search", normalizedSearch);
  }
  if (params?.page) {
    query.set("page", `${params.page}`);
  }
  if (params?.limit) {
    query.set("limit", `${params.limit}`);
  }

  const queryString = query.toString();

  return apiClient.get<StaffApplicationListResponse>(
    queryString ? `/staff-applications?${queryString}` : "/staff-applications",
  );
};

export const getStaffApplicationById = async (
  id: string,
): Promise<StaffApplicationRecord> => {
  return apiClient.get<StaffApplicationRecord>(`/staff-applications/${id}`);
};

export const approveStaffApplication = async (
  id: string,
): Promise<StaffApplicationRecord> => {
  return apiClient.patch<StaffApplicationRecord>(`/staff-applications/${id}/approve`);
};

export const rejectStaffApplication = async (
  id: string,
  rejectionReason: string,
): Promise<StaffApplicationRecord> => {
  return apiClient.patch<StaffApplicationRecord>(`/staff-applications/${id}/reject`, {
    rejectionReason,
  });
};
