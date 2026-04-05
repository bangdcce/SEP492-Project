import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { UserRole } from 'src/database/entities';
import { AdminDashboardController } from 'src/modules/admin-dashboard/admin-dashboard.controller';
import { AuditLogsController } from 'src/modules/audit-logs/audit-logs.controller';
import { CalendarController } from 'src/modules/calendar/calendar.controller';
import { DisputesController } from 'src/modules/disputes/disputes.controller';
import { EvidenceController } from 'src/modules/disputes/controllers/evidence.controller';
import { HearingController } from 'src/modules/disputes/controllers/hearing.controller';
import { SettlementController } from 'src/modules/disputes/controllers/settlement.controller';
import { StaffAssignmentController } from 'src/modules/disputes/controllers/staff-assignment.controller';

import { loadDisputesEndpoints } from './disputes-batch-runtime';
import { findRouteDescriptor } from './test-helpers';

type TaskRow = {
  code: string;
  requestMethod: string;
  path: string;
  name: string;
  useCases: string;
};

type EndpointMeta = TaskRow & {
  controllerName: string;
  controllerFile: string;
  methodName: string;
  roles: UserRole[];
  preferredRole: UserRole;
  sheetName: string;
};

type WorkbookFunction = {
  function_code: string;
  class_name: string;
  function_name: string;
  sheet_name: string;
  test_requirement: string;
  loc: number | '';
  created_by: string;
  executed_by: string;
  cases: Array<Record<string, unknown>>;
};

const repoRoot = path.resolve(__dirname, '../../../..');
const docsRoot = path.resolve(repoRoot, 'docs');
const outputRoot = path.resolve(docsRoot, 'Unit Testing Excel', 'DangChiBang_batch_01');
const taskFile = path.resolve(docsRoot, 'Test-Unit-task.txt');

const CREATED_BY = 'Đặng Chí Bằng';
const REVIEWER = 'Ngô Thái Sơn';
const ISSUE_DATE = '2026-03-29';
const EXECUTED_DATE = '03/29';
const PROJECT_NAME = 'Edu Resource Management';
const PROJECT_CODE = 'ERM';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ALT_UUID = '22222222-2222-4222-8222-222222222222';
const THIRD_UUID = '33333333-3333-4333-8333-333333333333';

const INLINE_CONFLICT_ENDPOINTS = new Set(['EP-096', 'EP-099']);
const DTO_ONLY_ENDPOINTS = new Set(['EP-122']);
const VOID_SUCCESS_ENDPOINTS = new Set(['EP-087']);

const controllerFiles: Record<string, string> = {
  AdminDashboardController: path.resolve(
    repoRoot,
    'server/src/modules/admin-dashboard/admin-dashboard.controller.ts',
  ),
  AuditLogsController: path.resolve(
    repoRoot,
    'server/src/modules/audit-logs/audit-logs.controller.ts',
  ),
  CalendarController: path.resolve(repoRoot, 'server/src/modules/calendar/calendar.controller.ts'),
  DisputesController: path.resolve(repoRoot, 'server/src/modules/disputes/disputes.controller.ts'),
  EvidenceController: path.resolve(
    repoRoot,
    'server/src/modules/disputes/controllers/evidence.controller.ts',
  ),
  HearingController: path.resolve(
    repoRoot,
    'server/src/modules/disputes/controllers/hearing.controller.ts',
  ),
  SettlementController: path.resolve(
    repoRoot,
    'server/src/modules/disputes/controllers/settlement.controller.ts',
  ),
  StaffAssignmentController: path.resolve(
    repoRoot,
    'server/src/modules/disputes/controllers/staff-assignment.controller.ts',
  ),
};

const calendarCodes = ['EP-031', 'EP-032', 'EP-033', 'EP-034', 'EP-035', 'EP-036', 'EP-037'];
const auditCodes = ['EP-004', 'EP-005', 'EP-007', 'EP-008'];
const adminCodes = ['EP-003'];

const controllerSearchOrder = [AdminDashboardController, AuditLogsController, CalendarController];

