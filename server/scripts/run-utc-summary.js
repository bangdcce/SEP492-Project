const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');
const docsDir = path.join(repoRoot, 'docs', 'unit test final');

const jestResultPath = path.join(
  docsDir,
  'Report5_Unit_Test_Jest_Run_Result.json',
);
const jestOutputPath = path.join(
  docsDir,
  'Report5_Unit_Test_Jest_Run_Output.txt',
);
const auditCsvPath = path.join(docsDir, 'Report5_Unit_Test_Jest_Audit.csv');
const utcCountsPath = path.join(docsDir, 'Report5_UTC_Case_Counts.json');
const utcResultPath = path.join(docsDir, 'Report5_UTC_Run_Result.json');
const utcSummaryPath = path.join(docsDir, 'Report5_UTC_Run_Summary.txt');

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function parseCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

function parseDuration(outputText) {
  const match = outputText.match(/^Time:\s+([^\r\n]+)$/m);
  if (!match) {
    return null;
  }
  return match[1].split(',')[0].trim();
}

function formatTimestamp(timestampMs) {
  if (!timestampMs) {
    return null;
  }
  const date = new Date(timestampMs);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get(
    'minute',
  )}:${get('second')} +0700`;
}

function summarizeUtc(runResult, auditRows, utcCounts, duration) {
  const suiteStatusByPath = new Map();
  for (const testResult of runResult.testResults ?? []) {
    const status =
      testResult.status ||
      (testResult.numFailingTests > 0 || testResult.testExecError
        ? 'failed'
        : 'passed');
    suiteStatusByPath.set(path.normalize(testResult.name), status);
  }

  let epPassed = 0;
  let epFailed = 0;
  let epUntested = 0;
  let casesPassed = 0;
  let casesFailed = 0;
  let casesUntested = 0;

  const epResults = [];

  for (const row of auditRows) {
    const epCode = row['EP Code'];
    const counts = utcCounts.casesByEp[epCode];
    if (!counts) {
      continue;
    }

    const matchedSpecFiles = (row['Matched Spec Files'] || '')
      .split(' | ')
      .map((item) => path.normalize(item.trim()))
      .filter(Boolean);

    const statuses = matchedSpecFiles.map((specFile) => {
      return suiteStatusByPath.get(specFile) || 'not_run';
    });

    let utcStatus = 'untested';
    if (statuses.some((status) => status === 'failed')) {
      utcStatus = 'failed';
    } else if (statuses.length > 0 && statuses.every((status) => status === 'passed')) {
      utcStatus = 'passed';
    }

    if (utcStatus === 'passed') {
      epPassed += 1;
      casesPassed += counts.total;
    } else if (utcStatus === 'failed') {
      epFailed += 1;
      casesFailed += counts.total;
    } else {
      epUntested += 1;
      casesUntested += counts.total;
    }

    epResults.push({
      epCode,
      functionName: row['Function Name'],
      className: row['Class Name'],
      jestStatus: row['Jest Status'],
      utcStatus,
      totalCases: counts.total,
      matchedSpecFiles,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    workbookSource: utcCounts.sourceWorkbook,
    workbookDocumentCode: utcCounts.documentCode,
    backedEpSheets: auditRows.length,
    directMatches: auditRows.filter((row) => row['Jest Status'] === 'direct').length,
    classOnlyMatches: auditRows.filter((row) => row['Jest Status'] === 'class_only').length,
    suiteSummary: {
      total: runResult.numTotalTestSuites,
      passed: runResult.numPassedTestSuites,
      failed: runResult.numFailedTestSuites,
      pending: runResult.numPendingTestSuites,
    },
    testSummary: {
      total: runResult.numTotalTests,
      passed: runResult.numPassedTests,
      failed: runResult.numFailedTests,
      pending: runResult.numPendingTests,
    },
    utcSummary: {
      totalEpSheets: epResults.length,
      passedEpSheets: epPassed,
      failedEpSheets: epFailed,
      untestedEpSheets: epUntested,
      totalCases: utcCounts.subTotal.total,
      passedCases: casesPassed,
      failedCases: casesFailed,
      untestedCases: casesUntested,
    },
    duration,
    runStartedAt: formatTimestamp(runResult.startTime),
    epResults,
  };
}

function formatUtcSummary(result) {
  const utc = result.utcSummary;
  const suites = result.suiteSummary;
  const tests = result.testSummary;
  const lines = [
    'UTC Summary',
    '-----------',
    `Workbook source: ${result.workbookSource}`,
    `Document code: ${result.workbookDocumentCode}`,
    `Run started at: ${result.runStartedAt || 'N/A'}`,
    `Duration: ${result.duration || 'N/A'}`,
    '',
    `EP sheets backed: ${result.backedEpSheets}/${result.backedEpSheets}`,
    `Direct Jest matches: ${result.directMatches}`,
    `Class-only Jest matches: ${result.classOnlyMatches}`,
    '',
    `UTC cases passed: ${utc.passedCases}/${utc.totalCases}`,
    `UTC cases failed: ${utc.failedCases}`,
    `UTC cases untested: ${utc.untestedCases}`,
    '',
    'Jest Execution',
    '--------------',
    `Suites passed: ${suites.passed}/${suites.total}`,
    `Suites failed: ${suites.failed}`,
    `Tests passed: ${tests.passed}/${tests.total}`,
    `Tests failed: ${tests.failed}`,
  ];
  return lines.join('\n') + '\n';
}

function getJestInvocation() {
  const jestBin = require.resolve('jest/bin/jest');
  return {
    command: process.execPath,
    argsPrefix: [jestBin],
  };
}

async function main() {
  ensureFile(auditCsvPath, 'Jest audit CSV');
  ensureFile(utcCountsPath, 'UTC case-count JSON');

  const rawArgs = process.argv.slice(2);
  const verboseOutput = rawArgs.includes('--verbose-output');
  const passthroughArgs = rawArgs.filter((arg) => arg !== '--verbose-output');
  const args = [...passthroughArgs];

  if (!args.includes('--runInBand')) {
    args.unshift('--runInBand');
  }

  args.push('--json', '--outputFile', jestResultPath);

  const jestInvocation = getJestInvocation();

  let combinedOutput = '';

  const child = spawn(jestInvocation.command, [...jestInvocation.argsPrefix, ...args], {
    cwd: serverRoot,
    env: { ...process.env, CI: 'true' },
    shell: false,
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    if (verboseOutput) {
      process.stdout.write(text);
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    if (verboseOutput) {
      process.stderr.write(text);
    }
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  fs.writeFileSync(jestOutputPath, combinedOutput, 'utf8');

  ensureFile(jestResultPath, 'Jest run result JSON');

  const runResult = JSON.parse(fs.readFileSync(jestResultPath, 'utf8'));
  const auditRows = parseCsv(fs.readFileSync(auditCsvPath, 'utf8'));
  const utcCounts = JSON.parse(fs.readFileSync(utcCountsPath, 'utf8'));
  const duration = parseDuration(combinedOutput);

  const utcResult = summarizeUtc(runResult, auditRows, utcCounts, duration);
  const utcSummaryText = formatUtcSummary(utcResult);

  fs.writeFileSync(utcResultPath, `${JSON.stringify(utcResult, null, 2)}\n`, 'utf8');
  fs.writeFileSync(utcSummaryPath, utcSummaryText, 'utf8');

  process.stdout.write(`\n${utcSummaryText}`);

  if (!verboseOutput && exitCode !== 0) {
    process.stderr.write('\nJest output (quiet mode replay because the run failed)\n');
    process.stderr.write('-----------------------------------------------\n');
    process.stderr.write(combinedOutput);
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error('[test:utc] Failed to generate UTC summary');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
