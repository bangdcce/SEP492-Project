#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function loadXlsx() {
  const candidates = [
    "xlsx",
    path.resolve(__dirname, "../../../../client/node_modules/xlsx"),
    path.resolve(process.cwd(), "client/node_modules/xlsx"),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") {
        throw error;
      }
    }
  }

  throw new Error(
    "Unable to resolve the 'xlsx' package. Expected it in client/node_modules/xlsx or the current Node resolution path."
  );
}

const XLSX = loadXlsx();
const DEFAULT_TESTER = "SonNT";

function parseArgs(argv) {
  const args = {};

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      args.input = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--output") {
      args.output = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--template") {
      args.template = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printUsage() {
  console.log(
    "Usage: node generate_integration_test_xlsx.cjs --input <input.json|-> --output <output.xlsx> [--template <template.xlsx>]"
  );
}

function readJson(filePath) {
  if (filePath === "-") {
    const text = fs.readFileSync(0, "utf8");
    return JSON.parse(text);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeCellText(value) {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t");
}

function toMultiline(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return normalizeCellText(value);
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toStringArray(item))
      .filter(Boolean);
  }

  if (value === null || value === undefined) {
    return [];
  }

  const normalized = normalizeCellText(value).trim();
  return normalized ? [normalized] : [];
}

function appendMultiline(...values) {
  return values
    .flatMap((value) => toStringArray(value))
    .filter(Boolean)
    .join("\n");
}

function projectDefaultTester(project) {
  const rawValue =
    project && (project.defaultTester !== undefined ? project.defaultTester : project.tester);
  const normalized = rawValue ? normalizeCellText(rawValue).trim() : "";
  return normalized || DEFAULT_TESTER;
}

function resolveTesterName(value, fallbackTester) {
  const normalized = value ? normalizeCellText(value).trim() : "";
  if (!normalized || normalized.toLowerCase() === "codex") {
    return fallbackTester;
  }

  return normalized;
}

function formatReferenceLine(label, value) {
  const refs = toStringArray(value);
  return refs.length > 0 ? `${label}: ${refs.join(", ")}` : "";
}

function normalizeLegacyStatus(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (["pass", "passed"].includes(normalized)) {
    return "Passed";
  }

  if (["fail", "failed"].includes(normalized)) {
    return "Failed";
  }

  if (["pending", "untested", "not run", "not-run"].includes(normalized)) {
    return "Pending";
  }

  if (["n/a", "na", "not applicable", "not-applicable"].includes(normalized)) {
    return "N/A";
  }

  return String(value).trim();
}

function normalizeStrictStatus(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (["pass", "passed"].includes(normalized)) {
    return "Pass";
  }

  if (["fail", "failed"].includes(normalized)) {
    return "Fail";
  }

  if (["pending", "untested", "not run", "not-run"].includes(normalized)) {
    return "Untested";
  }

  if (["n/a", "na", "not applicable", "not-applicable"].includes(normalized)) {
    return "N/A";
  }

  return String(value).trim();
}

function expandWorksheetRef(worksheet, address) {
  const cell = XLSX.utils.decode_cell(address);

  if (!worksheet["!ref"]) {
    worksheet["!ref"] = XLSX.utils.encode_range({
      s: { r: cell.r, c: cell.c },
      e: { r: cell.r, c: cell.c },
    });
    return;
  }

  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  range.s.r = Math.min(range.s.r, cell.r);
  range.s.c = Math.min(range.s.c, cell.c);
  range.e.r = Math.max(range.e.r, cell.r);
  range.e.c = Math.max(range.e.c, cell.c);
  worksheet["!ref"] = XLSX.utils.encode_range(range);
}

function setCell(worksheet, address, value) {
  if (value === null || value === undefined || value === "") {
    delete worksheet[address];
    return;
  }

  const previous = worksheet[address] ? { ...worksheet[address] } : {};
  delete previous.f;
  delete previous.F;
  delete previous.w;
  delete previous.r;
  delete previous.h;

  if (typeof value === "number") {
    previous.t = "n";
    previous.v = value;
  } else if (typeof value === "boolean") {
    previous.t = "b";
    previous.v = value;
  } else {
    previous.t = "s";
    previous.v = normalizeCellText(value);
  }

  worksheet[address] = previous;
  expandWorksheetRef(worksheet, address);
}

function clearRange(worksheet, startRow, endRow, startColumn, endColumn) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row - 1, c: column - 1 });
      delete worksheet[address];
    }
  }
}

