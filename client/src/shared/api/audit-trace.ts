import { apiClient } from "./client";

type AuditBreadcrumbInput = {
  eventName: string;
  journeyStep?: string;
  route?: string;
  metadata?: Record<string, unknown>;
};

export const sendAuditBreadcrumbs = async (events: AuditBreadcrumbInput[]) => {
  if (!events.length) {
    return;
  }

  try {
    await apiClient.post(
      "/audit-logs/client-events",
      {
        events,
      },
      {
        timeout: 4000,
      },
    );
  } catch {
    // Best effort only.
  }
};
