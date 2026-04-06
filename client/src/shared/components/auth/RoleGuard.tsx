import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  allowPendingStaff?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  allowPendingStaff = false,
}) => {
  const location = useLocation();
  const user = useCurrentUser<{
    role?: string;
    isVerified?: boolean;
    staffApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  }>();

  const resolveRoleHome = (currentUser?: {
    role?: string;
    isVerified?: boolean;
    staffApprovalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  }) => {
    switch (currentUser?.role?.toUpperCase()) {
      case "ADMIN":
        return ROUTES.ADMIN_DASHBOARD;
      case "BROKER":
        return ROUTES.BROKER_DASHBOARD;
      case "FREELANCER":
        return ROUTES.FREELANCER_DASHBOARD;
      case "STAFF": {
        const isApproved =
          currentUser?.staffApprovalStatus === "APPROVED" ||
          (!currentUser?.staffApprovalStatus && currentUser?.isVerified === true);
        return isApproved
          ? ROUTES.STAFF_DASHBOARD
          : ROUTES.STAFF_APPLICATION_STATUS;
      }
      case "CLIENT":
        return ROUTES.CLIENT_DASHBOARD;
      default:
        return ROUTES.LOGIN;
    }
  };

  // Check if user exists
  if (!user) {
    // Redirect to login page with state to redirect back after login
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Check if user has required role
  // Ensure case-insensitive comparison
  const userRole = user.role?.toUpperCase();
  const hasAccess = allowedRoles.some((role) => role.toUpperCase() === userRole);

  if (!hasAccess) {
    return <Navigate to={resolveRoleHome(user)} replace />;
  }

  const isApprovedStaff =
    userRole === "STAFF" &&
    (user.staffApprovalStatus === "APPROVED" ||
      (!user.staffApprovalStatus && user.isVerified === true));

  if (userRole === "STAFF" && !allowPendingStaff && !isApprovedStaff) {
    return <Navigate to={ROUTES.STAFF_APPLICATION_STATUS} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
};
