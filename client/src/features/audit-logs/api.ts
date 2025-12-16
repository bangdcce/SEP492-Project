import { apiClient } from "@/shared/api/client";
import type { AuditLog, AuditLogFilters, AuditLogListResponse } from "./types";

/**
 * Audit Logs API Endpoints
 */
const ENDPOINTS = {
  BASE: "/audit-logs",
  BY_ID: (id: number) => `/audit-logs/${id}`,
};

/**
 * Audit Logs API Service
 * All methods support AbortSignal for cancellation
 */
export const auditLogsApi = {
  getAll: (filters?: AuditLogFilters, signal?: AbortSignal) =>
    apiClient.get<AuditLogListResponse>(ENDPOINTS.BASE, {
      params: filters,
      signal,
    }),

  getById: (id: number, signal?: AbortSignal) =>
    apiClient.get<AuditLog>(ENDPOINTS.BY_ID(id), { signal }),
};
