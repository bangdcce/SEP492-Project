import { UserRole } from "@/features/staff/types/staff.types";

const ROLE_BASE_PATH: Record<string, string> = {
  [UserRole.CLIENT]: "/client",
  [UserRole.BROKER]: "/broker",
  [UserRole.FREELANCER]: "/freelancer",
};

export const resolveRoleBasePath = (role?: string) => {
  if (!role) return "/client";
  const key = role.toUpperCase();
  return ROLE_BASE_PATH[key] ?? "/client";
};

export const resolveParticipantRoleBasePath = (role?: string) => {
  if (!role) return null;
  const key = role.toUpperCase();
  return ROLE_BASE_PATH[key] ?? null;
};

export const resolveProfileViewerBasePath = (role?: string) => {
  if (!role) return null;
  const key = role.toUpperCase();
  if (key === UserRole.STAFF || key === UserRole.ADMIN) {
    return "/staff";
  }
  return ROLE_BASE_PATH[key] ?? null;
};

export const resolveRoleLabel = (role?: string) => {
  if (!role) return "Client";
  switch (role.toUpperCase()) {
    case UserRole.CLIENT:
      return "Client";
    case UserRole.BROKER:
      return "Broker";
    case UserRole.FREELANCER:
      return "Freelancer";
    default:
      return role;
  }
};
