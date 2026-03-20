export type RiskLevel = "LOW" | "NORMAL" | "HIGH";
export type AuditSource = "SERVER" | "CLIENT";
export type AuditEventCategory =
  | "HTTP"
  | "UI_BREADCRUMB"
  | "DB_CHANGE"
  | "ERROR"
  | "AUTH"
  | "EXPORT";

export interface AuditLogEntry {
  id: string;
  actor: {
    id?: string;
    name: string;
    email: string;
    role?: string;
    avatar?: string;
  };
  action: string;
  entity: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  timestamp: string;
  riskLevel: RiskLevel;
  source: AuditSource;
  eventCategory: AuditEventCategory;
  eventName: string;
  route?: string | null;
  httpMethod?: string | null;
  statusCode?: number | null;
  requestId?: string | null;
  sessionId?: string | null;
  journeyStep?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  changedFields: Array<{
    path: string;
    before: unknown;
    after: unknown;
  }>;
  beforeData?: Record<string, any> | null;
  afterData?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

export interface AuditLogSummary {
  totalLogs: number;
  highRisk: number;
  errorCount: number;
  clientBreadcrumbs: number;
  uniqueActors: number;
  correlatedRequests: number;
}

export interface AuditLogSeriesPoint {
  label: string;
  total: number;
  errors: number;
  highRisk: number;
  breadcrumbs: number;
}

export interface AuditLogFilters {
  searchAction?: string;
  requestId?: string;
  sessionId?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: RiskLevel | "ALL";
  source?: AuditSource | "ALL";
  eventCategory?: AuditEventCategory | "ALL";
  errorOnly?: boolean;
}

export interface AuditLogTimelineResponse {
  anchor: AuditLogEntry;
  correlationType: "requestId" | "sessionId" | "actorId";
  total: number;
  data: AuditLogEntry[];
}
