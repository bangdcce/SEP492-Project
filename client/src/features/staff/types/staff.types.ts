export enum UserRole {
  ADMIN = "ADMIN",
  STAFF = "STAFF",
  BROKER = "BROKER",
  CLIENT = "CLIENT",
  CLIENT_SME = "CLIENT_SME",
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
  PENDING_REVIEW = "PENDING_REVIEW",
  INFO_REQUESTED = "INFO_REQUESTED",
  IN_MEDIATION = "IN_MEDIATION",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
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
