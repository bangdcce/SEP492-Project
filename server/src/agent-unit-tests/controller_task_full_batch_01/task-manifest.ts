import fs from 'node:fs';
import path from 'node:path';

import { UserRole } from 'src/database/entities';
import { AdminDashboardController } from 'src/modules/admin-dashboard/admin-dashboard.controller';
import { AuditLogsController } from 'src/modules/audit-logs/audit-logs.controller';
import { CalendarController } from 'src/modules/calendar/calendar.controller';
import { DisputesController } from 'src/modules/disputes/disputes.controller';
import { EvidenceController } from 'src/modules/disputes/controllers/evidence.controller';
import { HearingController } from 'src/modules/disputes/controllers/hearing.controller';
import { SettlementController } from 'src/modules/disputes/controllers/settlement.controller';
import { StaffAssignmentController } from 'src/modules/disputes/controllers/staff-assignment.controller';
import { LeaveController } from 'src/modules/leave/leave.controller';
import { ReportController } from 'src/modules/report/report.controller';
import { ReviewController } from 'src/modules/review/review.controller';
import { UserWarningController } from 'src/modules/user-warning/user-warning.controller';
import { UsersController } from 'src/modules/users/users.controller';

import { findRouteDescriptor, getRouteGuards, type RouteDescriptor } from './test-helpers';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

export type TaskRow = {
  code: string;
  requestMethod: string;
  path: string;
  name: string;
  useCases: string;
};

export type ControllerTaskGroup =
  | 'admin-dashboard'
  | 'audit-logs'
  | 'calendar'
  | 'disputes-main'
  | 'disputes-evidence'
  | 'disputes-hearing'
  | 'disputes-settlement'
  | 'disputes-staff'
  | 'leave'
  | 'reports'
  | 'reviews'
  | 'user-warnings'
  | 'users-admin';

export type SecurityMode =
  | 'guarded-role'
  | 'guarded-auth'
  | 'inline-user-context'
  | 'public';

export type TaskEndpoint = TaskRow & {
  group: ControllerTaskGroup;
  controllerClass: any;
  controllerName: string;
  sourceFilePath: string;
  methodName: string;
  functionDisplayName: string;
  roles: UserRole[];
  preferredRole: UserRole;
  disallowedRole: UserRole;
  securityMode: SecurityMode;
};

type RegistryEntry = {
  group: ControllerTaskGroup;
  controllerClass: any;
  sourceFilePath: string;
};

const repoRoot = path.resolve(__dirname, '../../../..');
const taskFilePath = path.join(repoRoot, 'docs', 'Test-Unit-task.txt');

const registry: RegistryEntry[] = [
  {
    group: 'admin-dashboard',
    controllerClass: AdminDashboardController,
    sourceFilePath: 'server/src/modules/admin-dashboard/admin-dashboard.controller.ts',
  },
  {
    group: 'audit-logs',
    controllerClass: AuditLogsController,
    sourceFilePath: 'server/src/modules/audit-logs/audit-logs.controller.ts',
  },
  {
    group: 'calendar',
    controllerClass: CalendarController,
    sourceFilePath: 'server/src/modules/calendar/calendar.controller.ts',
  },
  {
    group: 'disputes-main',
    controllerClass: DisputesController,
    sourceFilePath: 'server/src/modules/disputes/disputes.controller.ts',
  },
  {
    group: 'disputes-evidence',
    controllerClass: EvidenceController,
    sourceFilePath: 'server/src/modules/disputes/controllers/evidence.controller.ts',
  },
  {
    group: 'disputes-hearing',
    controllerClass: HearingController,
    sourceFilePath: 'server/src/modules/disputes/controllers/hearing.controller.ts',
  },
  {
    group: 'disputes-settlement',
    controllerClass: SettlementController,
    sourceFilePath: 'server/src/modules/disputes/controllers/settlement.controller.ts',
  },
  {
    group: 'disputes-staff',
    controllerClass: StaffAssignmentController,
    sourceFilePath: 'server/src/modules/disputes/controllers/staff-assignment.controller.ts',
  },
  {
    group: 'leave',
    controllerClass: LeaveController,
    sourceFilePath: 'server/src/modules/leave/leave.controller.ts',
  },
  {
    group: 'reports',
    controllerClass: ReportController,
    sourceFilePath: 'server/src/modules/report/report.controller.ts',
  },
  {
    group: 'reviews',
    controllerClass: ReviewController,
    sourceFilePath: 'server/src/modules/review/review.controller.ts',
  },
  {
    group: 'user-warnings',
    controllerClass: UserWarningController,
    sourceFilePath: 'server/src/modules/user-warning/user-warning.controller.ts',
  },
  {
    group: 'users-admin',
    controllerClass: UsersController,
    sourceFilePath: 'server/src/modules/users/users.controller.ts',
  },
];

