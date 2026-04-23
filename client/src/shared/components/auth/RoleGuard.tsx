import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants";
import { isApprovedStaffUser, resolveRoleHome } from "@/shared/auth/role-home";
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

  const isApprovedStaff = isApprovedStaffUser(user);

  if (userRole === "STAFF" && !allowPendingStaff && !isApprovedStaff) {
    return <Navigate to={ROUTES.STAFF_APPLICATION_STATUS} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
};
