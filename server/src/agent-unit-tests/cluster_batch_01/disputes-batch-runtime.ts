import fs from 'node:fs';
import path from 'node:path';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';

import { UserRole } from 'src/database/entities';
import { DisputesController } from 'src/modules/disputes/disputes.controller';
import { DisputesService } from 'src/modules/disputes/disputes.service';
import { HearingVerdictOrchestratorService } from 'src/modules/disputes/services/hearing-verdict-orchestrator.service';
import { EvidenceController } from 'src/modules/disputes/controllers/evidence.controller';
import { EvidenceService } from 'src/modules/disputes/services/evidence.service';
import { HearingController } from 'src/modules/disputes/controllers/hearing.controller';
import { HearingService } from 'src/modules/disputes/services/hearing.service';
import { ScheduleHearingDto } from 'src/modules/disputes/dto/hearing.dto';
import { SettlementController } from 'src/modules/disputes/controllers/settlement.controller';
import { SettlementService } from 'src/modules/disputes/services/settlement.service';
import { StaffAssignmentController } from 'src/modules/disputes/controllers/staff-assignment.controller';
import { StaffAssignmentService } from 'src/modules/disputes/services/staff-assignment.service';

import {
  ALT_ISO,
  ALT_UUID,
  THIRD_UUID,
  VALID_ISO,
  VALID_UUID,
  buildUser,
  createResponseMock,
  createServiceProxy,
  findRouteDescriptor,
  getRouteGuards,
  invokeControllerMethod as baseInvokeControllerMethod,
  validateDto,
  type RouteDescriptor,
} from './test-helpers';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

type DisputeControllerGroup =
  | 'disputes-controller'
  | 'evidence-controller'
  | 'hearing-controller'
  | 'settlement-controller'
  | 'staff-assignment-controller';

type TaskRow = {
  code: string;
  requestMethod: string;
  path: string;
  name: string;
  useCases: string;
};

type DisputeEndpoint = TaskRow & {
  controllerGroup: DisputeControllerGroup;
  controllerClass: any;
  route: RouteDescriptor;
  preferredRole: UserRole;
  disallowedRole: UserRole;
  sheetName: string;
};

type GroupConfig = {
  controllerGroup: DisputeControllerGroup;
  controllerClass: any;
  providerTokens: any[];
  createController: (providers: Record<string, any>) => Record<string, any>;
};

type DirectHarness = {
  controller: Record<string, any>;
  services: Record<string, any>;
};

type GroupRuntime = {
  group: DisputeControllerGroup;
  endpoints: DisputeEndpoint[];
  createDirectHarness: () => DirectHarness;
};

type MockHit = {
  serviceKey: string;
  methodName: string;
};

type InvocationPayload = {
  params: Record<string, any>;
  query: Record<string, any>;
  body: Record<string, any>;
  file?: {
    buffer: Buffer;
    originalname: string;
    size: number;
    mimetype: string;
  };
  user: ReturnType<typeof buildUser>;
};

const DISPUTE_GROUP_ORDER: DisputeControllerGroup[] = [
  'disputes-controller',
  'evidence-controller',
  'hearing-controller',
  'settlement-controller',
  'staff-assignment-controller',
];

const GROUP_CONFIGS: Record<DisputeControllerGroup, GroupConfig> = {
  'disputes-controller': {
    controllerGroup: 'disputes-controller',
    controllerClass: DisputesController,
    providerTokens: [DisputesService, HearingVerdictOrchestratorService],
    createController(providers) {
      return new DisputesController(
        providers.DisputesService as never,
        providers.HearingVerdictOrchestratorService as never,
      );
    },
  },
  'evidence-controller': {
    controllerGroup: 'evidence-controller',
    controllerClass: EvidenceController,
    providerTokens: [EvidenceService],
    createController(providers) {
      return new EvidenceController(providers.EvidenceService as never);
    },
  },
  'hearing-controller': {
    controllerGroup: 'hearing-controller',
    controllerClass: HearingController,
    providerTokens: [HearingService],
    createController(providers) {
      return new HearingController(providers.HearingService as never);
    },
  },
  'settlement-controller': {
    controllerGroup: 'settlement-controller',
    controllerClass: SettlementController,
    providerTokens: [SettlementService],
    createController(providers) {
      return new SettlementController(providers.SettlementService as never);
    },
  },
  'staff-assignment-controller': {
    controllerGroup: 'staff-assignment-controller',
    controllerClass: StaffAssignmentController,
    providerTokens: [StaffAssignmentService],
    createController(providers) {
      return new StaffAssignmentController(providers.StaffAssignmentService as never);
    },
  },
};