const userWarningAdminCodes = new Set([
  'EP-289',
  'EP-290',
  'EP-291',
  'EP-292',
  'EP-293',
  'EP-294',
  'EP-299',
  'EP-300',
]);

const inferPreferredRole = (group: ControllerTaskGroup, row: TaskRow, route: RouteDescriptor) => {
  if (route.roles.length > 0) {
    return route.roles[0];
  }

  switch (group) {
    case 'admin-dashboard':
    case 'audit-logs':
    case 'users-admin':
      return UserRole.ADMIN;
    case 'calendar':
    case 'disputes-main':
    case 'disputes-evidence':
    case 'disputes-settlement':
    case 'reports':
      return UserRole.CLIENT;
    case 'disputes-hearing':
    case 'disputes-staff':
    case 'leave':
      return UserRole.STAFF;
    case 'reviews':
      return row.path.includes('/admin/') ? UserRole.ADMIN : UserRole.CLIENT;
    case 'user-warnings':
      return userWarningAdminCodes.has(row.code) ? UserRole.ADMIN : UserRole.CLIENT;
    default:
      return UserRole.CLIENT;
  }
};

const inferDisallowedRole = (route: RouteDescriptor, preferredRole: UserRole) => {
  const candidates = [
    UserRole.CLIENT,
    UserRole.BROKER,
    UserRole.FREELANCER,
    UserRole.STAFF,
    UserRole.ADMIN,
  ];

  for (const candidate of candidates) {
    if (candidate !== preferredRole && !route.roles.includes(candidate)) {
      return candidate;
    }
  }

  return preferredRole === UserRole.ADMIN ? UserRole.CLIENT : UserRole.ADMIN;
};

const inferSecurityMode = (row: TaskRow, route: RouteDescriptor): SecurityMode => {
  const guards = getRouteGuards(route.controllerClass, route.methodName);
  const hasJwtGuard = guards.includes(JwtAuthGuard);
  const hasRolesGuard = guards.includes(RolesGuard) || route.roles.length > 0;

  if (hasJwtGuard && hasRolesGuard) {
    return 'guarded-role';
  }
  if (hasJwtGuard) {
    return 'guarded-auth';
  }
  if (row.code === 'EP-295' || row.code === 'EP-296') {
    return 'inline-user-context';
  }
  return 'public';
};

export const toFunctionDisplayName = (methodName: string) =>
  methodName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const parseTaskRows = (): TaskRow[] =>
  fs
    .readFileSync(taskFilePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [code, methodPath, name, useCases = ''] = line.split('\t');
      const [requestMethod, routePath] = methodPath.split(' ', 2);
      return {
        code,
        requestMethod: requestMethod.toUpperCase(),
        path: routePath,
        name,
        useCases,
      };
    });

export const detectDuplicateTaskRows = (rows: TaskRow[]) => {
  const seen = new Map<string, TaskRow[]>();
  for (const row of rows) {
    const key = `${row.requestMethod} ${row.path}`;
    const list = seen.get(key) ?? [];
    list.push(row);
    seen.set(key, list);
  }

  return Array.from(seen.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      codes: list.map((item) => item.code),
    }));
};

export const resolveTaskEndpoints = (): TaskEndpoint[] => {
  const rows = parseTaskRows();

  return rows.map((row) => {
    const matches = registry
      .map((entry) => ({
        ...entry,
        route: findRouteDescriptor(entry.controllerClass, row.requestMethod, row.path),
      }))
      .filter(
        (entry): entry is RegistryEntry & { route: RouteDescriptor } => entry.route !== undefined,
      );

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one controller route for ${row.code} ${row.requestMethod} ${row.path}, found ${matches.length}`,
      );
    }

    const [match] = matches;
    const preferredRole = inferPreferredRole(match.group, row, match.route);

    return {
      ...row,
      group: match.group,
      controllerClass: match.controllerClass,
      controllerName: match.controllerClass.name,
      sourceFilePath: match.sourceFilePath,
      methodName: match.route.methodName,
      functionDisplayName: toFunctionDisplayName(match.route.methodName),
      roles: match.route.roles,
      preferredRole,
      disallowedRole: inferDisallowedRole(match.route, preferredRole),
      securityMode: inferSecurityMode(row, match.route),
    };
  });
};

export const groupTaskEndpoints = () => {
  const groups = new Map<ControllerTaskGroup, TaskEndpoint[]>();
  for (const endpoint of resolveTaskEndpoints()) {
    const list = groups.get(endpoint.group) ?? [];
    list.push(endpoint);
    groups.set(endpoint.group, list);
  }
  return groups;
};
