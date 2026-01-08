import { apiClient } from "@/shared/api/client";
import type { AuditLogEntry } from "./types";

/**
 * API Query Parameters - khớp với GetAuditLogsDto trên server
 */
export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  userId?: number;
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: string;
}

/**
 * API Response structure từ server
 */
export interface AuditLogsResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Audit Logs API Endpoints
 */
const ENDPOINTS = {
  AUDIT_LOGS: "/audit-logs",
};

/**
 * Audit Logs API Service
 */
export const auditLogsApi = {
  /**
   * Lấy danh sách audit logs với phân trang và filters
   */
  getAll: (params?: GetAuditLogsParams) =>
    apiClient.get<AuditLogsResponse>(ENDPOINTS.AUDIT_LOGS, { params }),

  /**
   * Lấy một audit log theo ID
   */
  getById: (id: string) =>
    apiClient.get<AuditLogEntry>(`${ENDPOINTS.AUDIT_LOGS}/${id}`),

  /**
   * Export audit logs (nếu server có endpoint này)
   */
  export: (params?: GetAuditLogsParams) =>
    apiClient.get<Blob>(`${ENDPOINTS.AUDIT_LOGS}/export`, {
      params,
      responseType: "blob" as any,
    }),
};