const defaultRoleFallback: Record<string, UserRole> = {
  AdminDashboardController: UserRole.ADMIN,
  AuditLogsController: UserRole.ADMIN,
  CalendarController: UserRole.CLIENT,
  DisputesController: UserRole.CLIENT,
  EvidenceController: UserRole.CLIENT,
  HearingController: UserRole.ADMIN,
  SettlementController: UserRole.CLIENT,
  StaffAssignmentController: UserRole.STAFF,
};

const defaultQueryHints: Record<string, string> = {
  'EP-003': 'range="30d"',
  'EP-004': 'page=1, limit=20',
  'EP-005': 'format="json", page=1, limit=20',
  'EP-032': 'page=1, limit=20',
  'EP-035': 'status="PENDING", page=1, limit=20',
  'EP-055': 'page=1, limit=20, status="OPEN"',
  'EP-056': 'page=1, limit=20, asRaiser=true',
  'EP-071': 'limit=5',
  'EP-080': 'limit=20, includeHidden=false',
  'EP-114': 'lifecycle="all"',
  'EP-115': 'lifecycle="all"',
  'EP-118': 'includeDrafts=false',
  'EP-149': 'date="2026-04-01"',
  'EP-151': 'date="2026-04-01"',
  'EP-152': 'range="30d"',
  'EP-157': 'gapStart="2026-04-01T09:00:00.000Z", gapEnd="2026-04-01T10:00:00.000Z"',
  'EP-160': `disputeId="${VALID_UUID}", scheduledTime="2026-04-01T09:00:00.000Z"`,
};

const edgeOneQueryHints: Record<string, string> = {
  'EP-003': 'range="7d"',
  'EP-004': 'page=2, limit=5, action="EXPORT"',
  'EP-005': 'format="csv"',
  'EP-032': 'participantId=user-self, page=1, limit=1',
  'EP-035': 'status="PENDING", page=1, limit=10',
  'EP-055': 'page=1, limit=1, status="OPEN"',
  'EP-080': 'limit=1, includeHidden=false',
  'EP-152': 'range="7d"',
};

const edgeTwoQueryHints: Record<string, string> = {
  'EP-003': 'range="90d"',
  'EP-004': 'limit=1, statusCode=500',
  'EP-005': 'format="xlsx"',
  'EP-032': 'limit=200',
  'EP-055': 'page=2, limit=20, includeUnassignedForStaff=true',
  'EP-080': 'limit=20, includeHidden=true',
  'EP-152': 'range="90d"',
};

const invalidQueryHints: Record<string, string> = {
  'EP-003': 'range="365d"',
  'EP-004': 'page=0',
  'EP-005': 'format="pdf"',
  'EP-032': 'organizerId="bad-id"',
  'EP-035': 'status="DONE"',
  'EP-055': 'assignedStaffId="bad-id"',
  'EP-071': 'limit=0',
  'EP-115': 'status="INVALID"',
  'EP-139': 'at="not-a-date"',
  'EP-151': 'date="not-a-date"',
  'EP-157': 'gapStart="bad-date"',
  'EP-160': 'disputeId="bad-id"',
};

const defaultPayloadHints: Record<string, string> = {
  'EP-031': 'valid event payload with deduplicated participants',
  'EP-033': 'partial event update payload',
  'EP-034': 'valid reschedule request payload',
  'EP-036': 'approve reschedule request payload',
  'EP-037': 'valid invitation response payload',
  'EP-053': 'valid dispute creation payload',
  'EP-054': 'valid grouped dispute creation payload',
  'EP-073': 'valid scheduling proposal payload',
  'EP-079': 'valid dispute message payload',
  'EP-081': 'valid hide-message payload',
  'EP-086': 'valid staff note payload',
  'EP-088': 'valid defendant response payload',
  'EP-091': 'valid hearing verdict payload',
  'EP-097': 'valid request-info payload',
  'EP-107': 'valid evidence upload metadata',
  'EP-111': 'valid evidence flag payload',
  'EP-113': 'valid hearing schedule payload',
  'EP-122': 'valid schedule validation payload',
  'EP-124': 'valid hearing phase transition payload',
  'EP-130': 'valid hearing statement payload',
  'EP-131': 'valid hearing question payload',
  'EP-132': 'valid hearing answer payload',
  'EP-134': 'valid hearing end payload',
  'EP-135': 'valid hearing reschedule payload',
  'EP-136': 'valid hearing extension payload',
  'EP-138': 'valid support invitation payload',
  'EP-140': 'valid settlement offer payload',
  'EP-143': 'valid settlement response payload',
  'EP-147': 'valid settlement counter-offer payload',
  'EP-150': 'valid batch complexity payload',
  'EP-153': 'valid auto-assignment request context',
  'EP-154': 'valid manual reassign payload',
  'EP-156': 'valid early-release payload',
  'EP-158': 'valid emergency reassign payload',
  'EP-159': 'valid activity ping payload',
};

