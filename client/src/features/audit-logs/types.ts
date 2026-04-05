export type RiskLevel = "LOW" | "NORMAL" | "HIGH";
export type AuditSource = "SERVER" | "CLIENT";
export type AuditEventCategory =
  | "HTTP"
  | "UI_BREADCRUMB"
  | "DB_CHANGE"
  | "ERROR"
  | "AUTH"
  | "EXPORT";
export type AuditOutcome = "SUCCESS" | "FAILURE";
export type AuditIncidentSeverity = "HIGH" | "CRITICAL" | "SEVERE";
export type AuditIncidentCategory =
  | "HTTP_5XX"
  | "SCHEDULER"
  | "INTEGRATION"
  | "WEBSOCKET"
  | "STORAGE"
  | "PAYMENT"
  | "EMAIL";

export interface AuditTargetContext {
  type: string;
  id: string;
  label?: string;
}

export interface AuditIncidentContext {
  scope: "SYSTEM";
  severity: AuditIncidentSeverity;
  category: AuditIncidentCategory;
  component: string;
  operation: string;
  fingerprint: string;
}

export interface AuditEntryMetadata {
  actorType?: string;
  module?: string;
  operation?: string;
  outcome?: AuditOutcome;
  summary?: string;
  target?: AuditTargetContext;
  context?: Record<string, unknown>;
  incident?: AuditIncidentContext;
  securityAnalysis?: {
    flags: string[];
    riskLevel: RiskLevel;
    baseRiskLevel: RiskLevel;
    timestamp: string;
  };
  userAgent?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
}

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
  metadata?: AuditEntryMetadata;
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
  incidentOnly?: boolean;
  component?: string;
  fingerprint?: string;
}

export interface AuditLogTimelineResponse {
  anchor: AuditLogEntry;
  correlationType: "requestId" | "sessionId" | "actorId";
  total: number;
  data: AuditLogEntry[];
}
