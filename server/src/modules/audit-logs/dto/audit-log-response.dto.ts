/**
 * Response DTO for Audit Log - matches client's AuditLogEntry interface
 */
export class AuditLogResponseDto {
  id: string;
  actor: {
    name: string;
    email: string;
    avatar?: string;
  };
  action: string;
  entity: string;
  ipAddress: string;
  timestamp: string;
  riskLevel: 'LOW' | 'NORMAL' | 'HIGH';
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Paginated response for Audit Logs
 */
export class PaginatedAuditLogsResponseDto {
  data: AuditLogResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
