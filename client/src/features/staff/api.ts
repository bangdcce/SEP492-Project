import { apiClient } from "@/shared/api/client";
import type { StaffDashboardOverview, StaffDashboardRange } from "./types/staff.types";

export const getStaffDashboardOverview = async (
  range: StaffDashboardRange = "30d",
): Promise<StaffDashboardOverview> => {
  return await apiClient.get<StaffDashboardOverview>(
    `/staff/dashboard/overview?range=${range}`,
  );
};
