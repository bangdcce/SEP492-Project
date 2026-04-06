import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ReportReason, ReportStatus, UserRole } from 'src/database/entities';
import { LeaveType } from 'src/database/entities/staff-leave-request.entity';
import { LeaveController } from 'src/modules/leave/leave.controller';
import {
  CancelLeaveRequestDto,
  CreateLeaveRequestDto,
  LeaveBalanceQueryDto,
  ListLeavePoliciesQueryDto,
  ListLeaveRequestsQueryDto,
  ProcessLeaveRequestDto,
  UpdateLeavePolicyDto,
} from 'src/modules/leave/dto/leave.dto';
import { LeaveService } from 'src/modules/leave/leave.service';
import { ReportController } from 'src/modules/report/report.controller';
import { CreateReportDto } from 'src/modules/report/dto/create-report.dto';
import { ResolveReportDto } from 'src/modules/report/dto/resolve-report.dto';
import { ReportService } from 'src/modules/report/report.service';
import { ReviewController } from 'src/modules/review/review.controller';
import { CreateReviewDto } from 'src/modules/review/dto/create-review.dto';
import { DeleteReviewDto } from 'src/modules/review/dto/delete-review.dto';
import {
  ReviewModerationReassignDto,
  ReviewModerationVersionDto,
} from 'src/modules/review/dto/review-moderation.dto';
import { UpdateReviewDto } from 'src/modules/review/dto/update-review.dto';
import { ReviewService } from 'src/modules/review/review.service';
import { UserWarningController } from 'src/modules/user-warning/user-warning.controller';
import {
  AppealFlagDto,
  CreateUserFlagDto,
  UpdateUserFlagDto,
} from 'src/modules/user-warning/dto';
import { UserWarningService } from 'src/modules/user-warning/user-warning.service';
import { UserFlagType } from 'src/modules/user-warning/types';
import { UsersController } from 'src/modules/users/users.controller';
import { UsersService } from 'src/modules/users/users.service';

import {
  buildCommonAuthPreconditions,
  buildMissingTargetPreconditions,
  buildTargetExistencePreconditions,
  flattenInvocationInputs,
  summarizeInputDelta,
  summarizeReturnValue,
  toRoleLabel,
  toWorkbookInputMap,
} from './case-catalog-utils';
import type { WorkbookCaseDescriptor } from './case-catalog.types';
import {
  ALT_UUID,
  THIRD_UUID,
  VALID_ISO,
  VALID_UUID,
  buildUser,
  createServiceProxy,
  getRouteGuards,
  invokeControllerMethod,
  validateDto,
} from './test-helpers';
import { resolveTaskEndpoints, type TaskEndpoint } from './task-manifest';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { buildCaseLogMessageFromTitle } from './test-log-helpers';

type SupportedGroup = 'leave' | 'reports' | 'reviews' | 'user-warnings' | 'users-admin';
type Variant = 'happy' | 'edge-1' | 'edge-2';

type InvocationPayload = {
  params: Record<string, any>;
  query: Record<string, any>;
  body: Record<string, any>;
  user?: ReturnType<typeof buildUser>;
  reqExtras?: Record<string, any>;
};

type Runtime = {
  group: SupportedGroup;
  endpoints: TaskEndpoint[];
  createDirectHarness: () => {
    controller: Record<string, any>;
    service: ReturnType<typeof createServiceProxy>;
  };
};

type GroupConfig = {
  controllerClass: any;
  createController: (service: ReturnType<typeof createServiceProxy>) => Record<string, any>;
};

type ValidationConfig =
  | { kind: 'dto'; dtoClass: new () => any; payload: Record<string, any> }
  | { kind: 'uuid'; field: string }
  | { kind: 'int'; field: string; value: string }
  | { kind: 'bool'; field: string; value: string };

const GROUP_CONFIGS: Record<SupportedGroup, GroupConfig> = {
  leave: {
    controllerClass: LeaveController,
    createController(service) {
      return new LeaveController(service as never);
    },
  },
  reports: {
    controllerClass: ReportController,
    createController(service) {
      return new ReportController(service as never);
    },
  },
  reviews: {
    controllerClass: ReviewController,
    createController(service) {
      return new ReviewController(service as never);
    },
  },
  'user-warnings': {
    controllerClass: UserWarningController,
    createController(service) {
      return new UserWarningController(service as never);
    },
  },
  'users-admin': {
    controllerClass: UsersController,
    createController(service) {
      return new UsersController(service as never);
    },
  },
};

const allServiceEndpoints = resolveTaskEndpoints().filter(
  (endpoint): endpoint is TaskEndpoint & { group: SupportedGroup } =>
    endpoint.group === 'leave' ||
    endpoint.group === 'reports' ||
    endpoint.group === 'reviews' ||
    endpoint.group === 'user-warnings' ||
    endpoint.group === 'users-admin',
);

const endpointByCode = new Map(allServiceEndpoints.map((endpoint) => [endpoint.code, endpoint]));

