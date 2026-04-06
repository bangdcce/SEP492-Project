import type { TaskEndpoint } from './task-manifest';
import { buildServiceControllerCaseDefinitions } from './service-controller-runtime';
import { buildDisputeCaseDefinitions, loadDisputesEndpoints } from './disputes-batch-runtime';
import { getManualCaseDefinitions } from './manual-case-catalog';
import type { WorkbookCaseDescriptor } from './case-catalog.types';

const deepCloneCases = (cases: WorkbookCaseDescriptor[]) =>
  JSON.parse(JSON.stringify(cases)) as WorkbookCaseDescriptor[];

const disputeEndpointByCode = new Map(
  loadDisputesEndpoints().map((endpoint) => [endpoint.code, endpoint]),
);

const serviceGroups = new Set([
  'leave',
  'reports',
  'reviews',
  'user-warnings',
  'users-admin',
]);

export const buildEndpointCaseDefinitions = (
  endpoint: TaskEndpoint,
): WorkbookCaseDescriptor[] => {
  const manualCases = getManualCaseDefinitions(endpoint.code);
  if (manualCases) {
    return deepCloneCases(manualCases);
  }

  if (endpoint.group.startsWith('disputes-')) {
    const disputeEndpoint = disputeEndpointByCode.get(endpoint.code);
    if (!disputeEndpoint) {
      throw new Error(`Missing dispute endpoint metadata for ${endpoint.code}`);
    }
    return deepCloneCases(buildDisputeCaseDefinitions(disputeEndpoint));
  }

  if (serviceGroups.has(endpoint.group)) {
    return deepCloneCases(buildServiceControllerCaseDefinitions(endpoint));
  }

  throw new Error(`No case catalog is available for ${endpoint.code} (${endpoint.group})`);
};