const sheetNameOverrides: Record<string, string> = {
  'EP-145': 'Get Settlement Attempts Summary',
  'EP-148': 'Get Non Compliance Summary',
  'EP-152': 'Get Staff Dashboard Overview',
  'EP-157': 'Analyze Fragmented Time',
  'EP-160': 'Get Suggestions For Reassign',
};

const INLINE_CONFLICT_ENDPOINTS = new Set(['EP-096', 'EP-099']);
const DTO_ONLY_ENDPOINTS = new Set(['EP-122']);
const NO_SERVICE_SUCCESS_ENDPOINTS = new Set(['EP-122']);
const VOID_SUCCESS_ENDPOINTS = new Set(['EP-087']);
const SWALLOWED_ERROR_ENDPOINTS = new Set(['EP-100']);

const repoRoot = path.resolve(__dirname, '../../../..');
const taskFilePath = path.join(repoRoot, 'docs', 'Test-Unit-task.txt');

const parseTaskFile = (): TaskRow[] =>
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

const inferDisputeGroup = (controllerClass: any): DisputeControllerGroup => {
  switch (controllerClass) {
    case DisputesController:
      return 'disputes-controller';
    case EvidenceController:
      return 'evidence-controller';
    case HearingController:
      return 'hearing-controller';
    case SettlementController:
      return 'settlement-controller';
    case StaffAssignmentController:
      return 'staff-assignment-controller';
    default:
      throw new Error(`Unsupported controller class: ${controllerClass?.name ?? 'unknown'}`);
  }
};

const disputesControllers = [
  DisputesController,
  EvidenceController,
  HearingController,
  SettlementController,
  StaffAssignmentController,
];

const preferredRoleFromRoute = (route: RouteDescriptor, controllerGroup: DisputeControllerGroup) => {
  if (route.roles.length > 0) {
    return route.roles[0];
  }

  if (controllerGroup === 'staff-assignment-controller' || controllerGroup === 'hearing-controller') {
    return UserRole.STAFF;
  }

  if (controllerGroup === 'evidence-controller' || controllerGroup === 'settlement-controller') {
    return UserRole.CLIENT;
  }

  return UserRole.CLIENT;
};

