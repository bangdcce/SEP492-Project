import { UserRole } from "@/features/staff/types/staff.types";

const ROLE_BASE_PATH: Record<string, string> = {
  [UserRole.CLIENT]: "/client",
  [UserRole.CLIENT_SME]: "/client",
  [UserRole.BROKER]: "/broker",
  [UserRole.FREELANCER]: "/freelancer",
  SME: "/client",
};

export const resolveRoleBasePath = (role?: string) => {
  if (!role) return "/client";
  const key = role.toUpperCase();
  return ROLE_BASE_PATH[key] ?? "/client";
};

export const resolveRoleLabel = (role?: string) => {
  if (!role) return "Client";
  switch (role.toUpperCase()) {
    case UserRole.CLIENT:
      return "Client";
    case UserRole.CLIENT_SME:
      return "Client SME";
    case UserRole.BROKER:
      return "Broker";
    case UserRole.FREELANCER:
      return "Freelancer";
    default:
      return role;
  }
};
