import { UserRole } from "@/shared/types/user.types";

type TrustProfileRouteOptions = {
  role?: UserRole | string | null;
  pathname?: string | null;
};

const resolveRoleBasePath = (role?: UserRole | string | null) => {
  switch (String(role || "").toUpperCase()) {
    case UserRole.BROKER:
      return "/broker/profiles";
    case UserRole.FREELANCER:
      return "/freelancer/profiles";
    case UserRole.CLIENT:
      return "/client/profiles";
    default:
      return "/client/profiles";
  }
};

export const buildTrustProfilePath = (
  userId: string,
  options: TrustProfileRouteOptions = {},
) => {
  const pathname = options.pathname || "";
  const basePath = pathname.startsWith("/client/discovery")
    ? "/client/discovery/profile"
    : pathname.startsWith("/broker")
      ? "/broker/profiles"
      : pathname.startsWith("/freelancer")
        ? "/freelancer/profiles"
        : pathname.startsWith("/client")
          ? "/client/profiles"
          : resolveRoleBasePath(options.role);

  return `${basePath}/${userId}`;
};