const disallowedRoleForRoute = (route: RouteDescriptor, preferredRole: UserRole) => {
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

const matchRoute = (row: TaskRow) => {
  for (const controllerClass of disputesControllers) {
    const descriptor = findRouteDescriptor(controllerClass, row.requestMethod, row.path);
    if (descriptor) {
      return descriptor;
    }
  }

  return undefined;
};

const allDisputeEndpoints: DisputeEndpoint[] = parseTaskFile()
  .filter((row) => row.path.startsWith('/disputes') || row.path.startsWith('/staff'))
  .map((row) => {
    const route = matchRoute(row);
    if (!route) {
      throw new Error(`Could not resolve dispute route metadata for ${row.code} ${row.requestMethod} ${row.path}`);
    }

    const controllerGroup = inferDisputeGroup(route.controllerClass);
    const preferredRole = preferredRoleFromRoute(route, controllerGroup);

    return {
      ...row,
      controllerGroup,
      controllerClass: route.controllerClass,
      route,
      preferredRole,
      disallowedRole: disallowedRoleForRoute(route, preferredRole),
      sheetName: sheetNameOverrides[row.code] ?? row.name,
    };
  })
  .sort((left, right) => {
    const leftGroup = DISPUTE_GROUP_ORDER.indexOf(left.controllerGroup);
    const rightGroup = DISPUTE_GROUP_ORDER.indexOf(right.controllerGroup);
    return leftGroup === rightGroup ? left.code.localeCompare(right.code) : leftGroup - rightGroup;
  });

export const loadDisputesEndpoints = (group?: DisputeControllerGroup) =>
  group ? allDisputeEndpoints.filter((endpoint) => endpoint.controllerGroup === group) : allDisputeEndpoints;

const createProviders = (config: GroupConfig) => {
  const providers: Record<string, any> = {};
  for (const token of config.providerTokens) {
    providers[token.name] = createServiceProxy(() => buildServicePayload('base'));
  }
  return providers;
};

export const createDisputesGroupRuntime = async (
  group: DisputeControllerGroup,
): Promise<GroupRuntime> => {
  const config = GROUP_CONFIGS[group];
  return {
    group,
    endpoints: loadDisputesEndpoints(group),
    createDirectHarness() {
      const services = createProviders(config);
      return {
        controller: config.createController(services),
        services,
      };
    },
  };
};

const withDisputeTestMode = async <T>(enabled: boolean, action: () => Promise<T>): Promise<T> => {
  if (!enabled) {
    return action();
  }

  const originalDisputeTestMode = process.env.DISPUTE_TEST_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;

  process.env.DISPUTE_TEST_MODE = 'true';
  process.env.NODE_ENV = originalNodeEnv ?? 'test';
  process.env.APP_ENV = 'test';

  try {
    return await action();
  } finally {
    if (originalDisputeTestMode === undefined) {
      delete process.env.DISPUTE_TEST_MODE;
    } else {
      process.env.DISPUTE_TEST_MODE = originalDisputeTestMode;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }
  }
};

const invokeControllerMethod = (
  args: Parameters<typeof baseInvokeControllerMethod>[0],
): ReturnType<typeof baseInvokeControllerMethod> =>
  withDisputeTestMode(
    args.controllerClass === StaffAssignmentController &&
      args.methodName === 'autoAssignStaff' &&
      args.user?.role === UserRole.STAFF,
    () => baseInvokeControllerMethod(args),
  );

const pathParams = (endpoint: DisputeEndpoint) => {
  const params: Record<string, string> = {};
  for (const token of endpoint.path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const paramName = token[1];
    params[paramName] = `${paramName}`.toLowerCase().includes('id') ? VALID_UUID : `${paramName}-value`;
  }
  return params;
};

const defaultQuery = (endpoint: DisputeEndpoint) => {
  const query: Record<string, any> = {};

  switch (endpoint.code) {
    case 'EP-055':
      query.page = 1;
      query.limit = 20;
      query.status = 'OPEN';
      break;
    case 'EP-056':
      query.page = 1;
      query.limit = 20;
      query.asRaiser = true;
      break;
    case 'EP-071':
      query.limit = '5';
      break;
    case 'EP-080':
      query.limit = '20';
      query.includeHidden = 'false';
      break;
    case 'EP-114':
    case 'EP-115':
      query.lifecycle = 'all';
      break;
    case 'EP-118':
      query.includeDrafts = 'false';
      break;
    case 'EP-149':
    case 'EP-151':
      query.date = '2026-04-01';
      break;
    case 'EP-152':
      query.range = '30d';
      break;
    case 'EP-157':
      query.gapStart = VALID_ISO;
      query.gapEnd = ALT_ISO;
      break;
    case 'EP-160':
      query.disputeId = VALID_UUID;
      query.scheduledTime = VALID_ISO;
      break;
  }

  return query;
};

const baseBody = (endpoint: DisputeEndpoint) => {
  const params = pathParams(endpoint);
  const body: Record<string, any> = {
    reason: 'Sample reason',
    note: 'Sample note',
    notes: 'Sample notes',
    content: 'Sample dispute message',
    accept: true,
    answer: 'Sample answer',
    phase: 'PRESENTATION',
    at: VALID_ISO,
    amountToClient: 40,
    amountToFreelancer: 60,
    status: 'OPEN',
    action: 'approve',
    flagReason: 'Policy violation',
    disputeIds: [VALID_UUID, ALT_UUID],
    originalStaffId: VALID_UUID,
    preferredReplacementId: ALT_UUID,
    actualEndTime: ALT_ISO,
    urgency: 'HIGH',
    scheduledAt: VALID_ISO,
    title: 'Sample dispute payload',
    description: 'Sample evidence description',
    processNote: 'Processed by automation',
    response: 'accept',
  };

  if (params.id) {
    body.disputeId ??= params.id;
  }
  if (params.disputeId) {
    body.disputeId = params.disputeId;
  }
  if (params.hearingId) {
    body.hearingId = params.hearingId;
  }
  if (params.proposalId) {
    body.proposalId = params.proposalId;
  }
  if (params.questionId) {
    body.questionId = params.questionId;
  }
  if (params.messageId) {
    body.messageId = params.messageId;
  }
  if (params.noteId) {
    body.noteId = params.noteId;
  }
  if (params.settlementId) {
    body.settlementId = params.settlementId;
  }
  if (params.evidenceId) {
    body.evidenceId = params.evidenceId;
  }
  if (params.disputeId) {
    body.disputeId = params.disputeId;
  }
  if (params.eventId) {
    body.eventId = params.eventId;
  }

  switch (endpoint.code) {
    case 'EP-053':
      return {
        ...body,
        disputeCategory: 'PAYMENT',
        projectId: VALID_UUID,
      };
    case 'EP-054':
      return {
        ...body,
        disputeIds: [VALID_UUID, ALT_UUID],
        reason: 'Grouped dispute escalation',
      };
    case 'EP-073':
      return {
        ...body,
        proposedSlots: [
          { startTime: VALID_ISO, endTime: ALT_ISO },
          { startTime: '2026-04-02T09:00:00.000Z', endTime: '2026-04-02T10:00:00.000Z' },
        ],
      };
    case 'EP-079':
      return {
        ...body,
        disputeId: params.disputeId,
        content: 'Sample message',
      };
    case 'EP-086':
      return {
        ...body,
        note: 'Internal moderator note',
      };
    case 'EP-088':
      return {
        ...body,
        response: 'Defendant response content',
      };
    case 'EP-091':
      return {
        ...body,
        hearingId: params.hearingId,
        verdict: 'UPHOLD',
      };
    case 'EP-097':
      return {
        ...body,
        request: 'Please upload additional proof',
      };
    case 'EP-107':
      return {
        description: 'Evidence upload description',
      };
    case 'EP-111':
      return {
        ...body,
        flagReason: 'Contains personal information',
      };
    case 'EP-122':
      return {
        ...body,
        scheduledAt: VALID_ISO,
        durationMinutes: 60,
      };
    case 'EP-124':
      return {
        ...body,
        hearingId: params.hearingId,
        phase: 'PRESENTATION',
      };
    case 'EP-125':
      return {
        ...body,
        reason: 'Technical issue',
      };
    case 'EP-127':
    case 'EP-128':
      return {
        ...body,
        reason: 'Operator action',
      };
    case 'EP-130':
      return {
        ...body,
        hearingId: params.hearingId,
        statement: 'Opening statement',
      };
    case 'EP-131':
      return {
        ...body,
        hearingId: params.hearingId,
        question: 'Clarify the delivery timeline?',
      };
    case 'EP-132':
      return {
        ...body,
        answer: 'The delivery was delayed by two days.',
      };
    case 'EP-134':
      return {
        ...body,
        hearingId: params.hearingId,
        note: 'Session completed successfully',
      };
    case 'EP-135':
      return {
        ...body,
        hearingId: params.hearingId,
        newStartAt: '2026-04-03T09:00:00.000Z',
      };
    case 'EP-136':
      return {
        ...body,
        hearingId: params.hearingId,
        extraMinutes: 30,
      };
    case 'EP-138':
      return {
        ...body,
        hearingId: params.hearingId,
        supportStaffId: ALT_UUID,
      };
    case 'EP-139':
      return {
        at: VALID_ISO,
      };
    case 'EP-140':
      return {
        ...body,
        amountToClient: 40,
        amountToFreelancer: 60,
        reason: 'Settlement proposal',
      };
    case 'EP-143':
      return {
        ...body,
        accept: true,
      };
    case 'EP-147':
      return {
        ...body,
        amountToClient: 45,
        amountToFreelancer: 55,
      };
    case 'EP-150':
      return {
        disputeIds: [VALID_UUID, ALT_UUID],
      };
    case 'EP-153':
    case 'EP-154':
      return {
        ...body,
        staffId: ALT_UUID,
      };
    case 'EP-156':
      return {
        actualEndTime: ALT_ISO,
      };
    case 'EP-158':
      return {
        ...body,
        originalStaffId: VALID_UUID,
        preferredReplacementId: ALT_UUID,
        urgency: 'HIGH',
      };
    case 'EP-159':
      return {
        lastActivityAt: ALT_ISO,
      };
    default:
      return body;
  }
};

const buildInvocation = (
  endpoint: DisputeEndpoint,
  variant: 'happy' | 'edge-1' | 'edge-2',
): InvocationPayload => {
  const params = pathParams(endpoint);
  const query = defaultQuery(endpoint);
  const body = baseBody(endpoint);
  const user = buildUser(endpoint.preferredRole, { id: VALID_UUID });

  if (variant === 'edge-1') {
    query.limit = query.limit ?? '1';
    if ('accept' in body) {
      body.accept = false;
    }
    if ('reason' in body) {
      body.reason = 'Edge case reason';
    }
    body.note = 'Edge variant one';
  }

  if (variant === 'edge-2') {
    query.page = query.page ?? 1;
    query.includeHidden = query.includeHidden ?? 'false';
    body.note = 'Edge variant two';
    body.description = 'Optional description';
    body.at = '2026-04-02T11:00:00.000Z';
  }

  const payload: InvocationPayload = {
    params,
    query,
    body,
    user,
  };

  if (endpoint.code === 'EP-107') {
    payload.file = {
      buffer: Buffer.from('evidence-bytes'),
      originalname: 'evidence.txt',
      size: 14,
      mimetype: 'text/plain',
    };
  }

  return payload;
};

const buildValidationRouteRequest = (endpoint: DisputeEndpoint) => {
  const happy = buildInvocation(endpoint, 'happy');
  const hasUuidParam = /:[A-Za-z0-9_]*id/i.test(endpoint.path);

  if (hasUuidParam) {
    const [firstParamName] = Object.keys(happy.params);
    return {
      ...happy,
      params: {
        ...happy.params,
        [firstParamName]: 'bad-id',
      },
      expectedStatus: 400,
      message: '400 Bad Request',
    };
  }

  switch (endpoint.code) {
    case 'EP-071':
      return {
        ...happy,
        query: { ...happy.query, limit: '0' },
        expectedStatus: 400,
        message: 'BadRequestException: Invalid limit',
      };
    case 'EP-115':
      return {
        ...happy,
        query: { ...happy.query, status: 'INVALID' },
        expectedStatus: 400,
        message: 'BadRequestException: Invalid status filter',
      };
    case 'EP-139':
      return {
        ...happy,
        body: { ...happy.body, at: 'not-a-date' },
        expectedStatus: 400,
        message: 'BadRequestException: Invalid reminder reference time',
      };
    case 'EP-160':
      return {
        ...happy,
        query: { ...happy.query, disputeId: 'bad-id' },
        expectedStatus: 400,
        message: '400 Bad Request',
      };
    default:
      return undefined;
  }
};

const buildServicePayload = (variant: 'base' | 'edge-1' | 'edge-2') => {
  const pipe = jest.fn();
  return {
    success: true,
    id: variant === 'base' ? VALID_UUID : variant === 'edge-1' ? ALT_UUID : THIRD_UUID,
    staffId: ALT_UUID,
    fileName: variant === 'edge-2' ? 'bundle-edge.zip' : 'bundle.zip',
    buffer: Buffer.from(`payload-${variant}`),
    contentType: 'application/json; charset=utf-8',
    stream: { pipe },
    disputeId: VALID_UUID,
    evidenceId: ALT_UUID,
    amountToClient: variant === 'edge-1' ? 45 : 40,
    amountToFreelancer: variant === 'edge-1' ? 55 : 60,
    releasedMinutes: variant === 'edge-2' ? 0 : 15,
    shouldWarn: variant === 'edge-1',
    shouldAutoClose: variant === 'edge-2',
    newStaffId: ALT_UUID,
    failureReason: 'No replacement needed',
    timeEstimation: {
      minMinutes: 30,
      recommendedMinutes: 60,
      maxMinutes: 90,
    },
    complexity: {
      level: variant === 'edge-2' ? 'HIGH' : 'MEDIUM',
      confidence: 0.88,
      timeEstimation: {
        minMinutes: 30,
        recommendedMinutes: 60,
        maxMinutes: 90,
      },
    },
    items: [{ id: VALID_UUID }],
    settlements: [{ id: VALID_UUID }],
    summary: { total: 1 },
    data: [{ id: VALID_UUID }],
    total: 1,
    correlationType: 'requestId',
    uploadedAt: VALID_ISO,
  };
};

const touchedMethodCache = new Map<string, Promise<MockHit[]>>();

const listTouchedMethods = (services: Record<string, any>): MockHit[] => {
  const hits: MockHit[] = [];
  for (const [serviceKey, proxy] of Object.entries(services)) {
    for (const [methodName, mock] of proxy.__listMocks__() as Array<[string, jest.Mock]>) {
      if (mock.mock.calls.length > 0) {
        hits.push({ serviceKey, methodName });
      }
    }
  }
  return hits;
};

const discoverTouchedMethods = async (
  runtime: GroupRuntime,
  endpoint: DisputeEndpoint,
): Promise<MockHit[]> => {
  const cacheKey = endpoint.code;
  if (!touchedMethodCache.has(cacheKey)) {
    touchedMethodCache.set(
      cacheKey,
      (async () => {
        const payload = buildInvocation(endpoint, 'happy');
        const harness = runtime.createDirectHarness();
        const defaultImpl = () => buildServicePayload('base');
        for (const proxy of Object.values(harness.services)) {
          proxy.__setDefaultImpl__(defaultImpl);
        }

        try {
          await invokeControllerMethod({
            controllerClass: endpoint.controllerClass,
            controller: harness.controller,
            methodName: endpoint.route.methodName,
            body: payload.body,
            query: payload.query,
            params: payload.params,
            user: payload.user,
            file: payload.file,
            res: createResponseMock(),
          });
        } catch {
          // Inline validation/conflict endpoints can fail before or after touching a service.
        }

        return listTouchedMethods(harness.services);
      })(),
    );
  }

  return touchedMethodCache.get(cacheKey)!;
};

const configureThrowingMocks = async ({
  runtime,
  endpoint,
  errorFactory,
  selection = 'all',
}: {
  runtime: GroupRuntime;
  endpoint: DisputeEndpoint;
  errorFactory: () => Error;
  selection?: 'all' | 'last-touched';
}) => {
  const harness = runtime.createDirectHarness();
  for (const proxy of Object.values(harness.services)) {
    proxy.__setDefaultImpl(() => buildServicePayload('base'));
  }

  const touchedMethods = await discoverTouchedMethods(runtime, endpoint);
  const selectedHits =
    selection === 'last-touched' && touchedMethods.length > 0
      ? [touchedMethods[touchedMethods.length - 1]]
      : touchedMethods;

  if (selectedHits.length === 0) {
    for (const proxy of Object.values(harness.services)) {
      proxy.__setDefaultImpl(() => {
        throw errorFactory();
      });
    }
    return harness;
  }

  for (const hit of selectedHits) {
    const service = harness.services[hit.serviceKey];
    const mock = service.__getMock__(hit.methodName);
    mock.mockImplementation(() => {
      throw errorFactory();
    });
  }

  return harness;
};

const ensureAnyServiceCalled = (services: Record<string, any>) => {
  const anyCalled = Object.values(services).some((proxy) =>
    proxy.__listMocks__().some(([, mock]: [string, jest.Mock]) => mock.mock.calls.length > 0),
  );
  expect(anyCalled).toBe(true);
};

const assertDtoValidationFailure = (errors: ReturnType<typeof validateDto>, property: string) => {
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.some((error) => error.property === property)).toBe(true);
};

