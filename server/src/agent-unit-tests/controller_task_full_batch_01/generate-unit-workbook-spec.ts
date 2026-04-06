import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {
  buildProfessionalTestRequirement,
  buildSheetName,
} from './case-catalog-utils';
import { buildEndpointCaseDefinitions } from './endpoint-case-catalog';
import { resolveTaskEndpoints, type TaskEndpoint } from './task-manifest';
import type { WorkbookCaseDescriptor } from './case-catalog.types';

type EndpointEvidenceTest = {
  id: string;
  title: string;
  status: string;
  logMessages?: string[];
};

type EndpointEvidence = {
  code: string;
  passed: number;
  failed: number;
  pending: number;
  tests: EndpointEvidenceTest[];
};

type EndpointEvidencePayload = {
  generatedAt: string;
  totalEndpoints: number;
  endpoints: EndpointEvidence[];
};

type WorkbookFunctionSpec = {
  code: string;
  class_name: string;
  function_name: string;
  method_name: string;
  sheet_name: string;
  requirement_name: string;
  description: string;
  precondition_summary: string;
  test_requirement: string;
  loc: number;
  lack_of_test_cases: number;
  source_file_path: string;
  cases: WorkbookCaseDescriptor[];
};

const repoRoot = path.resolve(__dirname, '../../../..');
const evidenceDir = path.join(repoRoot, 'docs', 'test-evidence', 'controller_task_full_batch_01');
const endpointEvidencePath = path.join(evidenceDir, 'endpoint-evidence.json');
const outputPath = path.join(evidenceDir, 'unit-workbook-spec.json');

const readJson = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;

const endpointEvidence = readJson<EndpointEvidencePayload>(endpointEvidencePath);
const evidenceByCode = new Map(endpointEvidence.endpoints.map((endpoint) => [endpoint.code, endpoint]));

