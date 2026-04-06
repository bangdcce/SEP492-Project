import { useCallback, useEffect, useMemo, useState } from "react";
import { connectSocket } from "@/shared/realtime/socket";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api";
import type { NotificationItem } from "../types";

const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

const normalizeNotification = (value: unknown): NotificationItem | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<NotificationItem>;
  if (!item.id || !item.title || !item.body || !item.createdAt) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    body: item.body,
    isRead: Boolean(item.isRead),
    readAt: item.readAt,
    relatedType: item.relatedType ?? null,
    relatedId: item.relatedId ?? null,
    createdAt: item.createdAt,
  };
};

const mergeNotification = (
  current: NotificationItem[],
  incoming: NotificationItem,
): NotificationItem[] => {
  const next = [incoming, ...current.filter((item) => item.id !== incoming.id)];
  return next.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const mergeNotificationList = (
  current: NotificationItem[],
  incoming: NotificationItem[],
  limit: number,
): NotificationItem[] => {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
};

export const useNotifications = (limit: number = 10) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const data = await getNotifications({ page: 1, limit });
        setNotifications((prev) =>
          mergeNotificationList(prev, data.items ?? [], limit),
        );
      } catch (error) {
        if (!options?.silent) {
          console.warn("Failed to refresh notifications", error);
        }
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [limit],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  useEffect(() => {
    const socket = connectSocket();
    const handleNotificationCreated = (payload: {
      notification?: NotificationItem;
    }) => {
      const incoming = normalizeNotification(payload?.notification ?? payload);
      if (!incoming) {
        return;
      }
      setNotifications((prev) => mergeNotification(prev, incoming));
    };

    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);

    return () => {
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const markOneAsRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item,
      ),
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt || new Date().toISOString(),
      })),
    );
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markOneAsRead,
    markAllAsRead,
  };
};