const edgeOnePayloadHints: Record<string, string> = {
  'EP-031': 'auto-schedule payload without manual slots',
  'EP-033': 'title-only update payload',
  'EP-034': 'auto-schedule reschedule payload',
  'EP-036': 'reject request payload with process note',
  'EP-037': 'admin-managed invitation response payload',
  'EP-053': 'valid dispute payload with alternate reason',
  'EP-073': 'boundary proposal payload with alternate slots',
  'EP-107': 'upload payload with alternate description',
  'EP-113': 'emergency hearing schedule payload',
  'EP-122': 'boundary schedule validation payload',
  'EP-130': 'draft hearing statement payload',
  'EP-150': 'deduplicated disputeIds batch payload',
  'EP-154': 'reassign payload with process note',
  'EP-158': 'emergency reassign payload with preferred replacement',
};

const edgeTwoPayloadHints: Record<string, string> = {
  'EP-031': 'organizer-only event payload',
  'EP-033': 'staff-managed update payload',
  'EP-034': 'organizer-submitted reschedule payload',
  'EP-036': 'manual selected-start-time payload',
  'EP-037': 'staff-managed invitation response payload',
  'EP-053': 'valid dispute payload with alternate category mix',
  'EP-073': 'payload with optional description fields',
  'EP-107': 'upload payload with optional metadata',
  'EP-113': 'standard hearing schedule payload with optional agenda',
  'EP-122': 'schedule validation payload with optional agenda',
  'EP-130': 'submitted hearing statement payload',
  'EP-150': 'batch payload with alternate valid disputeIds',
  'EP-154': 'reassign payload with alternate target staff',
  'EP-158': 'emergency reassign payload with high urgency',
};

const invalidPayloadHints: Record<string, string> = {
  'EP-031': 'invalid event type payload',
  'EP-033': 'invalid event update payload',
  'EP-034': 'mismatched body eventId payload',
  'EP-036': 'invalid requestId payload',
  'EP-037': 'invalid invitation response payload',
  'EP-053': 'malformed dispute creation payload',
  'EP-054': 'malformed dispute group payload',
  'EP-073': 'malformed scheduling proposal payload',
  'EP-079': 'mismatched disputeId body payload',
  'EP-081': 'mismatched messageId body payload',
  'EP-086': 'invalid note payload',
  'EP-088': 'invalid defendant response payload',
  'EP-091': 'invalid hearing verdict payload',
  'EP-097': 'invalid request-info payload',
  'EP-107': 'missing file upload payload',
  'EP-111': 'missing flagReason payload',
  'EP-113': 'invalid hearing schedule payload',
  'EP-122': 'invalid schedule validation payload',
  'EP-124': 'mismatched hearingId body payload',
  'EP-130': 'invalid statement payload',
  'EP-131': 'invalid question payload',
  'EP-132': 'invalid answer payload',
  'EP-134': 'invalid hearing end payload',
  'EP-135': 'invalid hearing reschedule payload',
  'EP-136': 'invalid hearing extension payload',
  'EP-138': 'invalid support invitation payload',
  'EP-140': 'invalid settlement offer payload',
  'EP-143': 'invalid settlement response payload',
  'EP-147': 'invalid counter-offer payload',
  'EP-150': 'too many disputeIds payload',
  'EP-154': 'invalid reassign payload',
  'EP-156': 'invalid early-release payload',
  'EP-158': 'invalid emergency reassign payload',
  'EP-159': 'invalid activity ping payload',
};

const sanitizeSheetName = (value: string) =>
  value.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31) || 'Function';

const quote = (value: string) => `"${value}"`;

