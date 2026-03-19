export enum UserRole {
  ADMIN = "ADMIN",
  STAFF = "STAFF",
  BROKER = "BROKER",
  CLIENT = "CLIENT",
  FREELANCER = "FREELANCER",
}

export enum BadgeType {
  NEW = "NEW",
  VERIFIED = "VERIFIED",
  TRUSTED = "TRUSTED",
  WARNING = "WARNING",
  NORMAL = "NORMAL",
}

export enum DisputeStatus {
  OPEN = "OPEN",
  TRIAGE_PENDING = "TRIAGE_PENDING",
  PREVIEW = "PREVIEW",
  PENDING_REVIEW = "PENDING_REVIEW",
  INFO_REQUESTED = "INFO_REQUESTED",
  IN_MEDIATION = "IN_MEDIATION",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
  CANCELED = "CANCELED",
  REJECTION_APPEALED = "REJECTION_APPEALED",
  APPEALED = "APPEALED",
}

export enum DisputeResult {
  PENDING = "PENDING",
  WIN_CLIENT = "WIN_CLIENT",
  WIN_FREELANCER = "WIN_FREELANCER",
  SPLIT = "SPLIT",
}

export enum DisputeCategory {
  QUALITY = "QUALITY",
  DEADLINE = "DEADLINE",
  PAYMENT = "PAYMENT",
  COMMUNICATION = "COMMUNICATION",
  SCOPE_CHANGE = "SCOPE_CHANGE",
  FRAUD = "FRAUD",
  CONTRACT = "CONTRACT",
  OTHER = "OTHER",
}

export enum DisputePriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum DisputeType {
  CLIENT_VS_FREELANCER = "CLIENT_VS_FREELANCER",
  CLIENT_VS_BROKER = "CLIENT_VS_BROKER",
  FREELANCER_VS_CLIENT = "FREELANCER_VS_CLIENT",
  FREELANCER_VS_BROKER = "FREELANCER_VS_BROKER",
  BROKER_VS_CLIENT = "BROKER_VS_CLIENT",
  BROKER_VS_FREELANCER = "BROKER_VS_FREELANCER",
}

export enum DisputePhase {
  PRESENTATION = "PRESENTATION",
  CROSS_EXAMINATION = "CROSS_EXAMINATION",
  INTERROGATION = "INTERROGATION",
  DELIBERATION = "DELIBERATION",
}

// Minimal User Interface for Frontend
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  avatarUrl?: string; // Optional for UI
  badge?: BadgeType;
  timeZone?: string;
}

// Frontend Interface for Dispute Entity
export interface Dispute {
  id: string;
  projectId: string;
  milestoneId: string;

  raisedById: string;
  raiserRole: UserRole;
  raiser?: User;

  defendantId: string;
  defendantRole: UserRole;
  defendant?: User;

  disputeType: DisputeType;
  category: DisputeCategory;
  priority: DisputePriority;
  disputedAmount: number;

  reason: string;
  evidence?: string[]; // URLs

  status: DisputeStatus;
  result: DisputeResult;
  phase?: DisputePhase;

  assignedStaffId?: string;
  currentTier: number;

  createdAt: string; // ISO Date string in frontend
  updatedAt: string;
}

// Staff Assignment Stats (for Dashboard)
export interface StaffStats {
  utilizationRate: number; // 0-100
  activeCases: number;
  resolvedThisMonth: number;
  avgResolutionTimeHours: number;
  tier: 1 | 2;
}

export type StaffDashboardRange = "7d" | "30d" | "90d";

export interface StaffDashboardOverview {
  generatedAt: string;
  range: StaffDashboardRange;
  throughput: {
    newDisputes: number;
    inProgress: number;
    closed: number;
  };
  sla: {
    medianTimeToFirstResponseHours: number;
    medianTimeToVerdictHours: number;
    breachRate: number;
  };
  scheduling: {
    autoScheduleSuccessRate: number;
    rescheduleCount: number;
    noShowRate: number;
  };
  quality: {
    appealRate: number;
    overturnedVerdictRate: number;
    feedbackScore: number;
  };
  workload: {
    averageCasesPerStaff: number;
    averageUtilizationRate: number;
    pendingQueueCount: number;
    totalStaff: number;
  };
  riskSignals: {
    prolongedCases: number;
    multiPartyCases: number;
    conflictingEvidenceCases: number;
  };
  series: {
    throughput: Array<{
      label: string;
      newDisputes: number;
      closed: number;
    }>;
    sla: Array<{
      label: string;
      medianTimeToVerdictHours: number;
      breachRate: number;
    }>;
    workload: Array<{
      label: string;
      averageUtilizationRate: number;
      pendingQueueCount: number;
    }>;
    risk: Array<{
      label: string;
      overloadedStaff: number;
      conflictingEvidenceCases: number;
    }>;
  };
  members: Array<{
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
  }>;
  currentUser: {
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
    rank: number | null;
    teamAverages: {
      resolvedCases: number;
      pendingCases: number;
      utilizationRate: number;
      appealRate: number;
      overturnRate: number;
      avgResolutionTimeHours: number;
    };
  } | null;
  highlights: {
    overloadedStaff: Array<{
      id: string;
      name: string;
      currentUtilizationRate: number;
      pendingCases: number;
    }>;
    backlogPressure: {
      pendingQueueCount: number;
      overloadedCount: number;
    };
    riskSpikes: Array<{
      label: string;
      overloadedStaff: number;
      conflictingEvidenceCases: number;
    }>;
  };
}