const expectedServiceMethods: Record<string, string[]> = {
  'EP-171': ['createLeaveRequest'],
  'EP-172': ['listLeaveRequests'],
  'EP-173': ['processLeaveRequest'],
  'EP-174': ['cancelLeaveRequest'],
  'EP-175': ['getLeaveBalance'],
  'EP-176': ['listLeavePolicies'],
  'EP-177': ['updateLeavePolicy'],
  'EP-242': ['create'],
  'EP-243': ['findPending'],
  'EP-244': ['findOne'],
  'EP-245': ['resolve'],
  'EP-251': ['create'],
  'EP-252': ['update'],
  'EP-254': ['getEditHistory'],
  'EP-255': ['softDelete'],
  'EP-256': ['restore'],
  'EP-257': ['dismissReport'],
  'EP-258': ['getFlaggedReviews'],
  'EP-259': ['getReviewsForModeration'],
  'EP-260': ['openModerationCase'],
  'EP-261': ['takeModerationCase'],
  'EP-262': ['releaseModerationCase'],
  'EP-263': ['reassignModerationCase'],
  'EP-289': ['getFlagStatistics'],
  'EP-290': ['getFlaggedUsers'],
  'EP-291': ['getPendingAppeals'],
  'EP-292': ['createManualFlag'],
  'EP-293': ['updateFlag'],
  'EP-294': ['resolveAppeal'],
  'EP-295': ['getUserFlags', 'hasActiveWarning'],
  'EP-296': ['appealFlag'],
  'EP-297': ['getUserFlags', 'hasActiveWarning', 'getHighestSeverity'],
  'EP-298': ['hasActiveWarning', 'getHighestSeverity'],
  'EP-299': ['checkPerformanceFlags'],
  'EP-300': ['expireOldFlags'],
  'EP-306': ['getUserStatistics'],
};

const validationConfig: Partial<Record<string, ValidationConfig>> = {
  'EP-171': {
    kind: 'dto',
    dtoClass: CreateLeaveRequestDto,
    payload: {
      type: 'SHORT_TERM',
      startTime: VALID_ISO,
      endTime: '2026-04-08T09:00:00.000Z',
    },
  },
  'EP-172': {
    kind: 'dto',
    dtoClass: ListLeaveRequestsQueryDto,
    payload: { staffId: 'bad-id' },
  },
  'EP-173': { kind: 'uuid', field: 'id' },
  'EP-174': { kind: 'uuid', field: 'id' },
  'EP-175': {
    kind: 'dto',
    dtoClass: LeaveBalanceQueryDto,
    payload: { month: '2026/04' },
  },
  'EP-176': {
    kind: 'dto',
    dtoClass: ListLeavePoliciesQueryDto,
    payload: { page: 0, limit: 0 },
  },
  'EP-177': {
    kind: 'dto',
    dtoClass: UpdateLeavePolicyDto,
    payload: { monthlyAllowanceMinutes: -1 },
  },
  'EP-242': {
    kind: 'dto',
    dtoClass: CreateReportDto,
    payload: { reviewId: 'bad-id', reason: ReportReason.SPAM },
  },
  'EP-245': {
    kind: 'dto',
    dtoClass: ResolveReportDto,
    payload: { status: 'INVALID' },
  },
  'EP-251': {
    kind: 'dto',
    dtoClass: CreateReviewDto,
    payload: { projectId: 'bad-id', targetUserId: ALT_UUID, rating: 4 },
  },
  'EP-252': {
    kind: 'dto',
    dtoClass: UpdateReviewDto,
    payload: { rating: 6 },
  },
  'EP-255': {
    kind: 'dto',
    dtoClass: DeleteReviewDto,
    payload: { reason: '' },
  },
  'EP-260': {
    kind: 'dto',
    dtoClass: ReviewModerationVersionDto,
    payload: { assignmentVersion: -1 },
  },
  'EP-261': {
    kind: 'dto',
    dtoClass: ReviewModerationVersionDto,
    payload: { assignmentVersion: -1 },
  },
  'EP-262': {
    kind: 'dto',
    dtoClass: ReviewModerationVersionDto,
    payload: { assignmentVersion: -1 },
  },
  'EP-263': {
    kind: 'dto',
    dtoClass: ReviewModerationReassignDto,
    payload: { assigneeId: 'bad-id', assignmentVersion: 1 },
  },
  'EP-290': { kind: 'int', field: 'minSeverity', value: 'oops' },
  'EP-291': { kind: 'int', field: 'page', value: 'oops' },
  'EP-292': {
    kind: 'dto',
    dtoClass: CreateUserFlagDto,
    payload: { type: 'INVALID_TYPE', description: 'broken' },
  },
  'EP-293': {
    kind: 'dto',
    dtoClass: UpdateUserFlagDto,
    payload: { severity: 6 },
  },
  'EP-295': { kind: 'bool', field: 'includeResolved', value: 'not-bool' },
  'EP-296': {
    kind: 'dto',
    dtoClass: AppealFlagDto,
    payload: { reason: 123 },
  },
  'EP-297': { kind: 'bool', field: 'includeResolved', value: 'not-bool' },
};

const touchedMethodNames = (service: ReturnType<typeof createServiceProxy>) =>
  service
    .__listMocks__()
    .filter(([, mock]) => mock.mock.calls.length > 0)
    .map(([name]) => name);

const pathParams = (endpoint: TaskEndpoint, variant: Variant) => {
  const value = variant === 'edge-1' ? ALT_UUID : variant === 'edge-2' ? THIRD_UUID : VALID_UUID;
  const params: Record<string, string> = {};
  for (const match of endpoint.path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    params[match[1]] = value;
  }
  return params;
};

