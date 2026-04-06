#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadXlsx() {
  const candidates = [
    path.resolve(__dirname, '../../../../client/node_modules/xlsx'),
    path.resolve(process.cwd(), 'client/node_modules/xlsx'),
    'xlsx',
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_error) {
      // Try the next candidate.
    }
  }

  throw new Error(
    'Unable to load the xlsx package. Expected it in client/node_modules or on the current NODE_PATH.',
  );
}

const XLSX = loadXlsx();
const BASE_SHEETS = new Set(['Guideline', 'Cover', 'Function List', 'Test Report']);
const HEADER_LABELS = new Set([
  'Function Code',
  'Function Name',
  'Created By',
  'Executed By',
  'Lines  of code',
  'Test requirement',
  'Lack of test cases',
]);
const SYNTHETIC_INPUT_SECTION_KEYS = new Set([
  'action',
  'requeststatus',
  'currentstatus',
  'workflowstate',
  'statetransition',
  'requeststate',
]);

function resolveDefaultTemplatePath() {
  const unitTemplateDir = path.resolve(process.cwd(), 'docs/template/unit-test');
  const candidates = [
    path.join(unitTemplateDir, 'Report5_Unit Test Case_v2.3.xlsx'),
    path.join(unitTemplateDir, 'Report5_Unit Test Case_v1.3.xlsx'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (fs.existsSync(unitTemplateDir)) {
    const firstWorkbook = fs
      .readdirSync(unitTemplateDir)
      .filter((name) => name.toLowerCase().endsWith('.xlsx'))
      .sort()[0];
    if (firstWorkbook) {
      return path.join(unitTemplateDir, firstWorkbook);
    }
  }

  return candidates[0];
}

function parseArgs(argv) {
  const args = {
    template: resolveDefaultTemplatePath(),
    overwrite: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--template') args.template = argv[++i];
    else if (arg === '--template-function-sheet') args.templateFunctionSheet = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--overwrite') args.overwrite = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.output) {
    throw new Error('Missing required argument: --output');
  }

  args.template = path.resolve(process.cwd(), args.template);
  args.output = path.resolve(process.cwd(), args.output);
  if (args.input) {
    args.input = path.resolve(process.cwd(), args.input);
  }

  return args;
}

function readJsonPayload(inputPath) {
  const text = inputPath
    ? fs.readFileSync(inputPath, 'utf8')
    : fs.readFileSync(0, 'utf8');

  if (!text.trim()) {
    throw new Error('No JSON payload provided.');
  }

  const payload = JSON.parse(text);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload must be a JSON object.');
  }

  return payload;
}

function encodeCell(row, col) {
  return XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
}

function decodeRange(ws) {
  return XLSX.utils.decode_range(ws['!ref']);
}

function getCell(ws, row, col) {
  return ws[encodeCell(row, col)];
}

function ensureCell(ws, row, col) {
  const ref = encodeCell(row, col);
  if (!ws[ref]) {
    ws[ref] = { t: 'z' };
  }
  return ws[ref];
}

function setBlank(ws, row, col) {
  const cell = ensureCell(ws, row, col);
  delete cell.v;
  delete cell.w;
  delete cell.f;
  delete cell.r;
  delete cell.h;
  delete cell.z;
  cell.t = 'z';
}

function setCellValue(ws, row, col, value) {
  if (value === undefined || value === null || value === '') {
    setBlank(ws, row, col);
    return;
  }

  const cell = ensureCell(ws, row, col);
  delete cell.f;
  delete cell.w;
  delete cell.r;
  delete cell.h;
  delete cell.z;

  if (typeof value === 'number') {
    cell.t = 'n';
    cell.v = value;
    return;
  }

  if (typeof value === 'boolean') {
    cell.t = 'b';
    cell.v = value;
    return;
  }

  cell.t = 's';
  cell.v = String(value);
}

function setFormula(ws, row, col, formula, value) {
  const cell = ensureCell(ws, row, col);
  delete cell.w;
  cell.t = 'n';
  cell.f = formula;
  if (value === undefined) {
    delete cell.v;
  } else {
    cell.v = value;
  }
}

function setFormulaValueByRef(ws, ref, value) {
  if (!ws[ref]) {
    ws[ref] = { t: 'n' };
  }
  ws[ref].t = 'n';
  ws[ref].v = value;
}

function clearRange(ws, startRow, endRow, startCol, endCol) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      setBlank(ws, row, col);
    }
  }
}