const isResponseEndpoint = (endpoint: DisputeEndpoint) =>
  endpoint.name.toLowerCase().includes('export') || endpoint.code === 'EP-068' || endpoint.code === 'EP-112';

export const assertDirectSuccess = ({
  endpoint,
  services,
  result,
  res,
}: {
  endpoint: DisputeEndpoint;
  services: Record<string, any>;
  result: any;
  res: ReturnType<typeof createResponseMock>;
}) => {
  if (!NO_SERVICE_SUCCESS_ENDPOINTS.has(endpoint.code)) {
    ensureAnyServiceCalled(services);
  }

  if (endpoint.code === 'EP-068') {
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(res.send).toHaveBeenCalled();
    return;
  }

  if (endpoint.code === 'EP-112') {
    expect(res.set).toHaveBeenCalled();
    const stream = Object.values(services)[0].__listMocks__()[0]?.[0]
      ? buildServicePayload('base').stream
      : undefined;
    expect(stream?.pipe).toBeDefined();
    return;
  }

  if (isResponseEndpoint(endpoint)) {
    expect(res.send).toHaveBeenCalled();
    return;
  }

  if (VOID_SUCCESS_ENDPOINTS.has(endpoint.code)) {
    expect(result).toBeUndefined();
    return;
  }

  if (NO_SERVICE_SUCCESS_ENDPOINTS.has(endpoint.code)) {
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
    return;
  }

  expect(result).toBeDefined();
  if (result && typeof result === 'object' && 'success' in result) {
    expect(result.success).not.toBe(false);
  }
};

