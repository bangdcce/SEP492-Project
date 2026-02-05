import { apiClient } from "@/shared/api/client";
import { cachedFetch, invalidateCacheByPrefix } from "@/shared/utils/requestCache";
import type {
  CalendarEvent,
  CalendarEventFilter,
  CreateEventRequest,
  RescheduleRequest,
  RescheduleRequestFilter,
  AvailabilityType,
} from "./types";

export interface CalendarEventsResponse {
  items: CalendarEvent[];
  total: number;
  page?: number;
  limit?: number;
}

export interface RescheduleRequestsResponse {
  items: RescheduleRequest[];
  total: number;
  page?: number;
  limit?: number;
}

export interface AvailabilitySlotInput {
  startTime: string;
  endTime: string;
  type: AvailabilityType;
  note?: string;
}

export interface SetAvailabilityRequest {
  slots: AvailabilitySlotInput[];
  allowConflicts?: boolean;
  timeZone?: string;
}

type CacheOptions = {
  preferCache?: boolean;
  ttlMs?: number;
};

const STAFF_AVAILABILITY_TTL_MS = 30_000;

const BASE_URL = "/calendar";

export const getEvents = async (
  filter?: CalendarEventFilter,
): Promise<CalendarEventsResponse> => {
  const params = new URLSearchParams();
  if (filter?.startDate) params.append("startDate", filter.startDate);
  if (filter?.endDate) params.append("endDate", filter.endDate);
  if (filter?.type) params.append("type", filter.type);
  if (filter?.status) params.append("status", filter.status);
  if (filter?.organizerId) params.append("organizerId", filter.organizerId);
  if (filter?.participantId) params.append("participantId", filter.participantId);

  const response = await apiClient.get(`${BASE_URL}/events?${params.toString()}`);
  const payload = response as { data?: CalendarEventsResponse } | CalendarEventsResponse;
  return ((payload as any).data ?? payload) as CalendarEventsResponse;
};

export const getRescheduleRequests = async (
  filter?: RescheduleRequestFilter,
): Promise<RescheduleRequestsResponse> => {
  const params = new URLSearchParams();
  if (filter?.status) params.append("status", filter.status);
  if (filter?.eventId) params.append("eventId", filter.eventId);
  if (filter?.requesterId) params.append("requesterId", filter.requesterId);
  if (filter?.page) params.append("page", String(filter.page));
  if (filter?.limit) params.append("limit", String(filter.limit));

  const response = await apiClient.get(`/calendar/reschedule-requests?${params.toString()}`);
  const payload = response as { data?: RescheduleRequestsResponse } | RescheduleRequestsResponse;
  return ((payload as any).data ?? payload) as RescheduleRequestsResponse;
};

export const processRescheduleRequest = async (input: {
  requestId: string;
  action: "approve" | "reject";
  selectedNewStartTime?: string;
  processNote?: string;
}) => {
  return await apiClient.post("/calendar/reschedule-requests/process", input);
};

export const createEvent = async (data: CreateEventRequest) => {
  return await apiClient.post(`${BASE_URL}/events`, data);
};

export const setAvailability = async (input: SetAvailabilityRequest) => {
  invalidateCacheByPrefix("calendar:availability:");
  return await apiClient.post(`${BASE_URL}/availability`, input);
};

export const deleteAvailability = async (availabilityId: string) => {
  invalidateCacheByPrefix("calendar:availability:");
  return await apiClient.delete(`${BASE_URL}/availability/${availabilityId}`);
};

export const getStaffAvailability = async (
  startDate: string,
  endDate: string,
  staffIds?: string[],
  options?: CacheOptions,
) => {
  const params: Record<string, string> = { startDate, endDate };
  if (staffIds && staffIds.length > 0) {
    params.staffIds = staffIds.join(",");
  }
  const key = `calendar:availability:${startDate}:${endDate}:${params.staffIds ?? "all"}`;
  const fetcher = () => apiClient.get(`${BASE_URL}/availability/staff`, { params });
  if (options?.preferCache === false) {
    return await fetcher();
  }
  return await cachedFetch(
    key,
    fetcher,
    options?.ttlMs ?? STAFF_AVAILABILITY_TTL_MS,
  );
};