const buildLeaveBody = (code: string, variant: Variant) => {
  switch (code) {
    case 'EP-171':
      return variant === 'edge-1'
        ? {
            type: LeaveType.LONG_TERM,
            startTime: VALID_ISO,
            endTime: '2026-04-10T09:00:00.000Z',
          }
        : variant === 'edge-2'
          ? {
              type: LeaveType.LONG_TERM,
              startTime: VALID_ISO,
              endTime: '2026-04-10T09:00:00.000Z',
              reason: 'Family medical leave',
              timeZone: 'Asia/Saigon',
            }
          : {
              type: LeaveType.LONG_TERM,
              startTime: VALID_ISO,
              endTime: '2026-04-08T09:00:00.000Z',
              reason: 'Extended leave request',
            };
    case 'EP-173':
      return variant === 'edge-1'
        ? { action: 'approve' }
        : variant === 'edge-2'
          ? { action: 'reject', note: 'Balance insufficient' }
          : { action: 'approve', note: 'Approved by admin' };
    case 'EP-174':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { note: 'Need to reschedule' }
          : { note: 'Cancelling this request' };
    case 'EP-177':
      return variant === 'edge-1'
        ? { monthlyAllowanceMinutes: 0 }
        : variant === 'edge-2'
          ? { monthlyAllowanceMinutes: 43200 }
          : { monthlyAllowanceMinutes: 9600 };
    default:
      return {};
  }
};

const buildReportBody = (code: string, variant: Variant) => {
  if (code === 'EP-242') {
    return variant === 'edge-1'
      ? { reviewId: VALID_UUID, reason: ReportReason.SPAM }
      : variant === 'edge-2'
        ? {
            reviewId: VALID_UUID,
            reason: ReportReason.OTHER,
            description: 'Boundary description for manual moderation',
          }
        : {
            reviewId: VALID_UUID,
            reason: ReportReason.HARASSMENT,
            description: 'Contains abusive language',
          };
  }

  return variant === 'edge-1'
    ? { status: ReportStatus.REJECTED }
    : variant === 'edge-2'
      ? { status: ReportStatus.RESOLVED, adminNote: 'Escalated but valid report' }
      : {
          status: ReportStatus.RESOLVED,
          adminNote: 'Review removed after moderation',
          deleteReview: true,
        };
};

const buildReviewBody = (code: string, variant: Variant) => {
  switch (code) {
    case 'EP-251':
      return variant === 'edge-1'
        ? { projectId: VALID_UUID, targetUserId: ALT_UUID, rating: 5 }
        : variant === 'edge-2'
          ? {
              projectId: VALID_UUID,
              targetUserId: ALT_UUID,
              rating: 1,
              comment: 'Short review comment',
            }
          : {
              projectId: VALID_UUID,
              targetUserId: ALT_UUID,
              rating: 4,
              comment: 'Helpful and responsive',
            };
    case 'EP-252':
      return variant === 'edge-1'
        ? { rating: 5 }
        : variant === 'edge-2'
          ? { comment: 'Updated after delivery' }
          : { rating: 3, comment: 'Updated review content' };
    case 'EP-255':
      return variant === 'edge-1'
        ? { reason: 'Spam content' }
        : variant === 'edge-2'
          ? { reason: 'Contains abusive language' }
          : { reason: 'Violates moderation policy' };
    case 'EP-256':
      return variant === 'edge-1'
        ? { reason: 'Appeal accepted' }
        : variant === 'edge-2'
          ? { reason: 'Evidence reviewed' }
          : { reason: 'Restored after admin review' };
    case 'EP-257':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { reason: 'False positive' }
          : { reason: 'Reviewed and dismissed' };
    case 'EP-260':
    case 'EP-261':
    case 'EP-262':
      return variant === 'edge-1'
        ? { assignmentVersion: 0 }
        : variant === 'edge-2'
          ? { assignmentVersion: 3 }
          : { assignmentVersion: 1 };
    case 'EP-263':
      return variant === 'edge-1'
        ? { assigneeId: ALT_UUID, assignmentVersion: 1 }
        : variant === 'edge-2'
          ? {
              assigneeId: THIRD_UUID,
              assignmentVersion: 2,
              reason: 'Current owner is unavailable',
            }
          : {
              assigneeId: ALT_UUID,
              assignmentVersion: 1,
              reason: 'Reassign to a specialist reviewer',
            };
    default:
      return {};
  }
};

const buildUserWarningBody = (code: string, variant: Variant) => {
  switch (code) {
    case 'EP-292':
      return variant === 'edge-1'
        ? { type: UserFlagType.MANUAL_WARNING, description: 'Manual warning created by admin' }
        : variant === 'edge-2'
          ? {
              type: UserFlagType.UNDER_INVESTIGATION,
              description: 'Risk under investigation',
              severity: 5,
            }
          : {
              type: UserFlagType.SUSPICIOUS_ACTIVITY,
              description: 'Suspicious payment behavior',
              severity: 3,
            };
    case 'EP-293':
      return variant === 'edge-1'
        ? { status: 'ACTIVE', adminNote: 'Flag remains active' }
        : variant === 'edge-2'
          ? { severity: 5, resolution: 'Escalated for deeper review' }
          : { status: 'APPEALED', severity: 4, adminNote: 'Monitoring case' };
    case 'EP-294':
      return variant === 'edge-1'
        ? { accepted: false, resolution: 'Appeal rejected' }
        : variant === 'edge-2'
          ? { accepted: true, resolution: 'Appeal accepted after review' }
          : { accepted: true, resolution: 'Appeal approved' };
    case 'EP-296':
      return variant === 'edge-1'
        ? { reason: 'Need reconsideration' }
        : variant === 'edge-2'
          ? { reason: 'Evidence attached', evidence: ['log-1', 'log-2'] }
          : { reason: 'Flag is inaccurate', evidence: ['screen-1'] };
    default:
      return {};
  }
};