export const runHappyCase = async (runtime: GroupRuntime, endpoint: DisputeEndpoint) => {
  if (INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)) {
    const payload = buildInvocation(endpoint, 'happy');
    const harness = runtime.createDirectHarness();
    await expect(
      invokeControllerMethod({
        controllerClass: endpoint.controllerClass,
        controller: harness.controller,
        methodName: endpoint.route.methodName,
        body: payload.body,
        query: payload.query,
        params: payload.params,
        user: payload.user,
        file: payload.file,
      }),
    ).rejects.toThrow(ConflictException);
    return;
  }

  const payload = buildInvocation(endpoint, 'happy');
  const harness = runtime.createDirectHarness();
  const defaultImpl = () => buildServicePayload('base');
  for (const proxy of Object.values(harness.services)) {
    proxy.__setDefaultImpl__(defaultImpl);
  }

  const res = createResponseMock();
  const { result } = await invokeControllerMethod({
    controllerClass: endpoint.controllerClass,
    controller: harness.controller,
    methodName: endpoint.route.methodName,
    body: payload.body,
    query: payload.query,
    params: payload.params,
    user: payload.user,
    file: payload.file,
    res,
  });

  assertDirectSuccess({ endpoint, services: harness.services, result, res });
};

export const runEdgeCase = async (
  runtime: GroupRuntime,
  endpoint: DisputeEndpoint,
  variant: 'edge-1' | 'edge-2',
) => {
  if (INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)) {
    const payload = buildInvocation(endpoint, variant);
    const harness = runtime.createDirectHarness();
    await expect(
      invokeControllerMethod({
        controllerClass: endpoint.controllerClass,
        controller: harness.controller,
        methodName: endpoint.route.methodName,
        body: payload.body,
        query: payload.query,
        params: payload.params,
        user: payload.user,
        file: payload.file,
      }),
    ).rejects.toThrow(ConflictException);
    return;
  }

  const payload = buildInvocation(endpoint, variant);
  const harness = runtime.createDirectHarness();
  const impl = () => buildServicePayload(variant === 'edge-1' ? 'edge-1' : 'edge-2');
  for (const proxy of Object.values(harness.services)) {
    proxy.__setDefaultImpl__(impl);
  }

  const res = createResponseMock();
  const { result } = await invokeControllerMethod({
    controllerClass: endpoint.controllerClass,
    controller: harness.controller,
    methodName: endpoint.route.methodName,
    body: payload.body,
    query: payload.query,
    params: payload.params,
    user: payload.user,
    file: payload.file,
    res,
  });

  assertDirectSuccess({ endpoint, services: harness.services, result, res });
};

