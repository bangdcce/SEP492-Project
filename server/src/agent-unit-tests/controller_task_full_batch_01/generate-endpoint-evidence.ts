import fs from 'node:fs';
import path from 'node:path';

import { buildCaseLogMessageFromTitle } from './test-log-helpers';

type JestAssertion = {
  ancestorTitles?: string[];
  fullName?: string;
  status: string;
  title: string;
};

type JestSuite = {
  assertionResults?: JestAssertion[];
};

type JestJson = {
  testResults?: JestSuite[];
};

const repoRoot = path.resolve(__dirname, '../../../..');
const evidenceDir = path.join(repoRoot, 'docs', 'test-evidence', 'controller_task_full_batch_01');
const manifestPath = path.join(evidenceDir, 'task-manifest.json');
const jestResultsPath = path.join(evidenceDir, 'jest-results.json');
const outputPath = path.join(evidenceDir, 'endpoint-evidence.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  endpoints: Array<{
    code: string;
    requestMethod: string;
    path: string;
    name: string;
    functionName: string;
    functionDisplayName: string;
    group: string;
    controllerName: string;
    methodName: string;
  }>;
};
const jestResults = JSON.parse(fs.readFileSync(jestResultsPath, 'utf8')) as JestJson;

const tests = (jestResults.testResults ?? []).flatMap((suite) => suite.assertionResults ?? []);
const grouped = new Map<
  string,
  {
    passed: number;
    failed: number;
    pending: number;
    tests: Array<{ id: string; title: string; status: string; logMessages: string[] }>;
  }
>();

for (const test of tests) {
  const source = test.fullName ?? test.title;
  const match = source.match(/(EP-\d+)\s+(UTC\d+)/);
  if (!match) {
    continue;
  }

  const [, endpointCode, utcId] = match;
  const bucket = grouped.get(endpointCode) ?? {
    passed: 0,
    failed: 0,
    pending: 0,
    tests: [],
  };

  if (test.status === 'passed') {
    bucket.passed += 1;
  } else if (test.status === 'failed') {
    bucket.failed += 1;
  } else {
    bucket.pending += 1;
  }

      bucket.tests.push({
        id: utcId,
        title: test.title,
        status: test.status,
        logMessages: [buildCaseLogMessageFromTitle(source)],
      });
  grouped.set(endpointCode, bucket);
}

const summary = manifest.endpoints.map((endpoint) => ({
  ...endpoint,
  passed: grouped.get(endpoint.code)?.passed ?? 0,
  failed: grouped.get(endpoint.code)?.failed ?? 0,
  pending: grouped.get(endpoint.code)?.pending ?? 0,
  tests: grouped.get(endpoint.code)?.tests ?? [],
}));

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalEndpoints: summary.length,
      endpoints: summary,
    },
    null,
    2,
  ),
);

console.log(outputPath);