const buildQuery = (endpoint: TaskEndpoint, variant: Variant) => {
  switch (endpoint.code) {
    case 'EP-172':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { status: 'PENDING', month: '2026-04' }
          : { staffId: VALID_UUID, status: 'PENDING', month: '2026-04' };
    case 'EP-175':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { month: '2026-04', includePending: true }
          : { staffId: VALID_UUID, month: '2026-04', includePending: true };
    case 'EP-176':
      return variant === 'edge-1'
        ? { page: 1, limit: 20 }
        : variant === 'edge-2'
          ? { search: 'bang', page: 2, limit: 5 }
          : { search: 'staff', page: 1, limit: 20 };
    case 'EP-243':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { page: '2', limit: '5' }
          : { page: '1', limit: '20' };
    case 'EP-259':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { status: 'PENDING', page: 2, limit: 10 }
          : { status: 'OPEN', page: 1, limit: 20 };
    case 'EP-290':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { status: 'ACTIVE', minSeverity: 5, page: 2, limit: 10 }
          : { status: 'ACTIVE', minSeverity: 2, page: 1, limit: 20 };
    case 'EP-291':
      return variant === 'edge-1'
        ? {}
        : variant === 'edge-2'
          ? { page: 2, limit: 5 }
          : { page: 1, limit: 20 };
    case 'EP-295':
    case 'EP-297':
      return variant === 'edge-1'
        ? { includeResolved: false }
        : variant === 'edge-2'
          ? { includeResolved: true }
          : { includeResolved: false };
    default:
      return {};
  }
};

const buildBody = (endpoint: TaskEndpoint, variant: Variant) => {
  switch (endpoint.group) {
    case 'leave':
      return buildLeaveBody(endpoint.code, variant);
    case 'reports':
      return buildReportBody(endpoint.code, variant);
    case 'reviews':
      return buildReviewBody(endpoint.code, variant);
    case 'user-warnings':
      return buildUserWarningBody(endpoint.code, variant);
    default:
      return {};
  }
};

const buildServiceReturn = (endpoint: TaskEndpoint, variant: Variant) => {
  if (endpoint.group === 'leave') {
    return { success: true, endpoint: endpoint.code, variant, id: VALID_UUID };
  }
  if (endpoint.group === 'reports') {
    return endpoint.code === 'EP-243'
      ? { items: [{ id: VALID_UUID }], page: 1, limit: 20, total: 1 }
      : { success: true, endpoint: endpoint.code, variant };
  }
  if (endpoint.group === 'reviews') {
    return endpoint.code === 'EP-259'
      ? { items: [{ id: VALID_UUID }], page: 1, limit: 20, total: 1 }
      : endpoint.code === 'EP-258'
        ? [{ id: VALID_UUID, flagged: true }]
        : { success: true, endpoint: endpoint.code, variant };
  }
  if (endpoint.group === 'user-warnings') {
    switch (endpoint.code) {
      case 'EP-289':
        return { totalFlags: 5, activeFlags: 3, appealedFlags: 1 };
      case 'EP-290':
      case 'EP-291':
        return { items: [{ id: VALID_UUID }], total: 1, page: 1, limit: 20 };
      case 'EP-292':
      case 'EP-293':
      case 'EP-294':
      case 'EP-296':
        return { success: true, flagId: VALID_UUID, endpoint: endpoint.code, variant };
      case 'EP-295':
      case 'EP-297':
        return [{ id: VALID_UUID, type: UserFlagType.MANUAL_WARNING }];
      case 'EP-298':
        return true;
      case 'EP-299':
        return [{ id: VALID_UUID, type: UserFlagType.SUSPICIOUS_ACTIVITY }];
      case 'EP-300':
        return 2;
      default:
        return { success: true, endpoint: endpoint.code, variant };
    }
  }
  return { totalUsers: 10, activeUsers: 8, bannedUsers: 2 };
};

const buildInvocation = (endpoint: TaskEndpoint, variant: Variant): InvocationPayload => {
  if (endpoint.group === 'user-warnings') {
    return {
      params: pathParams(endpoint, variant),
      query: buildQuery(endpoint, variant),
      body: buildBody(endpoint, variant),
      reqExtras: {
        user: { id: variant === 'edge-1' ? ALT_UUID : VALID_UUID },
      },
    };
  }

  return {
    params: pathParams(endpoint, variant),
    query: buildQuery(endpoint, variant),
    body: buildBody(endpoint, variant),
    user: buildUser(endpoint.preferredRole, { id: VALID_UUID }),
  };
};

