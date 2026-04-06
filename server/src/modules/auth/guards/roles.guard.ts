import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../database/entities/user.entity';
import { hasAnyUserRole, isApprovedStaff } from '../utils/role.utils';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Ensure the user exists in case JwtAuthGuard is bypassed or req.user is missing.
    if (!user) {
      return false;
    }

    if (!hasAnyUserRole(user.role, requiredRoles)) {
      return false;
    }

    if (user.role !== UserRole.STAFF) {
      return true;
    }

    return isApprovedStaff(user);
  }
}