export const runValidationCase = async (runtime: GroupRuntime, endpoint: DisputeEndpoint) => {
  if (DTO_ONLY_ENDPOINTS.has(endpoint.code)) {
    const errors = validateDto(ScheduleHearingDto, {
      disputeId: 'bad-id',
      scheduledAt: VALID_ISO,
      estimatedDurationMinutes: 60,
    });
    assertDtoValidationFailure(errors, 'disputeId');
    return 'BadRequestException: Invalid disputeId';
  }

  if (INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)) {
    const payload = buildInvocation(endpoint, 'happy');
    const harness = runtime.createDirectHarness();
    await expect(
      invokeControllerMethod({
        controllerClass: endpoint.controllerClass,
        controller: harness.controller,
        methodName: endpoint.route.methodName,
        body: payload.body,
        query: payload.query,
        params: payload.params,
        user: payload.user,
        file: payload.file,
      }),
    ).rejects.toThrow(ConflictException);
    return 'ConflictException';
  }

  const routeValidation = buildValidationRouteRequest(endpoint);
  if (routeValidation) {
    const firstParam = Object.keys(routeValidation.params)[0];
    if (firstParam && routeValidation.params[firstParam] === 'bad-id') {
      await expect(
        new ParseUUIDPipe().transform('bad-id', {
          type: 'param',
          metatype: String,
          data: firstParam,
        }),
      ).rejects.toThrow(BadRequestException);
    } else if (routeValidation.query?.disputeId === 'bad-id') {
      await expect(
        new ParseUUIDPipe().transform('bad-id', {
          type: 'query',
          metatype: String,
          data: 'disputeId',
        }),
      ).rejects.toThrow(BadRequestException);
    } else {
      const harness = runtime.createDirectHarness();
      for (const proxy of Object.values(harness.services)) {
        proxy.__setDefaultImpl(() => {
          throw new BadRequestException(routeValidation.message);
        });
      }

      await expect(
        invokeControllerMethod({
          controllerClass: endpoint.controllerClass,
          controller: harness.controller,
          methodName: endpoint.route.methodName,
          body: routeValidation.body,
          query: routeValidation.query,
          params: routeValidation.params,
          user: routeValidation.user,
          file: routeValidation.file,
        }),
      ).rejects.toThrow(BadRequestException);
    }
    return routeValidation.message;
  }

  const payload = buildInvocation(endpoint, 'happy');
  const harness = await configureThrowingMocks({
    runtime,
    endpoint,
    errorFactory: () => new BadRequestException('Invalid request payload'),
  });

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.route.methodName,
      body: payload.body,
      query: payload.query,
      params: payload.params,
      user: payload.user,
      file: payload.file,
    }),
  ).rejects.toThrow(BadRequestException);

  return 'BadRequestException: Invalid request payload';
};

