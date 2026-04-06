import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "@/shared/api/client";
import { connectSocket } from "@/shared/realtime/socket";

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const INVITED_STATUS = "INVITED";

export interface InvitationRequestScopeBaseline {
  projectGoalSummary?: string | null;
  requestedDeadline?: string | null;
}

export interface InvitationRequestPreview {
  id: string;
  title: string;
  status?: string | null;
  description?: string | null;
  budgetRange?: string | null;
  intendedTimeline?: string | null;
  requestedDeadline?: string | null;
  techPreferences?: string | null;
  createdAt?: string;
  requestScopeBaseline?: InvitationRequestScopeBaseline | null;
  client?: {
    id?: string;
    fullName?: string | null;
  } | null;
  broker?: {
    id?: string;
    fullName?: string | null;
  } | null;
}

export interface MyInvitationItem {
  id: string;
  status?: string | null;
  createdAt?: string;
  coverLetter?: string | null;
  request?: InvitationRequestPreview | null;
}

export interface UseMyInvitationsRealtimeOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

export const normalizeInvitationStatus = (
  status: string | null | undefined,
): string => String(status || "").toUpperCase();

const parseInvitations = (payload: unknown): MyInvitationItem[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return [...payload]
    .filter((item): item is MyInvitationItem =>
      Boolean(
        item &&
        typeof item === "object" &&
        "id" in (item as Record<string, unknown>),
      ),
    )
    .sort(
      (a, b) =>
        new Date(String(b.createdAt || 0)).getTime() -
        new Date(String(a.createdAt || 0)).getTime(),
    );
};

const shouldRefreshForNotification = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") {
    return true;
  }

  const wrapper = payload as { notification?: unknown };
  const notification =
    wrapper.notification && typeof wrapper.notification === "object"
      ? (wrapper.notification as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  const relatedType = String(notification.relatedType || "");
  if (!relatedType) {
    return true;
  }

  return relatedType === "ProjectRequest";
};

export const useMyInvitationsRealtime = (
  options: UseMyInvitationsRealtimeOptions = {},
) => {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = options;
  const [invitations, setInvitations] = useState<MyInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (refreshOptions?: { silent?: boolean }) => {
      if (!enabled) {
        return;
      }

      if (!refreshOptions?.silent) {
        setIsLoading(true);
      }

      try {
        const data = await apiClient.get<MyInvitationItem[]>(
          "/project-requests/invitations/my",
        );
        setInvitations(parseInvitations(data));
        setError(null);
      } catch (refreshError) {
        setError("Failed to refresh invitations");
        if (!refreshOptions?.silent) {
          console.warn("Failed to refresh invitations", refreshError);
        }
      } finally {
        if (!refreshOptions?.silent) {
          setIsLoading(false);
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      setInvitations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || pollIntervalMs <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, pollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, pollIntervalMs, refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = connectSocket();

    const handleNotificationCreated = (payload: unknown) => {
      if (!shouldRefreshForNotification(payload)) {
        return;
      }
      void refresh({ silent: true });
    };

    const handleRequestUpdated = () => {
      void refresh({ silent: true });
    };

    socket.on("NOTIFICATION_CREATED", handleNotificationCreated);
    socket.on("REQUEST_UPDATED", handleRequestUpdated);

    return () => {
      socket.off("NOTIFICATION_CREATED", handleNotificationCreated);
      socket.off("REQUEST_UPDATED", handleRequestUpdated);
    };
  }, [enabled, refresh]);

  const pendingCount = useMemo(
    () =>
      invitations.filter(
        (invitation) =>
          normalizeInvitationStatus(invitation.status) === INVITED_STATUS,
      ).length,
    [invitations],
  );

  return {
    invitations,
    pendingCount,
    isLoading,
    error,
    refresh,
  };
};