const parseTaskRows = () =>
  fs
    .readFileSync(taskFile, 'utf8')
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
      } satisfies TaskRow;
    });

const taskRowsByCode = new Map(parseTaskRows().map((row) => [row.code, row]));

const resolveNonDisputeEndpoint = (code: string): EndpointMeta => {
  const row = taskRowsByCode.get(code);
  if (!row) {
    throw new Error(`Missing task row for ${code}`);
  }

  for (const controllerClass of controllerSearchOrder) {
    const descriptor = findRouteDescriptor(controllerClass, row.requestMethod, row.path);
    if (!descriptor) {
      continue;
    }
    const controllerName = descriptor.controllerClass.name as string;
    const preferredRole =
      descriptor.roles[0] ?? defaultRoleFallback[controllerName] ?? UserRole.CLIENT;

    return {
      ...row,
      controllerName,
      controllerFile: controllerFiles[controllerName],
      methodName: descriptor.methodName,
      roles: descriptor.roles,
      preferredRole,
      sheetName: sanitizeSheetName(row.name),
    };
  }

  throw new Error(`Could not resolve route metadata for ${code} ${row.requestMethod} ${row.path}`);
};

const resolveDisputeEndpoints = (): EndpointMeta[] =>
  loadDisputesEndpoints().map((endpoint) => {
    const controllerName = endpoint.controllerClass.name as string;
    return {
      code: endpoint.code,
      requestMethod: endpoint.requestMethod,
      path: endpoint.path,
      name: endpoint.name,
      useCases: endpoint.useCases,
      controllerName,
      controllerFile: controllerFiles[controllerName],
      methodName: endpoint.route.methodName,
      roles: endpoint.route.roles,
      preferredRole: endpoint.preferredRole,
      sheetName: sanitizeSheetName(endpoint.sheetName),
    };
  });

const methodLocCache = new Map<string, number | ''>();

