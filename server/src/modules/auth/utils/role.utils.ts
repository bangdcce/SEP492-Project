import { UserRole } from '../../../database/entities/user.entity';

export function normalizeUserRole(role?: UserRole | string | null): UserRole | null {
  if (role === undefined || role === null) {
    return null;
  }

  const normalized = String(role).trim().toUpperCase();
  return normalized ? (normalized as UserRole) : null;
}

export function hasAnyUserRole(
  role: UserRole | string | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) {
    return false;
  }

  const normalizedAllowed = new Set(
    allowedRoles
      .map((allowedRole) => normalizeUserRole(allowedRole))
      .filter((allowedRole): allowedRole is UserRole => Boolean(allowedRole)),
  );

  if (normalizedAllowed.has(normalizedRole)) {
    return true;
  }

  return normalizedRole === UserRole.ADMIN && normalizedAllowed.has(UserRole.STAFF);
}
