export type RiskLevel = "LOW" | "NORMAL" | "HIGH";

export type ActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "ACCESS"
  | "EXPORT";

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
  metadata?: Record<string, any>;
}

export interface AuditLogFilters {
  searchAction?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: RiskLevel | "ALL";
}