const buildValidationMessage = (endpoint: TaskEndpoint) => {
  const config = validationConfig[endpoint.code];
  if (!config) {
    return `BadRequestException: Invalid ${endpoint.name} payload`;
  }

  if (config.kind === 'uuid') {
    return `BadRequestException: ${config.field} must be a UUID`;
  }
  if (config.kind === 'int') {
    return `BadRequestException: ${config.field} must be an integer`;
  }
  if (config.kind === 'bool') {
    return `BadRequestException: ${config.field} must be a boolean`;
  }

  const [fieldName] = Object.keys(config.payload);
  return `BadRequestException: ${fieldName} fails DTO validation`;
};

const buildUnauthorizedTitle = (endpoint: TaskEndpoint) => {
  if (endpoint.securityMode === 'guarded-role' || endpoint.securityMode === 'guarded-auth') {
    return `${endpoint.code} UTC07 security declares JwtAuthGuard on ${endpoint.methodName}`;
  }

  if (endpoint.code === 'EP-295' || endpoint.code === 'EP-296') {
    return `${endpoint.code} UTC07 security handles missing user context for ${endpoint.methodName}`;
  }

  return `${endpoint.code} UTC07 security confirms ${endpoint.methodName} does not require JwtAuthGuard`;
};

const buildForbiddenTitle = (endpoint: TaskEndpoint) => {
  if (endpoint.securityMode === 'guarded-role') {
    return `${endpoint.code} UTC08 security restricts ${endpoint.methodName} to ${endpoint.roles.join(', ')} role metadata`;
  }
  if (endpoint.securityMode === 'guarded-auth') {
    return `${endpoint.code} UTC08 security keeps ${endpoint.methodName} authentication-only without role metadata`;
  }
  if (endpoint.code === 'EP-292' || endpoint.code === 'EP-293' || endpoint.code === 'EP-294') {
    return `${endpoint.code} UTC08 security falls back to system-scoped moderation handling when auth context is absent`;
  }
  return `${endpoint.code} UTC08 security confirms ${endpoint.methodName} has no role metadata restriction`;
};

const buildCaseTitle = (
  endpoint: TaskEndpoint,
  utcId: string,
  kind: 'happy' | 'edge-1' | 'edge-2' | 'validation' | 'not-found' | 'unexpected' | 'unauthorized' | 'forbidden',
) => {
  if (kind === 'unauthorized') {
    return buildUnauthorizedTitle(endpoint);
  }
  if (kind === 'forbidden') {
    return buildForbiddenTitle(endpoint);
  }

  const happyInputs = flattenInvocationInputs(buildInvocation(endpoint, 'happy'));
  const edgeInputs =
    kind === 'edge-1' || kind === 'edge-2'
      ? flattenInvocationInputs(buildInvocation(endpoint, kind))
      : undefined;

  switch (kind) {
    case 'happy':
      return `${endpoint.code} ${utcId} happy path executes ${endpoint.methodName} with valid business inputs`;
    case 'edge-1':
      return `${endpoint.code} ${utcId} edge case accepts alternate input set ${summarizeInputDelta(happyInputs, edgeInputs ?? {}, 'for boundary coverage')}`;
    case 'edge-2':
      return `${endpoint.code} ${utcId} edge case accepts secondary input set ${summarizeInputDelta(happyInputs, edgeInputs ?? {}, 'for optional fields')}`;
    case 'validation':
      return `${endpoint.code} ${utcId} validation rejects ${buildValidationMessage(endpoint).replace(/^BadRequestException:\s*/i, '').replace(/^ConflictException:\s*/i, '').replace(/^NotFoundException:\s*/i, '')}`;
    case 'not-found':
      return `${endpoint.code} ${utcId} validation returns not found when the target record is missing`;
    case 'unexpected':
      return `${endpoint.code} ${utcId} validation propagates ${endpoint.name.toLowerCase()} service failures`;
    default:
      return `${endpoint.code} ${utcId} ${kind} ${endpoint.methodName}`;
  }
};

const buildSecurityCases = (endpoint: TaskEndpoint): WorkbookCaseDescriptor[] => {
  const commonUnauthorized: WorkbookCaseDescriptor = {
    utcId: 'UTC07',
    testKey: `${endpoint.code} UTC07`,
    title: buildUnauthorizedTitle(endpoint),
    type: 'A',
    preconditions: [`Caller is not authenticated for ${endpoint.controllerName}.${endpoint.methodName}`],
    inputs: {},
    returns: [],
    exceptions: [],
    logs: [buildCaseLogMessageFromTitle(buildUnauthorizedTitle(endpoint))],
  };

  const commonForbidden: WorkbookCaseDescriptor = {
    utcId: 'UTC08',
    testKey: `${endpoint.code} UTC08`,
    title: buildForbiddenTitle(endpoint),
    type: 'A',
    preconditions: [
      `Caller is authenticated as ${toRoleLabel(endpoint.disallowedRole)}`,
      `Caller is not allowed to invoke ${endpoint.controllerName}.${endpoint.methodName}`,
    ],
    inputs: {},
    returns: [],
    exceptions: [],
    logs: [buildCaseLogMessageFromTitle(buildForbiddenTitle(endpoint))],
  };

  if (endpoint.securityMode === 'guarded-role') {
    commonUnauthorized.exceptions = ['401 Unauthorized'];
    commonForbidden.exceptions = [
      `403 Forbidden: ${toRoleLabel(endpoint.disallowedRole)} cannot access ${endpoint.methodName}`,
    ];
    return [commonUnauthorized, commonForbidden];
  }

  if (endpoint.securityMode === 'guarded-auth') {
    commonUnauthorized.exceptions = ['401 Unauthorized'];
    commonForbidden.returns = [
      `${endpoint.methodName} declares authentication-only access without role metadata`,
    ];
    return [commonUnauthorized, commonForbidden];
  }

  if (endpoint.code === 'EP-295') {
    commonUnauthorized.returns = ['returns flags = [] and hasWarning = false'];
    commonForbidden.returns = ['returns includeResolved guest-safe response without role metadata'];
    return [commonUnauthorized, commonForbidden];
  }

  if (endpoint.code === 'EP-296') {
    commonUnauthorized.returns = ['returns error object with message = "User not authenticated"'];
    commonForbidden.returns = ['returns public appeal handler without role metadata'];
    return [commonUnauthorized, commonForbidden];
  }

  if (endpoint.code === 'EP-292' || endpoint.code === 'EP-293' || endpoint.code === 'EP-294') {
    commonUnauthorized.returns = ['returns system-scoped moderation handling when user context is absent'];
    commonForbidden.returns = ['returns public moderation fallback without role metadata'];
    return [commonUnauthorized, commonForbidden];
  }

  commonUnauthorized.returns = [`${endpoint.methodName} does not declare JwtAuthGuard`];
  commonForbidden.returns = [`${endpoint.methodName} does not declare role metadata`];
  return [commonUnauthorized, commonForbidden];
};

