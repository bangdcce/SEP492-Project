import { apiClient } from "@/shared/api/client";
import { cachedFetch, invalidateCacheByPrefix } from "@/shared/utils/requestCache";
import type {
  LeaveActionResponse,
  LeaveBalance,
  LeaveBalanceResponse,
  LeaveCreateResponseData,
  LeaveRequest,
  LeaveRequestsResponse,
  LeaveStatus,
  LeaveType,
} from "./types";

export interface LeaveBalanceQuery {
  month?: string;
  includePending?: boolean;
  staffId?: string;
  timeZone?: string;
}

export interface LeaveListQuery {
  staffId?: string;
  status?: LeaveStatus;
  month?: string;
}

export interface CreateLeaveRequestInput {
  staffId?: string;
  type: LeaveType;
  startTime: string;
  endTime: string;
  reason?: string;
  timeZone?: string;
}

export interface ProcessLeaveRequestInput {
  action: "approve" | "reject";
  note?: string;
}

export interface CancelLeaveRequestInput {
  note?: string;
}

type CacheOptions = {
  preferCache?: boolean;
  ttlMs?: number;
};

const LEAVE_BALANCE_TTL_MS = 30_000;
const LEAVE_REQUESTS_TTL_MS = 30_000;

const extractData = <T>(payload: T | { data: T }): T => {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const buildParams = (query: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.append(key, value);
    }
  });
  return params;
};

const BASE_URL = "/leave";

export const getLeaveBalance = async (
  query: LeaveBalanceQuery,
  options?: CacheOptions,
): Promise<LeaveBalance> => {
  const params = buildParams({
    month: query.month,
    includePending:
      typeof query.includePending === "boolean"
        ? String(query.includePending)
        : undefined,
    staffId: query.staffId,
    timeZone: query.timeZone,
  });

  const key = `leave:balance:${query.staffId ?? "me"}:${query.month ?? "current"}:${query.includePending ?? true}`;
  const fetcher = () =>
    apiClient.get<LeaveBalanceResponse | LeaveBalance>(
      `${BASE_URL}/balance?${params.toString()}`,
    );

  const response =
    options?.preferCache === false
      ? await fetcher()
      : await cachedFetch(
          key,
          fetcher,
          options?.ttlMs ?? LEAVE_BALANCE_TTL_MS,
        );

  return extractData(response);
};

export const listLeaveRequests = async (
  query: LeaveListQuery,
  options?: CacheOptions,
): Promise<LeaveRequest[]> => {
  const params = buildParams({
    staffId: query.staffId,
    status: query.status,
    month: query.month,
  });

  const key = `leave:requests:${query.staffId ?? "me"}:${query.status ?? "all"}:${query.month ?? "all"}`;
  const fetcher = () =>
    apiClient.get<LeaveRequestsResponse | LeaveRequest[]>(
      `${BASE_URL}/requests?${params.toString()}`,
    );

  const response =
    options?.preferCache === false
      ? await fetcher()
      : await cachedFetch(
          key,
          fetcher,
          options?.ttlMs ?? LEAVE_REQUESTS_TTL_MS,
        );

  return extractData(response);
};

export const createLeaveRequest = async (input: CreateLeaveRequestInput) => {
  invalidateCacheByPrefix("leave:");
  return await apiClient.post<LeaveActionResponse<LeaveCreateResponseData>>(
    `${BASE_URL}/requests`,
    input,
  );
};

export const cancelLeaveRequest = async (
  id: string,
  input?: CancelLeaveRequestInput,
) => {
  invalidateCacheByPrefix("leave:");
  return await apiClient.patch<LeaveActionResponse>(
    `${BASE_URL}/requests/${id}/cancel`,
    input ?? {},
  );
};

export const processLeaveRequest = async (
  id: string,
  input: ProcessLeaveRequestInput,
) => {
  invalidateCacheByPrefix("leave:");
  return await apiClient.patch<LeaveActionResponse>(
    `${BASE_URL}/requests/${id}/process`,
    input,
  );
};

export const updateLeavePolicy = async (staffId: string, minutes: number) => {
  invalidateCacheByPrefix("leave:");
  return await apiClient.patch<LeaveActionResponse>(
    `${BASE_URL}/policy/${staffId}`,
    { monthlyAllowanceMinutes: minutes },
  );
};