function findCell(ws, needle) {
  const range = decodeRange(ws);
  for (let row = range.s.r + 1; row <= range.e.r + 1; row += 1) {
    for (let col = range.s.c + 1; col <= range.e.c + 1; col += 1) {
      const cell = getCell(ws, row, col);
      if (cell && cell.v === needle) {
        return { row, col };
      }
    }
  }
  return null;
}

function findRowColA(ws, needle) {
  const range = decodeRange(ws);
  for (let row = 1; row <= range.e.r + 1; row += 1) {
    const cell = getCell(ws, row, 1);
    if (cell && cell.v === needle) {
      return row;
    }
  }
  return null;
}

function utcInfo(ws) {
  const pos = findCell(ws, 'UTCID01');
  if (!pos) return null;

  let lastCol = pos.col;
  const range = decodeRange(ws);
  for (let col = pos.col; col <= range.e.c + 1; col += 1) {
    const value = getCell(ws, pos.row, col)?.v;
    if (typeof value === 'string' && value.startsWith('UTCID')) {
      lastCol = col;
    }
  }

  return {
    utcRow: pos.row,
    caseStartCol: pos.col,
    lastCol,
  };
}

function cellBelowLabel(ws, label) {
  const pos = findCell(ws, label);
  if (!pos) {
    throw new Error(`Template is missing required label: ${label}`);
  }
  return encodeCell(pos.row + 1, pos.col);
}

function detectLayout(wb, templateSheetName) {
  const ws = wb.Sheets[templateSheetName];
  const utc = utcInfo(ws);
  if (!utc) {
    throw new Error(`Template sheet "${templateSheetName}" has no UTCID01 row.`);
  }

  const conditionRow = findRowColA(ws, 'Condition');
  const confirmRow = findRowColA(ws, 'Confirm');
  const resultRow = findRowColA(ws, 'Result');
  if (!conditionRow || !confirmRow || !resultRow) {
    throw new Error(
      `Template sheet "${templateSheetName}" must include Condition, Confirm, and Result labels in column A.`,
    );
  }

  const nAB = findCell(ws, 'N/A/B');
  const totalTestCases = findCell(ws, 'Total Test Cases');
  if (!nAB || !totalTestCases) {
    throw new Error(
      `Template sheet "${templateSheetName}" is missing N/A/B or Total Test Cases labels.`,
    );
  }

  return {
    templateSheetName,
    utcRow: utc.utcRow,
    caseStartCol: utc.caseStartCol,
    conditionRow,
    confirmRow,
    resultRow,
    passedCell: cellBelowLabel(ws, 'Passed'),
    failedCell: cellBelowLabel(ws, 'Failed'),
    untestedCell: cellBelowLabel(ws, 'Untested'),
    nCountCell: encodeCell(nAB.row + 1, nAB.col),
    aCountCell: encodeCell(nAB.row + 1, nAB.col + 1),
    bCountCell: encodeCell(nAB.row + 1, nAB.col + 2),
    totalCell: encodeCell(totalTestCases.row + 1, totalTestCases.col),
  };
}

function pickTemplateSheetName(wb, preferred) {
  if (preferred) {
    if (!wb.SheetNames.includes(preferred)) {
      throw new Error(`Template sheet not found: ${preferred}`);
    }
    return preferred;
  }

  let bestName = null;
  let bestUtcCount = -1;
  let bestRows = -1;

  for (const name of wb.SheetNames) {
    if (BASE_SHEETS.has(name)) continue;
    const ws = wb.Sheets[name];
    const utc = utcInfo(ws);
    if (!utc) continue;
    if (!findRowColA(ws, 'Condition') || !findRowColA(ws, 'Confirm') || !findRowColA(ws, 'Result')) {
      continue;
    }

    let utcCount = 0;
    for (let col = utc.caseStartCol; col <= utc.lastCol; col += 1) {
      const value = getCell(ws, utc.utcRow, col)?.v;
      if (typeof value === 'string' && value.startsWith('UTCID')) {
        utcCount += 1;
      }
    }

    const rows = decodeRange(ws).e.r + 1;
    if (utcCount > bestUtcCount || (utcCount === bestUtcCount && rows > bestRows)) {
      bestName = name;
      bestUtcCount = utcCount;
      bestRows = rows;
    }
  }

  if (!bestName) {
    throw new Error('No suitable function sheet template found.');
  }

  return bestName;
}

