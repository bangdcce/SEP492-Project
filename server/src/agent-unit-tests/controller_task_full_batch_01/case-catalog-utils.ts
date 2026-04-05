import { UserRole } from 'src/database/entities';

export type InvocationLike = {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  file?: {
    originalname?: string;
    mimetype?: string;
    size?: number;
  };
};

const quoteIfNeeded = (value: unknown) => {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return `"${value}"`;
  }

  if (Array.isArray(value)) {
    const preview = value.slice(0, 3).map((item) => quoteIfNeeded(item)).join(', ');
    return `[${preview}${value.length > 3 ? ', ...' : ''}]`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

export const toRoleLabel = (role: UserRole | string) => String(role).toUpperCase();

export const flattenInvocationInputs = (invocation: InvocationLike) => {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(invocation.params ?? {})) {
    flattened[key] = value;
  }
  for (const [key, value] of Object.entries(invocation.query ?? {})) {
    flattened[key] = value;
  }
  for (const [key, value] of Object.entries(invocation.body ?? {})) {
    flattened[key] = value;
  }

  if (invocation.file) {
    if (invocation.file.originalname) {
      flattened.fileName = invocation.file.originalname;
    }
    if (invocation.file.mimetype) {
      flattened.fileType = invocation.file.mimetype;
    }
    if (invocation.file.size !== undefined) {
      flattened.fileSize = invocation.file.size;
    }
  }

  return flattened;
};

export const summarizeInputDelta = (
  baseInputs: Record<string, unknown>,
  variantInputs: Record<string, unknown>,
  fallback: string,
) => {
  const deltas: string[] = [];
  const keys = Array.from(new Set([...Object.keys(baseInputs), ...Object.keys(variantInputs)]));

  for (const key of keys) {
    const left = JSON.stringify(baseInputs[key] ?? null);
    const right = JSON.stringify(variantInputs[key] ?? null);
    if (left !== right) {
      deltas.push(`${key}=${quoteIfNeeded(variantInputs[key])}`);
    }
  }

  return deltas.length > 0 ? deltas.slice(0, 3).join(', ') : fallback;
};

export const buildSheetName = (code: string, displayName: string) => `${code} ${displayName}`.trim();

export const buildProfessionalTestRequirement = (
  controllerName: string,
  methodName: string,
  endpointCode: string,
  actionLabel: string,
) =>
  `Verify ${controllerName}.${methodName} handles ${actionLabel.toLowerCase()}, failures, boundaries, and authorization for ${endpointCode}.`;

export const summarizeReturnValue = (label: string, payload: unknown) => {
  if (Array.isArray(payload)) {
    return `returns ${label.toLowerCase()} list with ${payload.length} item(s)`;
  }

  if (typeof payload === 'boolean') {
    return `returns ${payload}`;
  }

  if (typeof payload === 'number') {
    return `returns ${payload}`;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string') {
      return `returns "${record.message}"`;
    }
    if (record.success === true) {
      return `returns success payload for ${label.toLowerCase()}`;
    }
    if (Array.isArray(record.items) && typeof record.total === 'number') {
      return `returns paginated ${label.toLowerCase()} result with total = ${record.total}`;
    }
    if (typeof record.totalUsers === 'number') {
      return `returns user statistics payload`;
    }
  }

  return `returns ${label.toLowerCase()} payload`;
};

export const buildCommonAuthPreconditions = (
  role: UserRole | string,
  controllerName: string,
  methodName: string,
) => [
  `Authenticated ${toRoleLabel(role)} user invokes ${controllerName}.${methodName}`,
  `Dependencies required by ${controllerName}.${methodName} are available`,
];

export const buildTargetExistencePreconditions = (inputs: Record<string, unknown>) =>
  Object.entries(inputs)
    .filter(([key, value]) => key.toLowerCase().includes('id') && value !== undefined && value !== null)
    .map(([key, value]) => `Target ${key} ${quoteIfNeeded(value)} exists`);

export const buildMissingTargetPreconditions = (inputs: Record<string, unknown>) =>
  Object.entries(inputs)
    .filter(([key, value]) => key.toLowerCase().includes('id') && value !== undefined && value !== null)
    .map(([key, value]) => `Target ${key} ${quoteIfNeeded(value)} does not exist`);

export const toWorkbookInputMap = (inputs: Record<string, unknown>) => {
  const orderedEntries = Object.entries(inputs).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(orderedEntries);
};