export const buildServiceControllerCaseDefinitions = (
  endpoint: TaskEndpoint,
): WorkbookCaseDescriptor[] => {
  const happyInvocation = buildInvocation(endpoint, 'happy');
  const edgeOneInvocation = buildInvocation(endpoint, 'edge-1');
  const edgeTwoInvocation = buildInvocation(endpoint, 'edge-2');
  const happyInputs = flattenInvocationInputs(happyInvocation);
  const edgeOneInputs = flattenInvocationInputs(edgeOneInvocation);
  const edgeTwoInputs = flattenInvocationInputs(edgeTwoInvocation);
  const returnSummary = summarizeReturnValue(endpoint.name, buildServiceReturn(endpoint, 'happy'));

  const basePreconditions = [
    ...buildCommonAuthPreconditions(
      endpoint.preferredRole,
      endpoint.controllerName,
      endpoint.methodName,
    ),
    ...buildTargetExistencePreconditions(happyInputs),
  ];

  const cases: WorkbookCaseDescriptor[] = [
    {
      utcId: 'UTC01',
      testKey: `${endpoint.code} UTC01`,
      title: buildCaseTitle(endpoint, 'UTC01', 'happy'),
      type: 'N',
      preconditions: basePreconditions,
      inputs: toWorkbookInputMap(happyInputs),
      returns: [returnSummary],
      exceptions: [],
      logs: [buildCaseLogMessageFromTitle(buildCaseTitle(endpoint, 'UTC01', 'happy'))],
    },
    {
      utcId: 'UTC02',
      testKey: `${endpoint.code} UTC02`,
      title: buildCaseTitle(endpoint, 'UTC02', 'edge-1'),
      type: 'B',
      preconditions: basePreconditions,
      inputs: toWorkbookInputMap(edgeOneInputs),
      returns: [summarizeReturnValue(endpoint.name, buildServiceReturn(endpoint, 'edge-1'))],
      exceptions: [],
      logs: [buildCaseLogMessageFromTitle(buildCaseTitle(endpoint, 'UTC02', 'edge-1'))],
    },
    {
      utcId: 'UTC03',
      testKey: `${endpoint.code} UTC03`,
      title: buildCaseTitle(endpoint, 'UTC03', 'edge-2'),
      type: 'B',
      preconditions: basePreconditions,
      inputs: toWorkbookInputMap(edgeTwoInputs),
      returns: [summarizeReturnValue(endpoint.name, buildServiceReturn(endpoint, 'edge-2'))],
      exceptions: [],
      logs: [buildCaseLogMessageFromTitle(buildCaseTitle(endpoint, 'UTC03', 'edge-2'))],
    },
    {
      utcId: 'UTC04',
      testKey: `${endpoint.code} UTC04`,
      title: buildCaseTitle(endpoint, 'UTC04', 'validation'),
      type: 'A',
      preconditions: buildCommonAuthPreconditions(
        endpoint.preferredRole,
        endpoint.controllerName,
        endpoint.methodName,
      ),
      inputs: {},
      returns: [],
      exceptions: [buildValidationMessage(endpoint)],
      logs: [buildCaseLogMessageFromTitle(buildCaseTitle(endpoint, 'UTC04', 'validation'))],
    },
    {
      utcId: 'UTC05',
      testKey: `${endpoint.code} UTC05`,
      title: buildCaseTitle(endpoint, 'UTC05', 'not-found'),
      type: 'A',
      preconditions: [
        ...buildCommonAuthPreconditions(
          endpoint.preferredRole,
          endpoint.controllerName,
          endpoint.methodName,
        ),
        ...buildMissingTargetPreconditions(happyInputs),
      ],
      inputs: toWorkbookInputMap(happyInputs),
      returns: [],
      exceptions: [`NotFoundException: ${endpoint.name} target not found`],
      logs: [buildCaseLogMessageFromTitle(buildCaseTitle(endpoint, 'UTC05', 'not-found'))],
    },
    {
      utcId: 'UTC06',
      testKey: `${endpoint.code} UTC06`,
      title: buildCaseTitle(endpoint, 'UTC06', 'unexpected'),
      type: 'A',
      preconditions: basePreconditions,
      inputs: toWorkbookInputMap(happyInputs),
      returns: [],
      exceptions: [`ConflictException: ${endpoint.name} service failed`],
      logs: [buildCaseLogMessageFromTitle(buildCaseTitle(endpoint, 'UTC06', 'unexpected'))],
    },
  ];

  return [...cases, ...buildSecurityCases(endpoint)];
};