function sanitizeSheetName(name) {
  const trimmed = String(name || '').trim() || 'Function';
  return trimmed.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31);
}

function makeUniqueSheetName(existingNames, desired) {
  if (!existingNames.includes(desired)) return desired;

  const base = desired.length > 28 ? desired.slice(0, 28) : desired;
  let index = 2;
  while (true) {
    const candidate = `${base}-${index}`;
    if (!existingNames.includes(candidate)) return candidate;
    index += 1;
  }
}

function asList(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeScalar(value) {
  return value === null ? 'null' : value;
}

function scalarKey(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function setHeaderValue(ws, label, offsetCols, value, searchMaxRow = 10, searchMaxCol = 20) {
  for (let row = 1; row <= searchMaxRow; row += 1) {
    for (let col = 1; col <= searchMaxCol; col += 1) {
      const cell = getCell(ws, row, col);
      if (cell && cell.v === label) {
        let targetCol = null;
        for (let scanCol = col + 1; scanCol <= searchMaxCol; scanCol += 1) {
          const scanCell = getCell(ws, row, scanCol);
          if (!scanCell || scanCell.v === undefined || scanCell.v === '') {
            continue;
          }
          if (typeof scanCell.v === 'string' && HEADER_LABELS.has(scanCell.v)) {
            continue;
          }
          targetCol = scanCol;
          break;
        }

        setCellValue(ws, row, targetCol || col + offsetCols, value);
        return;
      }
    }
  }
}

function writeMarks(ws, row, colStart, activeCaseIndexes) {
  for (const index of activeCaseIndexes) {
    setCellValue(ws, row, colStart + index, 'O');
  }
}

function mapToEntries(map) {
  return Array.from(map.values());
}

function normalizeInputSectionKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function assertRealInputName(functionName, inputName) {
  if (!SYNTHETIC_INPUT_SECTION_KEYS.has(normalizeInputSectionKey(inputName))) {
    return;
  }

  throw new Error(
    `Function "${functionName || 'Unknown function'}" case input "${inputName}" is a synthetic worksheet section. ` +
      'Use real request parameters in inputs and move workflow/state notes to preconditions or compact returns.',
  );
}

function populateFunctionSheet(ws, layout, fn) {
  const cases = Array.isArray(fn.cases) ? fn.cases : [];
  const maxCol = decodeRange(ws).e.c + 1;

  setHeaderValue(ws, 'Function Code', 2, fn.function_code || '');
  setHeaderValue(ws, 'Function Name', 2, fn.function_name || '');
  setHeaderValue(ws, 'Created By', 2, fn.created_by || '');
  setHeaderValue(ws, 'Executed By', 2, fn.executed_by || fn.created_by || '');
  setHeaderValue(ws, 'Lines  of code', 2, fn.loc || '');
  setHeaderValue(ws, 'Test requirement', 2, fn.test_requirement || '');

  clearRange(ws, layout.utcRow, layout.resultRow + 3, 1, maxCol);

  setCellValue(ws, layout.conditionRow, 1, 'Condition');
  setCellValue(ws, layout.conditionRow, 2, 'Precondition ');
  setCellValue(ws, layout.confirmRow, 1, 'Confirm');
  setCellValue(ws, layout.confirmRow, 2, 'Return');
  setCellValue(ws, layout.resultRow, 1, 'Result');
  setCellValue(ws, layout.resultRow, 2, 'Type(N : Normal, A : Abnormal, B : Boundary)');
  setCellValue(ws, layout.resultRow + 1, 2, 'Passed/Failed');
  setCellValue(ws, layout.resultRow + 2, 2, 'Executed Date');
  setCellValue(ws, layout.resultRow + 3, 2, 'Defect ID');

  for (let index = 0; index < cases.length; index += 1) {
    setCellValue(ws, layout.utcRow, layout.caseStartCol + index, `UTCID${String(index + 1).padStart(2, '0')}`);
  }

  const preconditionsMap = new Map();
  const inputsMap = new Map();
  const returnsMap = new Map();
  const exceptionsMap = new Map();
  const logsMap = new Map();

  cases.forEach((testCase, caseIndex) => {
    asList(testCase.preconditions).forEach((precondition) => {
      const text = String(precondition);
      if (!preconditionsMap.has(text)) {
        preconditionsMap.set(text, { text, cases: [] });
      }
      preconditionsMap.get(text).cases.push(caseIndex);
    });

    const inputs = testCase.inputs || {};
    for (const [inputName, rawValue] of Object.entries(inputs)) {
      assertRealInputName(fn.function_name, inputName);
      if (!inputsMap.has(inputName)) {
        inputsMap.set(inputName, new Map());
      }
      const values = inputsMap.get(inputName);

      asList(rawValue).forEach((value) => {
        const normalized = normalizeScalar(value);
        const key = scalarKey(normalized);
        if (!values.has(key)) {
          values.set(key, {
            display: normalized,
            cases: [],
          });
        }
        values.get(key).cases.push(caseIndex);
      });
    }

    asList(testCase.returns).forEach((item) => {
      const text = String(item);
      if (!returnsMap.has(text)) {
        returnsMap.set(text, { text, cases: [] });
      }
      returnsMap.get(text).cases.push(caseIndex);
    });

    asList(testCase.exceptions).forEach((item) => {
      const text = String(item);
      if (!exceptionsMap.has(text)) {
        exceptionsMap.set(text, { text, cases: [] });
      }
      exceptionsMap.get(text).cases.push(caseIndex);
    });

    asList(testCase.logs).forEach((item) => {
      const text = String(item);
      if (!logsMap.has(text)) {
        logsMap.set(text, { text, cases: [] });
      }
      logsMap.get(text).cases.push(caseIndex);
    });
  });

  const conditionCapacity = layout.confirmRow - layout.conditionRow - 1;
  const conditionRequired =
    preconditionsMap.size +
    Array.from(inputsMap.values()).reduce((sum, values) => sum + 1 + values.size, 0);
  if (conditionRequired > conditionCapacity) {
    throw new Error(
      `Function "${fn.function_name}" needs ${conditionRequired} condition rows, but the template only has ${conditionCapacity}.`,
    );
  }

  const confirmCapacity = layout.resultRow - layout.confirmRow - 1;
  const confirmRequired =
    returnsMap.size +
    (exceptionsMap.size > 0 ? exceptionsMap.size + 1 : 0) +
    (logsMap.size > 0 ? logsMap.size + 1 : 0);
  if (confirmRequired > confirmCapacity) {
    throw new Error(
      `Function "${fn.function_name}" needs ${confirmRequired} confirm rows, but the template only has ${confirmCapacity}.`,
    );
  }

  let row = layout.conditionRow + 1;
  mapToEntries(preconditionsMap).forEach((entry) => {
    setCellValue(ws, row, 4, entry.text);
    writeMarks(ws, row, layout.caseStartCol, entry.cases);
    row += 1;
  });

  for (const [inputName, valuesMap] of inputsMap.entries()) {
    setCellValue(ws, row, 2, inputName);
    row += 1;
    for (const entry of valuesMap.values()) {
      setCellValue(ws, row, 4, entry.display);
      writeMarks(ws, row, layout.caseStartCol, entry.cases);
      row += 1;
    }
  }

  row = layout.confirmRow + 1;
  mapToEntries(returnsMap).forEach((entry) => {
    setCellValue(ws, row, 4, entry.text);
    writeMarks(ws, row, layout.caseStartCol, entry.cases);
    row += 1;
  });

  if (exceptionsMap.size > 0) {
    setCellValue(ws, row, 2, 'Exception');
    row += 1;
    mapToEntries(exceptionsMap).forEach((entry) => {
      setCellValue(ws, row, 4, entry.text);
      writeMarks(ws, row, layout.caseStartCol, entry.cases);
      row += 1;
    });
  }

  if (logsMap.size > 0) {
    setCellValue(ws, row, 2, 'Log message');
    row += 1;
    mapToEntries(logsMap).forEach((entry) => {
      setCellValue(ws, row, 4, entry.text);
      writeMarks(ws, row, layout.caseStartCol, entry.cases);
      row += 1;
    });
  }

  cases.forEach((testCase, index) => {
    setCellValue(ws, layout.resultRow, layout.caseStartCol + index, (testCase.type || '').toUpperCase());
    setCellValue(
      ws,
      layout.resultRow + 1,
      layout.caseStartCol + index,
      (testCase.status || '').toUpperCase(),
    );
    setCellValue(ws, layout.resultRow + 2, layout.caseStartCol + index, testCase.executed_date || '');
    setCellValue(ws, layout.resultRow + 3, layout.caseStartCol + index, testCase.defect_id || '');
  });

  const passedCount = cases.filter((testCase) => String(testCase.status || '').toUpperCase() === 'P').length;
  const failedCount = cases.filter((testCase) => String(testCase.status || '').toUpperCase() === 'F').length;
  const untestedCount = Math.max(cases.length - passedCount - failedCount, 0);
  const nCount = cases.filter((testCase) => String(testCase.type || '').toUpperCase() === 'N').length;
  const aCount = cases.filter((testCase) => String(testCase.type || '').toUpperCase() === 'A').length;
  const bCount = cases.filter((testCase) => String(testCase.type || '').toUpperCase() === 'B').length;

  setFormulaValueByRef(ws, layout.passedCell, passedCount);
  setFormulaValueByRef(ws, layout.failedCell, failedCount);
  setFormulaValueByRef(ws, layout.untestedCell, untestedCount);
  setFormulaValueByRef(ws, layout.nCountCell, nCount);
  setFormulaValueByRef(ws, layout.aCountCell, aCount);
  setFormulaValueByRef(ws, layout.bCountCell, bCount);
  setFormulaValueByRef(ws, layout.totalCell, cases.length);

  return {
    passedCount,
    failedCount,
    untestedCount,
    nCount,
    aCount,
    bCount,
    totalCount: cases.length,
  };
}

function updateCover(wb, meta) {
  if (!wb.Sheets.Cover) return;
  const ws = wb.Sheets.Cover;
  if (meta.project_name) setCellValue(ws, 4, 2, meta.project_name);
  if (meta.project_code) setCellValue(ws, 5, 2, meta.project_code);
  if (meta.creator) setCellValue(ws, 4, 6, meta.creator);
  if (meta.reviewer) setCellValue(ws, 5, 6, meta.reviewer);
  if (meta.issue_date) setCellValue(ws, 6, 6, meta.issue_date);
  if (meta.version) setCellValue(ws, 7, 6, meta.version);
}

function updateFunctionList(wb, functions, sheetNameMap) {
  if (!wb.Sheets['Function List']) return;
  const ws = wb.Sheets['Function List'];
  const maxRow = decodeRange(ws).e.r + 1;
  clearRange(ws, 11, Math.max(maxRow, 11 + functions.length + 10), 1, 7);

  functions.forEach((fn, index) => {
    const row = 11 + index;
    setCellValue(ws, row, 1, index + 1);
    setCellValue(ws, row, 2, fn.class_name || '');
    setCellValue(ws, row, 3, fn.function_name || '');
    setCellValue(ws, row, 4, fn.function_code || '');
    setCellValue(ws, row, 5, sheetNameMap[index]);
    setCellValue(ws, row, 6, fn.description || '');
    setCellValue(ws, row, 7, fn.precondition || '');
  });
}

function escapeSheetRef(sheetName) {
  return sheetName.replace(/'/g, "''");
}

function updateTestReport(wb, functions, sheetNameMap, layout, summaryMap) {
  if (!wb.Sheets['Test Report']) return;
  const ws = wb.Sheets['Test Report'];
  const maxRow = decodeRange(ws).e.r + 1;
  clearRange(ws, 12, Math.max(maxRow, 12 + functions.length + 10), 1, 9);

  functions.forEach((fn, index) => {
    const row = 12 + index;
    const sheetName = sheetNameMap[index];
    const sheetRef = escapeSheetRef(sheetName);

    setCellValue(ws, row, 1, index + 1);
    setCellValue(ws, row, 2, fn.function_code || '');
    const summary = summaryMap[index] || {};
    setFormula(ws, row, 3, `'${sheetRef}'!${layout.passedCell}`, summary.passedCount || 0);
    setFormula(ws, row, 4, `'${sheetRef}'!${layout.failedCell}`, summary.failedCount || 0);
    setFormula(ws, row, 5, `'${sheetRef}'!${layout.untestedCell}`, summary.untestedCount || 0);
    setFormula(ws, row, 6, `'${sheetRef}'!${layout.nCountCell}`, summary.nCount || 0);
    setFormula(ws, row, 7, `'${sheetRef}'!${layout.aCountCell}`, summary.aCount || 0);
    setFormula(ws, row, 8, `'${sheetRef}'!${layout.bCountCell}`, summary.bCount || 0);
    setFormula(ws, row, 9, `'${sheetRef}'!${layout.totalCell}`, summary.totalCount || 0);
  });
}

function removeSheet(wb, name) {
  delete wb.Sheets[name];
  wb.SheetNames = wb.SheetNames.filter((sheetName) => sheetName !== name);
  if (wb.Workbook && Array.isArray(wb.Workbook.Sheets)) {
    wb.Workbook.Sheets = wb.Workbook.Sheets.filter((sheet) => sheet.name !== name);
  }
}

function renameSheet(wb, oldName, newName) {
  const index = wb.SheetNames.indexOf(oldName);
  if (index === -1) {
    throw new Error(`Sheet not found for rename: ${oldName}`);
  }

  wb.SheetNames[index] = newName;
  wb.Sheets[newName] = wb.Sheets[oldName];
  delete wb.Sheets[oldName];

  if (wb.Workbook && Array.isArray(wb.Workbook.Sheets)) {
    const workbookSheet = wb.Workbook.Sheets.find((sheet) => sheet.name === oldName);
    if (workbookSheet) {
      workbookSheet.name = newName;
      workbookSheet.Hidden = 0;
    }
  }
}

function cloneSheet(sheet) {
  if (typeof structuredClone === 'function') {
    return structuredClone(sheet);
  }
  return JSON.parse(JSON.stringify(sheet));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = readJsonPayload(args.input);
  const functions = Array.isArray(payload.functions) ? payload.functions : [];

  if (functions.length !== 1) {
    throw new Error(
      'This generator now expects exactly one functions[] item per workbook. Merge all UTC cases for the requested business function into a single sheet.',
    );
  }

  if (!fs.existsSync(args.template)) {
    throw new Error(`Template workbook not found: ${args.template}`);
  }
  if (fs.existsSync(args.output) && !args.overwrite) {
    throw new Error(`Output already exists: ${args.output}`);
  }

  const wb = XLSX.readFile(args.template, {
    cellStyles: true,
    cellNF: true,
    cellFormula: true,
    sheetStubs: true,
  });

  const templateSheetName = pickTemplateSheetName(wb, args.templateFunctionSheet);
  const layout = detectLayout(wb, templateSheetName);

  for (const sheetName of [...wb.SheetNames]) {
    if (sheetName !== templateSheetName) {
      removeSheet(wb, sheetName);
    }
  }

  const onlyFunction = functions[0];
  const desiredName = sanitizeSheetName(
    onlyFunction.sheet_name || onlyFunction.function_name || onlyFunction.function_code || 'Function',
  );
  const actualName = makeUniqueSheetName(
    wb.SheetNames.filter((name) => name !== templateSheetName),
    desiredName,
  );

  if (actualName !== templateSheetName) {
    renameSheet(wb, templateSheetName, actualName);
  }

  if (wb.Workbook && Array.isArray(wb.Workbook.Sheets)) {
    const workbookSheet = wb.Workbook.Sheets.find((sheet) => sheet.name === actualName);
    if (workbookSheet) {
      workbookSheet.Hidden = 0;
    }
    wb.Workbook.Names = [];
  }

  populateFunctionSheet(wb.Sheets[actualName], layout, onlyFunction);

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  XLSX.writeFile(wb, args.output, {
    bookType: 'xlsx',
    cellStyles: true,
    compression: true,
  });

  process.stdout.write(`${args.output}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
