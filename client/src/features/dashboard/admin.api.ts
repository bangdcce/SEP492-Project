import { apiClient } from "@/shared/api/client";
import type { AdminDashboardOverview, DashboardRange } from "./admin.types";

export const getAdminDashboardOverview = async (
  range: DashboardRange = "30d",
): Promise<AdminDashboardOverview> => {
  return await apiClient.get<AdminDashboardOverview>(`/admin/dashboard/overview?range=${range}`);
};
