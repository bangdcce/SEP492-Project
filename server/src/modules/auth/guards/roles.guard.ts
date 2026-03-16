import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../database/entities/user.entity';
import { hasAnyUserRole } from '../utils/role.utils';

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

    // Kiểm tra user có tồn tại không (trường hợp bypass JwtAuthGuard hoặc user không được set)
    if (!user) {
      return false;
    }

    return hasAnyUserRole(user.role, requiredRoles);
  }
}
