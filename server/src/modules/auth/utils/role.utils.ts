import { StaffApplicationStatus } from '../../../database/entities/staff-application.entity';
import { UserRole } from '../../../database/entities/user.entity';

type StaffApprovalAwareUser = {
  role?: UserRole | string | null;
  isVerified?: boolean | null;
  staffApplication?: {
    status?: StaffApplicationStatus | string | null;
  } | null;
};

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

export function isApprovedStaff(user?: StaffApprovalAwareUser | null): boolean {
  if (normalizeUserRole(user?.role) !== UserRole.STAFF) {
    return false;
  }

  const normalizedStatus =
    user?.staffApplication?.status === undefined || user?.staffApplication?.status === null
      ? null
      : String(user.staffApplication.status).trim().toUpperCase();

  if (normalizedStatus === StaffApplicationStatus.APPROVED) {
    return true;
  }

  return !user?.staffApplication && user?.isVerified === true;
}

export function hasOperationalStaffAccess(user?: StaffApprovalAwareUser | null): boolean {
  const normalizedRole = normalizeUserRole(user?.role);
  if (!normalizedRole) {
    return false;
  }

  if (normalizedRole === UserRole.ADMIN) {
    return true;
  }

  return isApprovedStaff(user);
}
