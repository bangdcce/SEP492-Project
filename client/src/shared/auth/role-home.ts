import { ROUTES } from "../../constants";

export interface RoleHomeUser {
  role?: string;
  isVerified?: boolean;
  staffApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
}

export const isApprovedStaffUser = (user?: RoleHomeUser) =>
  user?.role?.toUpperCase() === "STAFF" &&
  (user.staffApprovalStatus === "APPROVED" ||
    (!user.staffApprovalStatus && user.isVerified === true));

export const resolveRoleHome = (user?: RoleHomeUser) => {
  switch (user?.role?.toUpperCase()) {
    case "ADMIN":
      return ROUTES.ADMIN_DASHBOARD;
    case "BROKER":
      return ROUTES.BROKER_DASHBOARD;
    case "FREELANCER":
      return ROUTES.FREELANCER_DASHBOARD;
    case "STAFF":
      return isApprovedStaffUser(user)
        ? ROUTES.STAFF_DASHBOARD
        : ROUTES.STAFF_APPLICATION_STATUS;
    case "CLIENT":
      return ROUTES.CLIENT_DASHBOARD;
    default:
      return ROUTES.LOGIN;
  }
};
