import { Navigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  const user = useCurrentUser<{ role?: string }>();

  const resolveRoleHome = (role?: string) => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return ROUTES.ADMIN_DASHBOARD;
      case "BROKER":
        return ROUTES.BROKER_DASHBOARD;
      case "FREELANCER":
        return ROUTES.FREELANCER_DASHBOARD;
      case "STAFF":
        return "/staff/dashboard";
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
    return <Navigate to={resolveRoleHome(user.role)} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
};
