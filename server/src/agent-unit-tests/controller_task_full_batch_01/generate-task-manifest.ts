import fs from 'node:fs';
import path from 'node:path';

import { detectDuplicateTaskRows, parseTaskRows, resolveTaskEndpoints } from './task-manifest';

const repoRoot = path.resolve(__dirname, '../../../..');
const outputDir = path.join(repoRoot, 'docs', 'test-evidence', 'controller_task_full_batch_01');
const outputFile = path.join(outputDir, 'task-manifest.json');

fs.mkdirSync(outputDir, { recursive: true });

const rows = parseTaskRows();
const duplicates = detectDuplicateTaskRows(rows);
const endpoints = resolveTaskEndpoints().map((endpoint) => ({
  code: endpoint.code,
  requestMethod: endpoint.requestMethod,
  path: endpoint.path,
  name: endpoint.name,
  functionName: endpoint.methodName,
  functionDisplayName: endpoint.functionDisplayName,
  useCases: endpoint.useCases,
  group: endpoint.group,
  controllerName: endpoint.controllerName,
  sourceFilePath: endpoint.sourceFilePath,
  methodName: endpoint.methodName,
  roles: endpoint.roles,
  preferredRole: endpoint.preferredRole,
  disallowedRole: endpoint.disallowedRole,
  securityMode: endpoint.securityMode,
}));

fs.writeFileSync(
  outputFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalRows: rows.length,
      duplicateRouteKeys: duplicates,
      endpoints,
    },
    null,
    2,
  ),
);

console.log(outputFile);
