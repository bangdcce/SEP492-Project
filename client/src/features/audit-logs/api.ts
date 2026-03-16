import { apiClient } from "@/shared/api/client";
import { getFileNameFromDisposition } from "@/shared/utils/download";
import type { AuditLogEntry } from "./types";

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: string;
  format?: "json" | "csv";
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ENDPOINTS = {
  AUDIT_LOGS: "/audit-logs",
} as const;

export const auditLogsApi = {
  getAll: (params?: GetAuditLogsParams) =>
    apiClient.get<AuditLogsResponse>(ENDPOINTS.AUDIT_LOGS, { params }),

  getById: (id: string) =>
    apiClient.get<AuditLogEntry>(`${ENDPOINTS.AUDIT_LOGS}/${id}`),

  export: async (params?: GetAuditLogsParams) => {
    const response = await apiClient.getResponse<Blob>(`${ENDPOINTS.AUDIT_LOGS}/export`, {
      params,
      responseType: "blob" as const,
    });

    return {
      blob: response.data,
      fileName: getFileNameFromDisposition(
        response.headers["content-disposition"],
        `audit-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.${params?.format === "csv" ? "csv" : "json"}`,
      ),
    };
  },
};
