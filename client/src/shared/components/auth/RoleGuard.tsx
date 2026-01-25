import { Navigate, useLocation } from "react-router-dom";
import { STORAGE_KEYS, ROUTES } from "@/constants";
import { getStoredItem } from "@/shared/utils/storage";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const location = useLocation();

  // Get user from local storage or session storage
  const userJson = getStoredItem(STORAGE_KEYS.USER);
  const user = userJson ? JSON.parse(userJson) : null;

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
    // Redirect to home or 404 if unauthorized
    // You might want to redirect to their specific dashboard instead
    return <Navigate to={ROUTES.NOT_FOUND} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
};