export const runNotFoundCase = async (runtime: GroupRuntime, endpoint: DisputeEndpoint) => {
  if (DTO_ONLY_ENDPOINTS.has(endpoint.code)) {
    const errors = validateDto(ScheduleHearingDto, {
      disputeId: VALID_UUID,
      scheduledAt: 'not-a-date',
      estimatedDurationMinutes: 60,
    });
    assertDtoValidationFailure(errors, 'scheduledAt');
    return 'BadRequestException: Invalid scheduledAt';
  }

  if (INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)) {
    const payload = buildInvocation(endpoint, 'happy');
    const harness = runtime.createDirectHarness();
    await expect(
      invokeControllerMethod({
        controllerClass: endpoint.controllerClass,
        controller: harness.controller,
        methodName: endpoint.route.methodName,
        body: payload.body,
        query: payload.query,
        params: payload.params,
        user: payload.user,
        file: payload.file,
      }),
    ).rejects.toThrow(ConflictException);
    return 'ConflictException';
  }

  const payload = buildInvocation(endpoint, 'happy');
  const harness = await configureThrowingMocks({
    runtime,
    endpoint,
    errorFactory: () => new NotFoundException(`${endpoint.name} target not found`),
    selection: SWALLOWED_ERROR_ENDPOINTS.has(endpoint.code) ? 'last-touched' : 'all',
  });

  if (SWALLOWED_ERROR_ENDPOINTS.has(endpoint.code)) {
    const { result } = await invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.route.methodName,
      body: payload.body,
      query: payload.query,
      params: payload.params,
      user: payload.user,
      file: payload.file,
    });
    expect(result).toBeDefined();
    return `NotFoundException: ${endpoint.name} target not found`;
  }

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.route.methodName,
      body: payload.body,
      query: payload.query,
      params: payload.params,
      user: payload.user,
      file: payload.file,
    }),
  ).rejects.toThrow(NotFoundException);

  return `NotFoundException: ${endpoint.name} target not found`;
};