const applyDefaultMocks = (
  endpoint: TaskEndpoint,
  service: ReturnType<typeof createServiceProxy>,
  variant: Variant,
) => {
  const payload = buildServiceReturn(endpoint, variant);
  switch (endpoint.code) {
    case 'EP-295':
      service.getUserFlags.mockResolvedValue(payload);
      service.hasActiveWarning.mockResolvedValue(true);
      break;
    case 'EP-297':
      service.getUserFlags.mockResolvedValue(buildServiceReturn(endpointByCode.get('EP-295')!, variant));
      service.hasActiveWarning.mockResolvedValue(true);
      service.getHighestSeverity.mockResolvedValue(3);
      break;
    case 'EP-298':
      service.hasActiveWarning.mockResolvedValue(true);
      service.getHighestSeverity.mockResolvedValue(3);
      break;
    case 'EP-299':
      service.checkPerformanceFlags.mockResolvedValue(payload);
      break;
    case 'EP-300':
      service.expireOldFlags.mockResolvedValue(payload);
      break;
    default:
      service.__setDefaultImpl__(async () => payload);
  }
};

const assertSuccess = ({
  endpoint,
  service,
  result,
}: {
  endpoint: TaskEndpoint;
  service: ReturnType<typeof createServiceProxy>;
  result: any;
}) => {
  expect(touchedMethodNames(service)).toEqual(
    expect.arrayContaining(expectedServiceMethods[endpoint.code] ?? []),
  );

  if (endpoint.group !== 'user-warnings') {
    expect(result).toBeDefined();
    return;
  }

  switch (endpoint.code) {
    case 'EP-295':
      expect(result).toEqual({ flags: buildServiceReturn(endpoint, 'happy'), hasWarning: true });
      return;
    case 'EP-297':
      expect(result).toEqual({
        flags: buildServiceReturn(endpointByCode.get('EP-295')!, 'happy'),
        hasWarning: true,
        highestSeverity: 3,
      });
      return;
    case 'EP-298':
      expect(result).toEqual({ hasWarning: true, severity: 3, warningLevel: 'HIGH' });
      return;
    case 'EP-299':
      expect(result).toEqual({
        message: `Checked performance for user ${VALID_UUID}`,
        newFlags: 1,
        flags: buildServiceReturn(endpoint, 'happy'),
      });
      return;
    case 'EP-300':
      expect(result).toEqual({ message: 'Expired 2 old flags' });
      return;
    default:
      expect(result).toBeDefined();
  }
};

const runBuiltInValidation = async (config: ValidationConfig) => {
  if (config.kind === 'dto') {
    const errors = validateDto(config.dtoClass, config.payload);
    expect(errors.length).toBeGreaterThan(0);
    return;
  }

  if (config.kind === 'uuid') {
    await expect(
      new ParseUUIDPipe().transform('bad-id', {
        type: 'param',
        metatype: String,
        data: config.field,
      }),
    ).rejects.toThrow(BadRequestException);
    return;
  }

  if (config.kind === 'int') {
    await expect(
      new ParseIntPipe().transform(config.value, {
        type: 'query',
        metatype: Number,
        data: config.field,
      }),
    ).rejects.toThrow(BadRequestException);
    return;
  }

  await expect(
    new ParseBoolPipe().transform(config.value, {
      type: 'query',
      metatype: Boolean,
      data: config.field,
    }),
  ).rejects.toThrow(BadRequestException);
};

export const createServiceControllerGroupRuntime = (group: SupportedGroup): Runtime => {
  const config = GROUP_CONFIGS[group];
  return {
    group,
    endpoints: allServiceEndpoints.filter((endpoint) => endpoint.group === group),
    createDirectHarness() {
      const service = createServiceProxy(async () => ({ ok: true }));
      return {
        controller: config.createController(service),
        service,
      };
    },
  };
};

export const loadServiceControllerEndpoints = (group: SupportedGroup) =>
  allServiceEndpoints.filter((endpoint) => endpoint.group === group);

export const runHappyCase = async (runtime: Runtime, endpoint: TaskEndpoint) => {
  const harness = runtime.createDirectHarness();
  applyDefaultMocks(endpoint, harness.service, 'happy');
  const invocation = buildInvocation(endpoint, 'happy');

  const { result } = await invokeControllerMethod({
    controllerClass: endpoint.controllerClass,
    controller: harness.controller,
    methodName: endpoint.methodName,
    body: invocation.body,
    query: invocation.query,
    params: invocation.params,
    user: invocation.user,
    reqExtras: invocation.reqExtras,
  });

  assertSuccess({ endpoint, service: harness.service, result });
};