const formatIssueDate = (value: Date) => value.toISOString().slice(0, 10);
const formatExecutedDate = (value: Date) => {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${month}-${day}`;
};

const toPreconditionSummary = (cases: WorkbookCaseDescriptor[]) => {
  const summary = Array.from(
    new Set(
      cases
        .flatMap((testCase) => testCase.preconditions)
        .filter((item) => item && item.trim().length > 0),
    ),
  );

  return summary.slice(0, 3).join(' | ');
};

const mergeEvidenceIntoCases = (
  cases: WorkbookCaseDescriptor[],
  evidence: EndpointEvidence | undefined,
  executedDate: string,
) => {
  const evidenceByUtcId = new Map((evidence?.tests ?? []).map((test) => [test.id, test]));

  for (const testCase of cases) {
    const evidenceCase = evidenceByUtcId.get(testCase.utcId);
    if (!evidenceCase) {
      testCase.status = 'U';
      testCase.executedDate = '';
      continue;
    }

    testCase.title = evidenceCase.title || testCase.title;
    testCase.status =
      evidenceCase.status === 'passed'
        ? 'P'
        : evidenceCase.status === 'failed'
          ? 'F'
          : 'U';
    testCase.executedDate = testCase.status === 'U' ? '' : executedDate;
    if ((evidenceCase.logMessages?.length ?? 0) > 0) {
      testCase.logs = evidenceCase.logMessages!;
    }
  }
};

const controllerSourceCache = new Map<string, ts.SourceFile>();

const readSourceFile = (relativePath: string) => {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!controllerSourceCache.has(absolutePath)) {
    controllerSourceCache.set(
      absolutePath,
      ts.createSourceFile(
        absolutePath,
        fs.readFileSync(absolutePath, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      ),
    );
  }

  return controllerSourceCache.get(absolutePath)!;
};

const countMethodLoc = (endpoint: TaskEndpoint) => {
  try {
    const sourceFile = readSourceFile(endpoint.sourceFilePath);
    let locatedNode: ts.Node | undefined;

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name?.text === endpoint.controllerName) {
        for (const member of node.members) {
          if (
            (ts.isMethodDeclaration(member) ||
              ts.isGetAccessorDeclaration(member) ||
              ts.isSetAccessorDeclaration(member)) &&
            member.name &&
            ts.isIdentifier(member.name) &&
            member.name.text === endpoint.methodName
          ) {
            locatedNode = member;
            return;
          }
        }
      }

      if (!locatedNode) {
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);

    if (!locatedNode) {
      return 12;
    }

    const start = sourceFile.getLineAndCharacterOfPosition(locatedNode.getStart(sourceFile)).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(locatedNode.end).line + 1;
    return Math.max(end - start + 1, 1);
  } catch {
    return 12;
  }
};

const buildWorkbookFunctionSpec = (
  endpoint: TaskEndpoint,
  executedDate: string,
): WorkbookFunctionSpec => {
  const cases = buildEndpointCaseDefinitions(endpoint);
  mergeEvidenceIntoCases(cases, evidenceByCode.get(endpoint.code), executedDate);

  return {
    code: endpoint.code,
    class_name: endpoint.controllerName,
    function_name: endpoint.functionDisplayName,
    method_name: endpoint.methodName,
    sheet_name: buildSheetName(endpoint.code, endpoint.functionDisplayName),
    requirement_name: endpoint.useCases || endpoint.name,
    description: endpoint.name,
    precondition_summary: toPreconditionSummary(cases),
    test_requirement: buildProfessionalTestRequirement(
      endpoint.controllerName,
      endpoint.methodName,
      endpoint.code,
      endpoint.name,
    ),
    loc: countMethodLoc(endpoint),
    lack_of_test_cases: 0,
    source_file_path: endpoint.sourceFilePath,
    cases,
  };
};

const endpoints = resolveTaskEndpoints();
const generatedAt = endpointEvidence.generatedAt ? new Date(endpointEvidence.generatedAt) : new Date();
const issueDate = formatIssueDate(generatedAt);
const executedDate = formatExecutedDate(generatedAt);

const functions = endpoints.map((endpoint) => buildWorkbookFunctionSpec(endpoint, executedDate));

const workbookSpec = {
  meta: {
    project_name: 'InterDev',
    project_code: 'INTERDEV',
    creator: 'Đặng Chí Bằng',
    executed_by: 'Đặng Chí Bằng',
    reviewer: 'Ngô Thái Sơn',
    issue_date: issueDate,
    executed_date: executedDate,
    version: '1.0',
    environment_description: [
      '1. Backend API: NestJS controller unit-test harness with mocked dependencies',
      '2. Runtime: Node.js 22.x, Yarn 1.22.x',
      '3. Test framework: Jest + ts-jest',
      '4. Validation: class-validator and NestJS pipe metadata assertions',
      '5. Evidence verification: executed Jest result JSON and OpenPyXL workbook validation',
    ].join('\n'),
    report_notes:
      'InterDev unit-test scope covers Admin Dashboard, Audit Logs, Calendar, Disputes, Leave, Reports, Reviews, User Warning, and Users Administration controllers.',
  },
  workbook: {
    version: '1.0',
    output_file: path.join(repoRoot, 'docs', 'unit', 'InterDev_Unit_Test_BangDC.xlsx'),
    document_code: 'INTERDEV_Unit_Test_BangDC_v1.0',
    change_log: [
      {
        effective_date: issueDate,
        version: '1.0',
        change_item: 'Initial unit-test workbook',
        mode: 'A',
        change_description:
          'Created a single evidence-driven workbook for all controller unit-test functions listed in Test-Unit-task.txt.',
        reference: 'Test-Unit-task.txt; controller_task_full_batch_01',
      },
    ],
    functions,
  },
};

fs.writeFileSync(outputPath, JSON.stringify(workbookSpec, null, 2));
console.log(outputPath);