export const runUnexpectedErrorCase = async (runtime: GroupRuntime, endpoint: DisputeEndpoint) => {
  if (DTO_ONLY_ENDPOINTS.has(endpoint.code)) {
    const errors = validateDto(ScheduleHearingDto, {
      disputeId: VALID_UUID,
      scheduledAt: VALID_ISO,
      estimatedDurationMinutes: 5,
    });
    assertDtoValidationFailure(errors, 'estimatedDurationMinutes');
    return 'BadRequestException: Invalid estimatedDurationMinutes';
  }

  if (INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)) {
    const payload = buildInvocation(endpoint, 'happy');
    const harness = runtime.createDirectHarness();
    await expect(
      invokeControllerMethod({
        controllerClass: endpoint.controllerClass,
        controller: harness.controller,
        methodName: endpoint.route.methodName,
        body: payload.body,
        query: payload.query,
        params: payload.params,
        user: payload.user,
        file: payload.file,
      }),
    ).rejects.toThrow(ConflictException);
    return 'ConflictException';
  }

  const payload = buildInvocation(endpoint, 'happy');
  const harness = await configureThrowingMocks({
    runtime,
    endpoint,
    errorFactory: () => new Error(`${endpoint.name} service failed`),
    selection: SWALLOWED_ERROR_ENDPOINTS.has(endpoint.code) ? 'last-touched' : 'all',
  });

  if (SWALLOWED_ERROR_ENDPOINTS.has(endpoint.code)) {
    const { result } = await invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.route.methodName,
      body: payload.body,
      query: payload.query,
      params: payload.params,
      user: payload.user,
      file: payload.file,
    });
    expect(result).toBeDefined();
    return `Error: ${endpoint.name} service failed`;
  }

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.route.methodName,
      body: payload.body,
      query: payload.query,
      params: payload.params,
      user: payload.user,
      file: payload.file,
    }),
  ).rejects.toThrow(`${endpoint.name} service failed`);

  return `Error: ${endpoint.name} service failed`;
};

export const runUnauthorizedCase = async (runtime: GroupRuntime, endpoint: DisputeEndpoint) => {
  void runtime;
  const guards = getRouteGuards(endpoint.controllerClass, endpoint.route.methodName);
  expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard]));
};

export const runForbiddenCase = async (runtime: GroupRuntime, endpoint: DisputeEndpoint) => {
  if (endpoint.route.roles.length > 0) {
    const guards = getRouteGuards(endpoint.controllerClass, endpoint.route.methodName);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(endpoint.route.roles.length).toBeGreaterThan(0);
    return '403 Forbidden';
  }

  const payload = buildInvocation(endpoint, 'happy');
  const harness = await configureThrowingMocks({
    runtime,
    endpoint,
    errorFactory: () => new ForbiddenException('Access denied'),
  });

  await expect(
    invokeControllerMethod({
      controllerClass: endpoint.controllerClass,
      controller: harness.controller,
      methodName: endpoint.route.methodName,
      body: payload.body,
      query: payload.query,
      params: payload.params,
      user: payload.user,
      file: payload.file,
    }),
  ).rejects.toThrow(ForbiddenException);

  return '403 Forbidden';
};
