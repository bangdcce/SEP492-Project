export enum LeaveType {
  SHORT_TERM = "SHORT_TERM",
  LONG_TERM = "LONG_TERM",
}

export enum LeaveStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export interface LeaveActorSummary {
  id: string;
  fullName: string;
  email: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  staff?: LeaveActorSummary | null;
  type: LeaveType;
  status: LeaveStatus;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  reason?: string | null;
  isAutoApproved: boolean;
  processedById?: string | null;
  processedBy?: LeaveActorSummary | null;
  processedAt?: string | null;
  processedNote?: string | null;
  cancelledById?: string | null;
  cancelledBy?: LeaveActorSummary | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  staffId: string;
  month: string;
  allowanceMinutes: number;
  approvedMinutes: number;
  pendingMinutes: number;
  countedMinutes: number;
  remainingMinutes: number;
  overageMinutes: number;
}

export interface LeaveBalanceResponse {
  success: boolean;
  data: LeaveBalance;
  message?: string;
}

export interface LeaveRequestsResponse {
  success: boolean;
  data: LeaveRequest[];
}

export interface LeaveActionResponse<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface LeavePolicyItem {
  policyId: string | null;
  staffId: string;
  staff: LeaveActorSummary;
  monthlyAllowanceMinutes: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LeavePoliciesMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LeavePoliciesResponse {
  success: boolean;
  data: LeavePolicyItem[];
  meta: LeavePoliciesMeta;
}

export interface LeaveCreateResponseData {
  request: LeaveRequest;
  balance: LeaveBalance;
}
