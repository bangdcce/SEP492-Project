export type DashboardRange = "7d" | "30d" | "90d";

export interface AdminMetricSummary {
  value: number;
  previous: number;
  delta: number;
  currency?: string | null;
}

export interface AdminTrendPoint {
  label: string;
  revenue: number;
  newUsers: number;
  completedProjects: number;
}

export interface AdminTeamMember {
  id: string;
  name: string;
  email: string;
  totalActions: number;
  highRiskActions: number;
  exports: number;
  approvals: number;
  userModeration: number;
  reviewAudit: number;
  other: number;
  lastActiveAt: string | null;
  isActive: boolean;
  score: number;
}

export interface StaffAnalyticsMember {
  id: string;
  name: string;
  email: string;
  resolvedCases: number;
  pendingCases: number;
  utilizationRate: number;
  currentUtilizationRate: number;
  appealRate: number;
  overturnRate: number;
  avgResolutionTimeHours: number;
  hearingsConducted: number;
  leaveMinutes: number;
  isOverloaded: boolean;
  isActive: boolean;
  lastActiveAt: string | null;
  score: number;
}

export interface AdminDashboardOverview {
  generatedAt: string;
  range: DashboardRange;
  summary: {
    revenue: AdminMetricSummary;
    newUsers: AdminMetricSummary;
    completedProjects: AdminMetricSummary;
    activeAdmins: AdminMetricSummary;
    activeStaff: AdminMetricSummary;
  };
  series: AdminTrendPoint[];
  adminTeam: {
    totalMembers: number;
    activeMembers: number;
    aggregate: {
      totalActions: number;
      highRiskActions: number;
      exports: number;
      approvals: number;
      userModeration: number;
      reviewAudit: number;
      other: number;
    };
    members: AdminTeamMember[];
  };
  staffTeam: {
    totalMembers: number;
    activeMembers: number;
    averages: {
      resolvedCases: number;
      pendingCases: number;
      utilizationRate: number;
      appealRate: number;
      overturnRate: number;
      avgResolutionTimeHours: number;
      hearingsConducted: number;
      leaveMinutes: number;
    };
    members: StaffAnalyticsMember[];
  };
  riskHighlights: {
    highRiskAdminActions: Array<{
      id: string;
      actorName: string;
      action: string;
      eventName: string;
      timestamp: string;
      requestId?: string | null;
      entity: string;
      riskLevel: string;
    }>;
    overloadedStaff: Array<{
      id: string;
      name: string;
      utilizationRate: number;
      pendingCases: number;
    }>;
    backlogPressure: {
      pendingCases: number;
      overloadedCount: number;
    };
  };
  criticalAlerts: Array<{
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SEVERE";
    source: string;
    title: string;
    summary: string;
    metricValue: number;
    thresholdLabel: string;
    actionUrl: string;
    reason: string;
  }>;
  systemIncidentHub: {
    summary: {
      activeCount: number;
      severeCount: number;
      criticalCount: number;
      affectedComponents: number;
      lastOccurredAt: string | null;
    };
    items: Array<{
      fingerprint: string;
      severity: "HIGH" | "CRITICAL" | "SEVERE";
      category:
        | "HTTP_5XX"
        | "SCHEDULER"
        | "INTEGRATION"
        | "WEBSOCKET"
        | "STORAGE"
        | "PAYMENT"
        | "EMAIL";
      component: string;
      operation: string;
      message: string;
      errorCode: string | null;
      firstSeenAt: string;
      lastSeenAt: string;
      occurrences: number;
      latestAuditLogId: string;
      actionUrl: string;
    }>;
  };
  riskMethodology: {
    generatedAt: string;
    scoringWeights: {
      workload: number;
      performance: number;
      fairness: number;
    };
    thresholds: Record<string, number>;
    activeSignals: Array<{
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SEVERE";
      source: string;
      title: string;
      metricValue: number;
      thresholdLabel: string;
      whyRanked: string;
    }>;
  };
}
