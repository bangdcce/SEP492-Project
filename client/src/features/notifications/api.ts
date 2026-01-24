import { apiClient } from "@/shared/api/client";
import type { NotificationsResponse } from "./types";

export const getNotifications = async (input?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationsResponse> => {
  const params = new URLSearchParams();
  if (input?.page) params.append("page", String(input.page));
  if (input?.limit) params.append("limit", String(input.limit));
  if (input?.unreadOnly) params.append("unreadOnly", "true");

  const response = await apiClient.get(
    `/notifications?${params.toString()}`,
  );
  const payload = response as { data?: NotificationsResponse } | NotificationsResponse;
  return (payload.data ?? payload) as NotificationsResponse;
};

export const markNotificationRead = async (notificationId: string) => {
  return await apiClient.patch(`/notifications/${notificationId}/read`);
};

export const markAllNotificationsRead = async () => {
  return await apiClient.patch("/notifications/read-all");
};
