/**
 * Audit Logs Feature Types
 */

export interface AuditLog {
  id: number;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  ipAddress?: string;
  userAgent?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  createdAt: string;
  actor?: {
    id: number;
    email: string;
    fullName: string;
    role: string;
  };
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: number;
  entityType?: string;
  action?: string;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
