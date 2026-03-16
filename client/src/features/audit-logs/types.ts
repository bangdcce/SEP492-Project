export type RiskLevel = "LOW" | "NORMAL" | "HIGH";

export type ActionType = string;

export interface AuditLogEntry {
  id: string;
  actor: {
    name: string;
    email: string;
    avatar?: string;
  };
  action: ActionType;
  entity: string;
  ipAddress: string;
  timestamp: string;
  riskLevel: RiskLevel;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  metadata?: {
    userAgent?: string;
    entityType?: string;
    entityId?: string;
    [key: string]: any;
  };
}

export interface AuditLogFilters {
  searchAction?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: RiskLevel | "ALL";
  entityId?: string;
  format?: "json" | "csv";
}
