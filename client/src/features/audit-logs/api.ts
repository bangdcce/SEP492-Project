import { apiClient } from "@/shared/api/client";
import type {
  AuditEventCategory,
  AuditLogEntry,
  AuditLogSeriesPoint,
  AuditLogSummary,
  AuditLogTimelineResponse,
  AuditSource,
  RiskLevel,
} from "./types";

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: RiskLevel;
  source?: AuditSource;
  eventCategory?: AuditEventCategory;
  statusCode?: number;
  errorOnly?: boolean;
  incidentOnly?: boolean;
  component?: string;
  fingerprint?: string;
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: AuditLogSummary;
  series: AuditLogSeriesPoint[];
}

const ENDPOINTS = {
  AUDIT_LOGS: "/audit-logs",
};

export const auditLogsApi = {
  getAll: (params?: GetAuditLogsParams) =>
    apiClient.get<AuditLogsResponse>(ENDPOINTS.AUDIT_LOGS, { params }),

  getById: (id: string) =>
    apiClient.get<AuditLogEntry>(`${ENDPOINTS.AUDIT_LOGS}/${id}`),

  getTimeline: (id: string) =>
    apiClient.get<AuditLogTimelineResponse>(
      `${ENDPOINTS.AUDIT_LOGS}/${id}/timeline`,
    ),

  export: async (format: "csv" | "xlsx", params?: GetAuditLogsParams) =>
    await apiClient.getResponse<Blob>(`${ENDPOINTS.AUDIT_LOGS}/export`, {
      params: {
        ...params,
        format,
      },
      responseType: "blob",
    }),
};