function colToIndex(column) {
  return XLSX.utils.decode_col(column) + 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function featureSheetName(index) {
  return `Feature${index + 1}`;
}

function featureFunctions(feature) {
  return Array.isArray(feature.functions) ? feature.functions : [];
}

function featureSections(feature) {
  return Array.isArray(feature.sections) ? feature.sections : [];
}

function featureCases(feature) {
  return featureSections(feature).flatMap((section) =>
    Array.isArray(section.testCases) ? section.testCases : []
  );
}

function normalizeSheetName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findSheetName(workbook, expectedNames) {
  const normalizedTargets = expectedNames.map(normalizeSheetName);
  return (
    workbook.SheetNames.find((name) =>
      normalizedTargets.includes(normalizeSheetName(name))
    ) || null
  );
}

function detectTemplateMode(workbook) {
  const names = new Set(workbook.SheetNames.map(normalizeSheetName));

  if (names.has("test case list") && names.has("test report")) {
    return "strict";
  }

  if (names.has("test cases") && names.has("test statistics")) {
    return "legacy-rounds";
  }

  throw new Error(
    "Unsupported template layout. Expected either the strict Test Case Document template or the legacy round-based integration test template."
  );
}

function keepOnlySheets(workbook, keepNames) {
  const keepSet = new Set(keepNames);
  workbook.SheetNames = workbook.SheetNames.filter((name) => keepSet.has(name));

  for (const name of Object.keys(workbook.Sheets)) {
    if (!keepSet.has(name)) {
      delete workbook.Sheets[name];
    }
  }

  if (workbook.Workbook && Array.isArray(workbook.Workbook.Sheets)) {
    workbook.Workbook.Sheets = workbook.Workbook.Sheets.filter((sheet) =>
      keepSet.has(sheet.name)
    );
  }

  if (workbook.Workbook) {
    workbook.Workbook.Names = [];
  }
}

function getFeatureSheetNames(workbook) {
  return workbook.SheetNames.filter((name) => /^Feature\d+$/i.test(name));
}

function buildLegacyRoundSummaries(feature, roundCount) {
  const cases = featureCases(feature);
  const summaries = Array.from({ length: roundCount }, () => ({
    Passed: 0,
    Failed: 0,
    Pending: 0,
    "N/A": 0,
  }));

  for (const testCase of cases) {
    const rounds = Array.isArray(testCase.rounds) ? testCase.rounds : [];
    for (let index = 0; index < roundCount; index += 1) {
      const status = normalizeLegacyStatus(rounds[index] && rounds[index].result);
      if (status && summaries[index][status] !== undefined) {
        summaries[index][status] += 1;
      }
    }
  }

  return summaries;
}

function buildLegacyOverallStatistics(feature, roundCount, roundSummaries) {
  if (feature.statistics) {
    return {
      passed: Number(feature.statistics.passed || 0),
      failed: Number(feature.statistics.failed || 0),
      pending: Number(feature.statistics.pending || 0),
      na: Number(feature.statistics.na || 0),
    };
  }

  for (let index = roundCount - 1; index >= 0; index -= 1) {
    const summary = roundSummaries[index];
    const total = summary.Passed + summary.Failed + summary.Pending + summary["N/A"];
    if (total > 0) {
      return {
        passed: summary.Passed,
        failed: summary.Failed,
        pending: summary.Pending,
        na: summary["N/A"],
      };
    }
  }

  return { passed: 0, failed: 0, pending: 0, na: 0 };
}

function strictCaseStatus(testCase) {
  const directStatus = normalizeStrictStatus(testCase && testCase.result);
  if (directStatus) {
    return directStatus;
  }

  const rounds = Array.isArray(testCase && testCase.rounds) ? testCase.rounds : [];
  for (const round of rounds) {
    const roundStatus = normalizeStrictStatus(round && round.result);
    if (roundStatus) {
      return roundStatus;
    }
  }

  return "Untested";
}

function strictCaseTestDate(testCase) {
  if (testCase && testCase.testDate) {
    return testCase.testDate;
  }

  const rounds = Array.isArray(testCase && testCase.rounds) ? testCase.rounds : [];
  for (const round of rounds) {
    if (round && round.testDate) {
      return round.testDate;
    }
  }

  return "";
}

function strictCaseTester(testCase, project) {
  const fallbackTester = projectDefaultTester(project);

  if (testCase && testCase.tester) {
    return resolveTesterName(testCase.tester, fallbackTester);
  }

  const rounds = Array.isArray(testCase && testCase.rounds) ? testCase.rounds : [];
  for (const round of rounds) {
    if (round && round.tester) {
      return resolveTesterName(round.tester, fallbackTester);
    }
  }

  return fallbackTester;
}

function strictCaseActualResults(testCase) {
  if (testCase && (testCase.actualResults || testCase.actualResult)) {
    return toMultiline(testCase.actualResults || testCase.actualResult);
  }

  return "";
}

function strictCaseDependencies(testCase) {
  if (testCase && (testCase.dependencies || testCase.dependence)) {
    return toMultiline(testCase.dependencies || testCase.dependence);
  }

  if (testCase && testCase.preConditions) {
    return toMultiline(testCase.preConditions);
  }

  return "";
}

function buildStrictFeatureStatistics(feature) {
  if (feature.statistics) {
    return {
      passed: Number(feature.statistics.passed || 0),
      failed: Number(feature.statistics.failed || 0),
      untested: Number(
        feature.statistics.untested !== undefined
          ? feature.statistics.untested
          : feature.statistics.pending || 0
      ),
      na: Number(feature.statistics.na || 0),
    };
  }

  const counts = {
    passed: 0,
    failed: 0,
    untested: 0,
    na: 0,
  };

  for (const testCase of featureCases(feature)) {
    const status = strictCaseStatus(testCase);
    if (status === "Pass") {
      counts.passed += 1;
      continue;
    }

    if (status === "Fail") {
      counts.failed += 1;
      continue;
    }

    if (status === "N/A") {
      counts.na += 1;
      continue;
    }

    counts.untested += 1;
  }

  return counts;
}

function fillLegacyCoverSheet(worksheet, project) {
  setCell(worksheet, "B4", project.projectName || "");
  setCell(worksheet, "B5", project.projectCode || "");
  setCell(worksheet, "B6", project.documentCode || "");
  setCell(worksheet, "F4", project.creator || "");
  setCell(worksheet, "F5", project.issueDate || "");
  setCell(worksheet, "F6", project.version || "");

  clearRange(worksheet, 11, 200, colToIndex("A"), colToIndex("F"));

  const changeLog = Array.isArray(project.changeLog) ? project.changeLog : [];
  let row = 11;
  for (const entry of changeLog) {
    setCell(worksheet, `A${row}`, entry.effectiveDate || "");
    setCell(worksheet, `B${row}`, entry.version || "");
    setCell(worksheet, `C${row}`, entry.changeItem || "");
    setCell(worksheet, `D${row}`, entry.changeType || "");
    setCell(worksheet, `E${row}`, entry.description || "");
    setCell(worksheet, `F${row}`, entry.reference || "");
    row += 1;
  }
}

function fillLegacyTestCasesSheet(worksheet, project, features) {
  setCell(worksheet, "D3", project.projectName || "");
  setCell(worksheet, "D4", project.projectCode || "");
  setCell(worksheet, "D5", toMultiline(project.environment));

  clearRange(worksheet, 9, 500, colToIndex("B"), colToIndex("F"));

  let row = 9;
  let sequence = 1;
  features.forEach((feature, featureIndex) => {
    const sheetName = featureSheetName(featureIndex);
    const functions = featureFunctions(feature);

    functions.forEach((item) => {
      const relatedUcLine = formatReferenceLine(
        "Related UCs",
        item.relatedUseCases || item.ucIds || item.ucId
      );

      setCell(worksheet, `B${row}`, sequence);
      setCell(worksheet, `C${row}`, item.name || "");
      setCell(worksheet, `D${row}`, sheetName);
      setCell(
        worksheet,
        `E${row}`,
        appendMultiline(item.description || "", relatedUcLine)
      );
      setCell(worksheet, `F${row}`, item.preCondition || "");
      row += 1;
      sequence += 1;
    });
  });
}

function fillLegacyTestStatisticsSheet(worksheet, project, features, roundCount) {
  setCell(worksheet, "C3", project.projectName || "");
  setCell(worksheet, "C4", project.projectCode || "");
  setCell(worksheet, "C5", project.documentCode || "");
  setCell(worksheet, "H5", project.issueDate || "");
  setCell(worksheet, "C6", project.notes || "");

  clearRange(worksheet, 11, 200, colToIndex("B"), colToIndex("H"));

  let row = 11;
  const subtotal = { passed: 0, failed: 0, pending: 0, na: 0, total: 0 };

  features.forEach((feature, index) => {
    const summaries = buildLegacyRoundSummaries(feature, roundCount);
    const overall = buildLegacyOverallStatistics(feature, roundCount, summaries);
    const total = overall.passed + overall.failed + overall.pending + overall.na;

    subtotal.passed += overall.passed;
    subtotal.failed += overall.failed;
    subtotal.pending += overall.pending;
    subtotal.na += overall.na;
    subtotal.total += total;

    setCell(worksheet, `B${row}`, index + 1);
    setCell(worksheet, `C${row}`, feature.name || "");
    setCell(worksheet, `D${row}`, overall.passed);
    setCell(worksheet, `E${row}`, overall.failed);
    setCell(worksheet, `F${row}`, overall.pending);
    setCell(worksheet, `G${row}`, overall.na);
    setCell(worksheet, `H${row}`, total);
    row += 1;
  });

  setCell(worksheet, `C${row}`, "Sub total");
  setCell(worksheet, `D${row}`, subtotal.passed);
  setCell(worksheet, `E${row}`, subtotal.failed);
  setCell(worksheet, `F${row}`, subtotal.pending);
  setCell(worksheet, `G${row}`, subtotal.na);
  setCell(worksheet, `H${row}`, subtotal.total);

  const tested = subtotal.passed + subtotal.failed + subtotal.pending;
  const denominator = subtotal.total - subtotal.na;
  const coverage = denominator > 0 ? Number(((tested * 100) / denominator).toFixed(2)) : 0;
  const successCoverage =
    denominator > 0 ? Number(((subtotal.passed * 100) / denominator).toFixed(2)) : 0;

  setCell(worksheet, `C${row + 2}`, "Tested");
  setCell(worksheet, `D${row + 2}`, tested);
  setCell(worksheet, `F${row + 2}`, "Passed");
  setCell(worksheet, `G${row + 2}`, subtotal.passed);

  setCell(worksheet, `C${row + 3}`, "Untest");
  setCell(worksheet, `D${row + 3}`, subtotal.na);
  setCell(worksheet, `F${row + 3}`, "Failed");
  setCell(worksheet, `G${row + 3}`, subtotal.failed);

  setCell(worksheet, `C${row + 4}`, "Test coverage");
  setCell(worksheet, `D${row + 4}`, coverage);
  setCell(worksheet, `E${row + 4}`, "%");
  setCell(worksheet, `F${row + 4}`, "Test successful coverage");
  setCell(worksheet, `G${row + 4}`, successCoverage);
  setCell(worksheet, `H${row + 4}`, "%");
}

function fillLegacyFeatureSheet(worksheet, feature, roundNames, project) {
  const fallbackTester = projectDefaultTester(project);
  const roundCount = roundNames.length;
  const summaries = buildLegacyRoundSummaries(feature, roundCount);
  const testCases = featureCases(feature);
  const totalCases = testCases.length;

  setCell(worksheet, "B2", feature.name || "");
  setCell(worksheet, "B3", feature.testRequirement || "");
  setCell(worksheet, "B4", totalCases);

  clearRange(worksheet, 6, 11, colToIndex("A"), colToIndex("F"));
  clearRange(worksheet, 13, 1000, colToIndex("A"), colToIndex("X"));

  for (let index = 0; index < 6; index += 1) {
    const row = 6 + index;
    const summary = summaries[index] || { Passed: 0, Failed: 0, Pending: 0, "N/A": 0 };
    const roundName = roundNames[index] || "";
    const total = summary.Passed + summary.Failed + summary.Pending + summary["N/A"];

    setCell(worksheet, `A${row}`, roundName);
    setCell(worksheet, `B${row}`, summary.Passed);
    setCell(worksheet, `C${row}`, summary.Failed);
    setCell(worksheet, `D${row}`, summary.Pending);
    setCell(worksheet, `E${row}`, summary["N/A"]);
    setCell(worksheet, `F${row}`, total);
  }

  setCell(worksheet, "A13", "ID");
  setCell(worksheet, "B13", "Test Case Description");
  setCell(worksheet, "C13", "Test Case Procedure");
  setCell(worksheet, "D13", "Expected Results");
  setCell(worksheet, "E13", "Pre-conditions");

  const roundTriples = [
    ["F", "G", "H"],
    ["I", "J", "K"],
    ["L", "M", "N"],
    ["O", "P", "Q"],
    ["R", "S", "T"],
    ["U", "V", "W"],
  ];

  roundTriples.forEach((triple, index) => {
    setCell(worksheet, `${triple[0]}13`, roundNames[index] || "");
    setCell(worksheet, `${triple[1]}13`, roundNames[index] ? "Test date" : "");
    setCell(worksheet, `${triple[2]}13`, roundNames[index] ? "Tester" : "");
  });
  setCell(worksheet, "X13", "Note");

  let row = 14;
  for (const section of featureSections(feature)) {
    setCell(worksheet, `A${row}`, section.title || "");
    row += 1;

    const cases = Array.isArray(section.testCases) ? section.testCases : [];
    for (const testCase of cases) {
      const ucReferenceNote = formatReferenceLine(
        "UC refs",
        testCase.useCaseRefs ||
          testCase.relatedUseCases ||
          testCase.ucIds ||
          testCase.ucId
      );

      setCell(worksheet, `A${row}`, testCase.id || "");
      setCell(worksheet, `B${row}`, testCase.description || "");
      setCell(worksheet, `C${row}`, toMultiline(testCase.procedure));
      setCell(worksheet, `D${row}`, toMultiline(testCase.expectedResults));
      setCell(worksheet, `E${row}`, toMultiline(testCase.preConditions));

      const rounds = Array.isArray(testCase.rounds) ? testCase.rounds : [];
      roundTriples.forEach((triple, index) => {
        const round = rounds[index] || {};
        setCell(worksheet, `${triple[0]}${row}`, normalizeLegacyStatus(round.result || ""));
        setCell(worksheet, `${triple[1]}${row}`, round.testDate || "");
        setCell(
          worksheet,
          `${triple[2]}${row}`,
          resolveTesterName(round.tester, fallbackTester)
        );
      });

      setCell(
        worksheet,
        `X${row}`,
        appendMultiline(ucReferenceNote, testCase.note || "")
      );
      row += 1;
    }
  }
}

function fillLegacyModuleCodeSheet(worksheet, features) {
  clearRange(worksheet, 3, 200, colToIndex("B"), colToIndex("G"));

  features.forEach((feature, index) => {
    const row = 3 + index;
    const roles = Array.isArray(feature.roles)
      ? feature.roles.map((item) => String(item).toLowerCase())
      : [];

    setCell(worksheet, `B${row}`, feature.code || `F${index + 1}`);
    setCell(worksheet, `C${row}`, feature.name || "");
    setCell(worksheet, `D${row}`, roles.includes("clinic"));
    setCell(worksheet, `E${row}`, roles.includes("admin"));
    setCell(worksheet, `F${row}`, roles.includes("user"));
    setCell(worksheet, `G${row}`, feature.note || "");
  });
}

function fillLegacyFunctionsSheet(worksheet, features) {
  clearRange(worksheet, 3, 500, colToIndex("A"), colToIndex("F"));

  let row = 3;
  let sequence = 1;
  for (const feature of features) {
    const functions = featureFunctions(feature);
    for (const item of functions) {
      setCell(worksheet, `A${row}`, sequence);
      setCell(worksheet, `B${row}`, feature.name || "");
      setCell(worksheet, `C${row}`, item.ucId || "");
      setCell(worksheet, `D${row}`, item.actor || "");
      setCell(worksheet, `E${row}`, item.name || "");
      setCell(worksheet, `F${row}`, Boolean(item.done));
      row += 1;
      sequence += 1;
    }
  }
}

function fillStrictCoverSheet(worksheet, project) {
  setCell(worksheet, "C4", project.projectName || "");
  setCell(worksheet, "C5", project.projectCode || "");
  setCell(worksheet, "C6", project.documentCode || "");
  setCell(worksheet, "G4", project.creator || "");
  setCell(worksheet, "G5", project.reviewerApprover || "");
  setCell(worksheet, "G6", project.issueDate || "");
  setCell(worksheet, "G7", project.version || "");

  clearRange(worksheet, 12, 200, colToIndex("B"), colToIndex("G"));

  const changeLog = Array.isArray(project.changeLog) ? project.changeLog : [];
  let row = 12;
  for (const entry of changeLog) {
    setCell(worksheet, `B${row}`, entry.effectiveDate || "");
    setCell(worksheet, `C${row}`, entry.version || "");
    setCell(worksheet, `D${row}`, entry.changeItem || "");
    setCell(worksheet, `E${row}`, entry.changeType || "");
    setCell(worksheet, `F${row}`, entry.description || "");
    setCell(worksheet, `G${row}`, entry.reference || "");
    row += 1;
  }
}

function fillStrictTestCaseListSheet(worksheet, project, features) {
  setCell(worksheet, "D3", project.projectName || "");
  setCell(worksheet, "D4", project.projectCode || "");
  setCell(worksheet, "D5", toMultiline(project.environment));

  clearRange(worksheet, 9, 500, colToIndex("B"), colToIndex("F"));

  let row = 9;
  let sequence = 1;
  features.forEach((feature, featureIndex) => {
    const sheetName = featureSheetName(featureIndex);
    const functions = featureFunctions(feature);

    functions.forEach((item) => {
      const relatedUcLine = formatReferenceLine(
        "Related UCs",
        item.relatedUseCases || item.ucIds || item.ucId
      );

      setCell(worksheet, `B${row}`, sequence);
      setCell(worksheet, `C${row}`, item.name || "");
      setCell(worksheet, `D${row}`, sheetName);
      setCell(
        worksheet,
        `E${row}`,
        appendMultiline(item.description || "", relatedUcLine)
      );
      setCell(worksheet, `F${row}`, item.preCondition || "");
      row += 1;
      sequence += 1;
    });
  });
}

function fillStrictFeatureSheet(worksheet, feature, project) {
  const statistics = buildStrictFeatureStatistics(feature);
  const totalCases =
    statistics.passed + statistics.failed + statistics.untested + statistics.na;

  setCell(worksheet, "B2", feature.name || "");
  setCell(worksheet, "B3", feature.testRequirement || "");
  setCell(
    worksheet,
    "B4",
    toMultiline(
      feature.referenceDocument || feature.referenceDocuments || feature.reference || ""
    )
  );

  setCell(worksheet, "A6", statistics.passed);
  setCell(worksheet, "B6", statistics.failed);
  setCell(worksheet, "C6", statistics.untested);
  setCell(worksheet, "D6", statistics.na);
  setCell(worksheet, "F6", totalCases);

  clearRange(worksheet, 9, 1000, colToIndex("A"), colToIndex("M"));

  setCell(worksheet, "A8", "ID");
  setCell(worksheet, "B8", "Test Case Description");
  setCell(worksheet, "C8", "Test Case Procedure");
  setCell(worksheet, "D8", "Expected Results");
  setCell(worksheet, "E8", "Actual Results");
  setCell(worksheet, "F8", "Inter-test case Dependence");
  setCell(worksheet, "G8", "Result");
  setCell(worksheet, "H8", "Test date");
  setCell(worksheet, "I8", "Tester");
  setCell(worksheet, "J8", "Note");

  let row = 9;
  for (const section of featureSections(feature)) {
    setCell(worksheet, `A${row}`, section.title || "");
    row += 1;

    const cases = Array.isArray(section.testCases) ? section.testCases : [];
    for (const testCase of cases) {
      const ucReferenceNote = formatReferenceLine(
        "UC refs",
        testCase.useCaseRefs ||
          testCase.relatedUseCases ||
          testCase.ucIds ||
          testCase.ucId
      );

      setCell(worksheet, `A${row}`, testCase.id || "");
      setCell(worksheet, `B${row}`, testCase.description || "");
      setCell(worksheet, `C${row}`, toMultiline(testCase.procedure));
      setCell(worksheet, `D${row}`, toMultiline(testCase.expectedResults));
      setCell(worksheet, `E${row}`, strictCaseActualResults(testCase));
      setCell(worksheet, `F${row}`, strictCaseDependencies(testCase));
      setCell(worksheet, `G${row}`, strictCaseStatus(testCase));
      setCell(worksheet, `H${row}`, strictCaseTestDate(testCase));
      setCell(worksheet, `I${row}`, strictCaseTester(testCase, project));
      setCell(
        worksheet,
        `J${row}`,
        appendMultiline(ucReferenceNote, testCase.note || "")
      );
      row += 1;
    }
  }
}

function fillStrictTestReportSheet(worksheet, project, features) {
  setCell(worksheet, "C3", project.projectName || "");
  setCell(worksheet, "C4", project.projectCode || "");
  setCell(worksheet, "C5", project.documentCode || "");
  setCell(worksheet, "G3", project.creator || "");
  setCell(worksheet, "G4", project.reviewerApprover || "");
  setCell(worksheet, "H5", project.issueDate || "");
  setCell(worksheet, "C6", project.notes || "");

  clearRange(worksheet, 11, 200, colToIndex("B"), colToIndex("H"));

  let row = 11;
  const subtotal = {
    passed: 0,
    failed: 0,
    untested: 0,
    na: 0,
    total: 0,
  };

  features.forEach((feature, index) => {
    const statistics = buildStrictFeatureStatistics(feature);
    const total =
      statistics.passed + statistics.failed + statistics.untested + statistics.na;

    subtotal.passed += statistics.passed;
    subtotal.failed += statistics.failed;
    subtotal.untested += statistics.untested;
    subtotal.na += statistics.na;
    subtotal.total += total;

    setCell(worksheet, `B${row}`, index + 1);
    setCell(
      worksheet,
      `C${row}`,
      feature.code ? `${feature.code} - ${feature.name || ""}`.trim() : feature.name || ""
    );
    setCell(worksheet, `D${row}`, statistics.passed);
    setCell(worksheet, `E${row}`, statistics.failed);
    setCell(worksheet, `F${row}`, statistics.untested);
    setCell(worksheet, `G${row}`, statistics.na);
    setCell(worksheet, `H${row}`, total);
    row += 1;
  });

  setCell(worksheet, `C${row}`, "Sub total");
  setCell(worksheet, `D${row}`, subtotal.passed);
  setCell(worksheet, `E${row}`, subtotal.failed);
  setCell(worksheet, `F${row}`, subtotal.untested);
  setCell(worksheet, `G${row}`, subtotal.na);
  setCell(worksheet, `H${row}`, subtotal.total);

  const executableTotal = subtotal.total - subtotal.na;
  const executed = subtotal.passed + subtotal.failed;
  const coverage =
    executableTotal > 0 ? Number(((executed * 100) / executableTotal).toFixed(2)) : 0;
  const successCoverage =
    executableTotal > 0 ? Number(((subtotal.passed * 100) / executableTotal).toFixed(2)) : 0;

  setCell(worksheet, `E${row + 2}`, coverage);
  setCell(worksheet, `E${row + 3}`, successCoverage);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }

  assert(args.input, "Missing --input");
  assert(args.output, "Missing --output");

  const inputPath = args.input === "-" ? "-" : path.resolve(process.cwd(), args.input);
  const outputPath = path.resolve(process.cwd(), args.output);
  const strictDefaultTemplate = path.resolve(
    __dirname,
    "../assets/test-case-document-template.xlsx"
  );
  const legacyDefaultTemplate = path.resolve(
    __dirname,
    "../assets/integration-test-report-template.xlsx"
  );

  const templatePath = args.template
    ? path.resolve(process.cwd(), args.template)
    : fs.existsSync(strictDefaultTemplate)
      ? strictDefaultTemplate
      : legacyDefaultTemplate;

  if (inputPath !== "-") {
    assert(fs.existsSync(inputPath), `Input JSON not found: ${inputPath}`);
  }
  assert(fs.existsSync(templatePath), `Template workbook not found: ${templatePath}`);

  const payload = readJson(inputPath);
  const project = payload.project || {};
  const features = Array.isArray(payload.features) ? payload.features : [];

  assert(features.length > 0, "At least one feature is required.");

  const workbook = XLSX.readFile(templatePath, {
    cellStyles: true,
    cellFormula: true,
    cellNF: true,
    cellDates: false,
  });

  const templateMode = detectTemplateMode(workbook);
  const featureSheetNames = getFeatureSheetNames(workbook);

  assert(
    features.length <= featureSheetNames.length,
    `The selected template supports up to ${featureSheetNames.length} feature sheets.`
  );

  const keepSheets = [];

  if (templateMode === "strict") {
    const coverSheetName = findSheetName(workbook, ["Cover"]);
    const testCaseListSheetName = findSheetName(workbook, ["Test case List"]);
    const testReportSheetName = findSheetName(workbook, ["Test Report"]);

    assert(coverSheetName, "Strict template is missing the Cover sheet.");
    assert(testCaseListSheetName, "Strict template is missing the Test case List sheet.");
    assert(testReportSheetName, "Strict template is missing the Test Report sheet.");

    keepSheets.push(coverSheetName, testCaseListSheetName, testReportSheetName);
    for (let index = 0; index < features.length; index += 1) {
      keepSheets.push(featureSheetName(index));
    }

    keepOnlySheets(workbook, keepSheets);

    fillStrictCoverSheet(workbook.Sheets[coverSheetName], project);
    fillStrictTestCaseListSheet(
      workbook.Sheets[testCaseListSheetName],
      project,
      features
    );
    fillStrictTestReportSheet(workbook.Sheets[testReportSheetName], project, features);

    features.forEach((feature, index) => {
      fillStrictFeatureSheet(workbook.Sheets[featureSheetName(index)], feature, project);
    });
  } else {
    const roundNames =
      Array.isArray(payload.rounds) && payload.rounds.length > 0
        ? payload.rounds.slice(0, 6)
        : ["Round 1"];

    assert(roundNames.length <= 6, "The legacy template supports up to 6 rounds.");

    const moduleCodeSheetName = findSheetName(workbook, ["module code"]);
    const functionsSheetName = findSheetName(workbook, ["chuc nang"]);
    const coverSheetName = findSheetName(workbook, ["Cover"]);
    const testCasesSheetName = findSheetName(workbook, ["Test Cases"]);
    const testStatisticsSheetName = findSheetName(workbook, ["Test Statistics"]);

    assert(moduleCodeSheetName, "Legacy template is missing the module code sheet.");
    assert(functionsSheetName, "Legacy template is missing the functions sheet.");
    assert(coverSheetName, "Legacy template is missing the Cover sheet.");
    assert(testCasesSheetName, "Legacy template is missing the Test Cases sheet.");
    assert(
      testStatisticsSheetName,
      "Legacy template is missing the Test Statistics sheet."
    );

    keepSheets.push(
      moduleCodeSheetName,
      functionsSheetName,
      coverSheetName,
      testCasesSheetName,
      testStatisticsSheetName
    );
    for (let index = 0; index < features.length; index += 1) {
      keepSheets.push(featureSheetName(index));
    }

    keepOnlySheets(workbook, keepSheets);

    fillLegacyModuleCodeSheet(workbook.Sheets[moduleCodeSheetName], features);
    fillLegacyFunctionsSheet(workbook.Sheets[functionsSheetName], features);
    fillLegacyCoverSheet(workbook.Sheets[coverSheetName], project);
    fillLegacyTestCasesSheet(workbook.Sheets[testCasesSheetName], project, features);
    fillLegacyTestStatisticsSheet(
      workbook.Sheets[testStatisticsSheetName],
      project,
      features,
      roundNames.length
    );

    features.forEach((feature, index) => {
      fillLegacyFeatureSheet(
        workbook.Sheets[featureSheetName(index)],
        feature,
        roundNames,
        project
      );
    });
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(workbook, outputPath, {
    bookType: "xlsx",
    cellStyles: true,
  });

  console.log(outputPath);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