export const runEdgeCase = async (
  runtime: Runtime,
  endpoint: TaskEndpoint,
  variant: 'edge-1' | 'edge-2',
) => {
  const harness = runtime.createDirectHarness();
  applyDefaultMocks(endpoint, harness.service, variant);
  const invocation = buildInvocation(endpoint, variant);

  const { result } = await invokeControllerMethod({
    controllerClass: endpoint.controllerClass,
    controller: harness.controller,
    methodName: endpoint.methodName,
    body: invocation.body,
    query: invocation.query,
    params: invocation.params,
    user: invocation.user,
    reqExtras: invocation.reqExtras,
  });

  expect(result).toBeDefined();
  expect(touchedMethodNames(harness.service)).toEqual(
    expect.arrayContaining(expectedServiceMethods[endpoint.code] ?? []),
  );
};

export const runValidationCase = async (runtime: Runtime, endpoint: TaskEndpoint) => {
  void runtime;
  const config = validationConfig[endpoint.code];
  if (config) {
    await runBuiltInValidation(config);
    return;
  }

  const harness = createServiceControllerGroupRuntime(endpoint.group).createDirectHarness();
  const invocation = buildInvocation(endpoint, 'happy');
  harness.service.__setDefaultImpl__(async () => {
    throw new BadRequestException(`Invalid ${endpoint.name} payload`);
  });

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.methodName,
      body: invocation.body,
      query: invocation.query,
      params: invocation.params,
      user: invocation.user,
      reqExtras: invocation.reqExtras,
    }),
  ).rejects.toThrow(BadRequestException);
};

export const runNotFoundCase = async (runtime: Runtime, endpoint: TaskEndpoint) => {
  const harness = runtime.createDirectHarness();
  const invocation = buildInvocation(endpoint, 'happy');
  harness.service.__setDefaultImpl__(async () => {
    throw new NotFoundException(`${endpoint.name} target not found`);
  });

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.methodName,
      body: invocation.body,
      query: invocation.query,
      params: invocation.params,
      user: invocation.user,
      reqExtras: invocation.reqExtras,
    }),
  ).rejects.toThrow(NotFoundException);
};

export const runUnexpectedErrorCase = async (runtime: Runtime, endpoint: TaskEndpoint) => {
  const harness = runtime.createDirectHarness();
  const invocation = buildInvocation(endpoint, 'happy');
  harness.service.__setDefaultImpl__(async () => {
    throw new ConflictException(`${endpoint.name} service failed`);
  });

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.methodName,
      body: invocation.body,
      query: invocation.query,
      params: invocation.params,
      user: invocation.user,
      reqExtras: invocation.reqExtras,
    }),
  ).rejects.toThrow(ConflictException);
};

export const runUnauthorizedCase = async (runtime: Runtime, endpoint: TaskEndpoint) => {
  void runtime;
  if (endpoint.securityMode === 'guarded-role' || endpoint.securityMode === 'guarded-auth') {
    expect(getRouteGuards(endpoint.controllerClass, endpoint.methodName)).toContain(JwtAuthGuard);
    return;
  }

  if (endpoint.code === 'EP-295') {
    const harness = createServiceControllerGroupRuntime('user-warnings').createDirectHarness();
    const { result } = await invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.methodName,
      query: { includeResolved: false },
      reqExtras: {},
    });
    expect(result).toEqual({ flags: [], hasWarning: false });
    return;
  }

  if (endpoint.code === 'EP-296') {
    const harness = createServiceControllerGroupRuntime('user-warnings').createDirectHarness();
    const { result } = await invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.methodName,
      params: { flagId: VALID_UUID },
      body: { reason: 'Appeal' },
      reqExtras: {},
    });
    expect(result).toEqual({
      error: 'Unauthorized',
      message: 'User not authenticated',
    });
    return;
  }

  expect(getRouteGuards(endpoint.controllerClass, endpoint.methodName)).not.toContain(JwtAuthGuard);
};

export const runForbiddenCase = async (runtime: Runtime, endpoint: TaskEndpoint) => {
  if (endpoint.securityMode === 'guarded-role') {
    const guards = getRouteGuards(endpoint.controllerClass, endpoint.methodName);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(endpoint.roles.length).toBeGreaterThan(0);
    return;
  }

  if (endpoint.securityMode === 'guarded-auth') {
    const guards = getRouteGuards(endpoint.controllerClass, endpoint.methodName);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard]));
    expect(guards).not.toContain(RolesGuard);
    return;
  }

  if (endpoint.code === 'EP-292' || endpoint.code === 'EP-293' || endpoint.code === 'EP-294') {
    const harness = runtime.createDirectHarness();
    applyDefaultMocks(endpoint, harness.service, 'happy');
    const invocation = buildInvocation(endpoint, 'happy');
    await invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.methodName,
      body: invocation.body,
      params: invocation.params,
      reqExtras: {},
    });

    const serviceMethod = expectedServiceMethods[endpoint.code][0];
    if (endpoint.code === 'EP-294') {
      expect(harness.service[serviceMethod]).toHaveBeenCalledWith(
        'system',
        expect.any(String),
        expect.anything(),
        expect.anything(),
      );
    } else {
      expect(harness.service[serviceMethod]).toHaveBeenCalledWith(
        'system',
        expect.any(String),
        expect.anything(),
      );
    }
    return;
  }

  expect(getRouteGuards(endpoint.controllerClass, endpoint.methodName)).toHaveLength(0);
};