const countMethodLines = (filePath: string, className: string, methodName: string): number | '' => {
  const cacheKey = `${filePath}:${className}:${methodName}`;
  if (methodLocCache.has(cacheKey)) {
    return methodLocCache.get(cacheKey)!;
  }

  try {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
    let loc: number | '' = '';

    const visit = (node: ts.Node) => {
      if (
        ts.isClassDeclaration(node) &&
        node.name?.text === className
      ) {
        for (const member of node.members) {
          if (
            (ts.isMethodDeclaration(member) ||
              ts.isGetAccessorDeclaration(member) ||
              ts.isSetAccessorDeclaration(member)) &&
            member.name &&
            ts.isIdentifier(member.name) &&
            member.name.text == methodName
          ) {
            const start = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line;
            const end = sourceFile.getLineAndCharacterOfPosition(member.end).line;
            loc = end - start + 1;
            return;
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    methodLocCache.set(cacheKey, loc);
    return loc;
  } catch {
    methodLocCache.set(cacheKey, '');
    return '';
  }
};

const buildAuthorizationValue = (role: UserRole | undefined) =>
  role ? quote(`Bearer ${String(role).toLowerCase()}-token`) : quote('Bearer auth-token');

const preferredRoleLabel = (endpoint: EndpointMeta) =>
  endpoint.preferredRole ?? endpoint.roles[0] ?? UserRole.CLIENT;

const summarizePathParams = (routePath: string, invalid = false) => {
  const params = Array.from(routePath.matchAll(/:([A-Za-z0-9_]+)/g)).map((match) => match[1]);
  if (params.length === 0) {
    return undefined;
  }
  return params
    .map((param, index) => {
      if (/id/i.test(param)) {
        const value = invalid ? 'bad-id' : index === 0 ? VALID_UUID : index === 1 ? ALT_UUID : THIRD_UUID;
        return `${param}=${quote(value)}`;
      }
      return `${param}=${quote(invalid ? `invalid-${param}` : `${param}-value`)}`;
    })
    .join(', ');
};

const summarizeQuery = (endpoint: EndpointMeta, variant: 'happy' | 'edge1' | 'edge2' | 'invalid') => {
  const source =
    variant === 'happy'
      ? defaultQueryHints
      : variant === 'edge1'
        ? edgeOneQueryHints
        : variant === 'edge2'
          ? edgeTwoQueryHints
          : invalidQueryHints;
  const direct = source[endpoint.code];
  if (direct) {
    return quote(direct);
  }
  if (variant === 'invalid' && endpoint.requestMethod === 'GET' && !endpoint.path.includes(':')) {
    return quote('malformed query input');
  }
  return undefined;
};

const summarizePayload = (endpoint: EndpointMeta, variant: 'happy' | 'edge1' | 'edge2' | 'invalid') => {
  if (endpoint.requestMethod === 'GET' || endpoint.requestMethod === 'DELETE') {
    return undefined;
  }
  const source =
    variant === 'happy'
      ? defaultPayloadHints
      : variant === 'edge1'
        ? edgeOnePayloadHints
        : variant === 'edge2'
          ? edgeTwoPayloadHints
          : invalidPayloadHints;
  const direct = source[endpoint.code];
  if (direct) {
    return quote(direct);
  }
  if (variant === 'invalid') {
    return quote('malformed request payload');
  }
  if (variant === 'edge1') {
    return quote(`boundary payload variant for ${endpoint.name.toLowerCase()}`);
  }
  if (variant === 'edge2') {
    return quote(`alternate valid payload for ${endpoint.name.toLowerCase()}`);
  }
  return quote(`valid payload for ${endpoint.name.toLowerCase()}`);
};

const buildBaseInputs = (
  endpoint: EndpointMeta,
  variant: 'happy' | 'edge1' | 'edge2' | 'invalid' | 'missing' | 'error' | 'unauthorized' | 'forbidden',
) => {
  const inputs: Record<string, unknown> = {
    Request: quote(`${endpoint.requestMethod} ${endpoint.path}`),
  };

  if (variant === 'unauthorized') {
    inputs.Authorization = null;
  } else if (variant === 'forbidden') {
    inputs.Authorization = quote('Bearer blocked-scope-token');
  } else {
    inputs.Authorization = buildAuthorizationValue(preferredRoleLabel(endpoint));
  }

  const pathParams = summarizePathParams(endpoint.path, variant === 'invalid');
  if (pathParams) {
    inputs['Path Params'] = pathParams;
  }

  const queryVariant =
    variant === 'edge1'
      ? 'edge1'
      : variant === 'edge2'
        ? 'edge2'
        : variant === 'invalid'
          ? 'invalid'
          : 'happy';
  const querySummary = summarizeQuery(endpoint, queryVariant);
  if (querySummary) {
    inputs.Query = querySummary;
  }

  const payloadVariant =
    variant === 'edge1'
      ? 'edge1'
      : variant === 'edge2'
        ? 'edge2'
        : variant === 'invalid'
          ? 'invalid'
          : 'happy';
  const payloadSummary = summarizePayload(endpoint, payloadVariant);
  if (payloadSummary) {
    inputs.Payload = payloadSummary;
  }

  if (variant === 'missing') {
    inputs['Data State'] = quote('target resource does not exist');
  }
  if (variant === 'error') {
    inputs['Downstream State'] = quote('service throws unexpected failure');
  }

  return inputs;
};

const successReturn = (endpoint: EndpointMeta, suffix?: string) => {
  if (VOID_SUCCESS_ENDPOINTS.has(endpoint.code)) {
    return [`returns successful ${endpoint.name.toLowerCase()} completion without response body`];
  }
  if (INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)) {
    return [`returns current migration guard response for ${endpoint.name.toLowerCase()}`];
  }
  return [
    suffix
      ? `returns ${endpoint.name.toLowerCase()} response for ${suffix}`
      : `returns successful ${endpoint.name.toLowerCase()} response`,
  ];
};

const errorTextForConflictEndpoint = (endpoint: EndpointMeta) =>
  endpoint.code === 'EP-096'
    ? '409 Conflict: dispute phase control moved to hearing workflow'
    : '409 Conflict: verdict can only be issued from hearing room';

const buildCases = (endpoint: EndpointMeta) => {
  const standardTypes = INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
    ? ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A']
    : ['N', 'B', 'B', 'A', 'A', 'A', 'A', 'A'];

  const cases = [
    {
      type: standardTypes[0],
      status: 'U',
      test_key: `${endpoint.code} UTC01`,
      preconditions: [
        `Caller is authenticated as ${preferredRoleLabel(endpoint)}`,
        INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
          ? 'Endpoint is intentionally guarded by migration control'
          : 'Target route and required data are available',
      ],
      inputs: buildBaseInputs(endpoint, 'happy'),
      returns: successReturn(endpoint),
      exceptions: INLINE_CONFLICT_ENDPOINTS.has(endpoint.code) ? [errorTextForConflictEndpoint(endpoint)] : [],
      defect_id: '',
    },
    {
      type: standardTypes[1],
      status: 'U',
      test_key: `${endpoint.code} UTC02`,
      preconditions: [
        `Caller is authenticated as ${preferredRoleLabel(endpoint)}`,
        INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
          ? 'Endpoint still routes through the migration guard'
          : 'Boundary-safe optional inputs are accepted',
      ],
      inputs: buildBaseInputs(endpoint, 'edge1'),
      returns: successReturn(endpoint, 'boundary variant 1'),
      exceptions: INLINE_CONFLICT_ENDPOINTS.has(endpoint.code) ? [errorTextForConflictEndpoint(endpoint)] : [],
      defect_id: '',
    },
    {
      type: standardTypes[2],
      status: 'U',
      test_key: `${endpoint.code} UTC03`,
      preconditions: [
        `Caller is authenticated as ${preferredRoleLabel(endpoint)}`,
        INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
          ? 'Endpoint still routes through the migration guard'
          : 'Alternate valid boundary inputs are accepted',
      ],
      inputs: buildBaseInputs(endpoint, 'edge2'),
      returns: successReturn(endpoint, 'boundary variant 2'),
      exceptions: INLINE_CONFLICT_ENDPOINTS.has(endpoint.code) ? [errorTextForConflictEndpoint(endpoint)] : [],
      defect_id: '',
    },
    {
      type: standardTypes[3],
      status: 'U',
      test_key: `${endpoint.code} UTC04`,
      preconditions: [
        DTO_ONLY_ENDPOINTS.has(endpoint.code)
          ? 'DTO validation runs before schedule validation endpoint accepts the payload'
          : 'Malformed input reaches controller validation',
      ],
      inputs: buildBaseInputs(endpoint, 'invalid'),
      returns: [],
      exceptions: DTO_ONLY_ENDPOINTS.has(endpoint.code)
        ? ['400 Bad Request: invalid disputeId in schedule validation payload']
        : INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
          ? [errorTextForConflictEndpoint(endpoint)]
          : ['400 Bad Request'],
      defect_id: '',
    },
    {
      type: standardTypes[4],
      status: 'U',
      test_key: `${endpoint.code} UTC05`,
      preconditions: [
        DTO_ONLY_ENDPOINTS.has(endpoint.code)
          ? 'DTO validation rejects malformed schedule timestamps'
          : 'Referenced resource is missing from the system',
      ],
      inputs: buildBaseInputs(endpoint, 'missing'),
      returns: [],
      exceptions: DTO_ONLY_ENDPOINTS.has(endpoint.code)
        ? ['400 Bad Request: invalid scheduledAt value']
        : INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
          ? [errorTextForConflictEndpoint(endpoint)]
          : ['404 Not Found or equivalent missing-target rejection'],
      defect_id: '',
    },
    {
      type: standardTypes[5],
      status: 'U',
      test_key: `${endpoint.code} UTC06`,
      preconditions: [
        DTO_ONLY_ENDPOINTS.has(endpoint.code)
          ? 'DTO validation rejects invalid duration boundaries'
          : 'Downstream service throws an unexpected error',
      ],
      inputs: buildBaseInputs(endpoint, 'error'),
      returns: [],
      exceptions: DTO_ONLY_ENDPOINTS.has(endpoint.code)
        ? ['400 Bad Request: invalid estimatedDurationMinutes']
        : INLINE_CONFLICT_ENDPOINTS.has(endpoint.code)
          ? [errorTextForConflictEndpoint(endpoint)]
          : ['Unexpected service error is surfaced'],
      defect_id: '',
    },
    {
      type: standardTypes[6],
      status: 'U',
      test_key: `${endpoint.code} UTC07`,
      preconditions: ['Caller is not authenticated'],
      inputs: buildBaseInputs(endpoint, 'unauthorized'),
      returns: [],
      exceptions: ['401 Unauthorized'],
      defect_id: '',
    },
    {
      type: standardTypes[7],
      status: 'U',
      test_key: `${endpoint.code} UTC08`,
      preconditions: ['Caller is authenticated but lacks the required permission or scope'],
      inputs: buildBaseInputs(endpoint, 'forbidden'),
      returns: [],
      exceptions: ['403 Forbidden'],
      defect_id: '',
    },
  ];

  return cases;
};

const buildFunctionListRows = (endpoints: EndpointMeta[]) =>
  endpoints.map((endpoint, index) => ({
    no: index + 1,
    class_name: endpoint.controllerName,
    function_name: endpoint.name,
    function_code: endpoint.code,
    sheet_name: endpoint.sheetName,
    description: `${endpoint.requestMethod} ${endpoint.path}`,
    precondition: `Authenticated as ${preferredRoleLabel(endpoint)}`,
  }));

const buildWorkbookFunctions = (endpoints: EndpointMeta[]): WorkbookFunction[] =>
  endpoints.map((endpoint) => ({
    function_code: endpoint.code,
    class_name: endpoint.controllerName,
    function_name: endpoint.name,
    sheet_name: endpoint.sheetName,
    test_requirement: `Cover happy path, edge input handling, validation/error handling, and security for ${endpoint.requestMethod} ${endpoint.path}.`,
    loc: countMethodLines(endpoint.controllerFile, endpoint.controllerName, endpoint.methodName),
    created_by: CREATED_BY,
    executed_by: CREATED_BY,
    cases: buildCases(endpoint),
  }));

const makeChangeLog = (version: string, clusterName: string, endpoints: EndpointMeta[]) => [
  {
    effective_date: ISSUE_DATE,
    version,
    change_item: clusterName,
    mode: 'A',
    change_description: `Generated UTC workbook for ${clusterName} with ${endpoints.length} endpoint tabs.`,
    reference: endpoints.map((endpoint) => endpoint.code).join(', '),
  },
];

const clusters = (() => {
  const admin = adminCodes.map(resolveNonDisputeEndpoint);
  const audit = auditCodes.map(resolveNonDisputeEndpoint);
  const calendar = calendarCodes.map(resolveNonDisputeEndpoint);
  const disputes = resolveDisputeEndpoints();

  return [
    { version: '2.4', clusterName: 'admin-dashboard', endpoints: admin },
    { version: '2.5', clusterName: 'audit-logs', endpoints: audit },
    { version: '2.6', clusterName: 'calendar', endpoints: calendar },
    { version: '2.7', clusterName: 'disputes', endpoints: disputes },
  ];
})();

const buildSpec = () => {
  const cumulativeEndpoints: EndpointMeta[] = [];

  return {
    meta: {
      project_name: PROJECT_NAME,
      project_code: PROJECT_CODE,
      creator: CREATED_BY,
      reviewer: REVIEWER,
      issue_date: ISSUE_DATE,
      executed_date: EXECUTED_DATE,
    },
    workbooks: clusters.map((cluster) => {
      cumulativeEndpoints.push(...cluster.endpoints);
      return {
        version: cluster.version,
        issue_date: ISSUE_DATE,
        output_file: path
          .join('docs', 'Unit Testing Excel', 'DangChiBang_batch_01', `Report5_Unit Test Case_v${cluster.version}.xlsx`)
          .replace(/\\/g, '/'),
        change_log: makeChangeLog(cluster.version, cluster.clusterName, cluster.endpoints),
        function_list: buildFunctionListRows(cumulativeEndpoints),
        functions: buildWorkbookFunctions(cluster.endpoints),
      };
    }),
  };
};

const outputPathFromArgs = () => {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
    return path.resolve(process.cwd(), process.argv[outputIndex + 1]);
  }
  return path.resolve(outputRoot, '_batch_spec.json');
};

const main = () => {
  const outputPath = outputPathFromArgs();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(buildSpec(), null, 2), 'utf8');
  process.stdout.write(outputPath);
};

main();
