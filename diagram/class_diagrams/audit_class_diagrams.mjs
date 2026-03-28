import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..'); // SEP492-Project/
const DIAGRAM_DIR = process.cwd(); // run from diagram/class_diagrams
const CODE_ROOTS = [path.join(PROJECT_ROOT, 'server', 'src'), path.join(PROJECT_ROOT, 'client', 'src')];

// Some diagrams intentionally model TS modules (files with exported functions)
// as pseudo-classes like `SupabaseStorageUtil`.
// These won't appear as symbol declarations, so we validate them by file presence.
const MODULE_BACKED = new Map([
  ['SupabaseStorageUtil', path.join(PROJECT_ROOT, 'server', 'src', 'common', 'utils', 'supabase-storage.util.ts')],
  ['WatermarkUtil', path.join(PROJECT_ROOT, 'server', 'src', 'common', 'utils', 'watermark.util.ts')],
  ['EncryptionUtil', path.join(PROJECT_ROOT, 'server', 'src', 'common', 'utils', 'encryption.util.ts')],
  ['StorageUtil', path.join(PROJECT_ROOT, 'client', 'src', 'shared', 'utils', 'storage.ts')],
  ['AuthApi', path.join(PROJECT_ROOT, 'client', 'src', 'features', 'auth', 'api.ts')],
]);

// These are allowed to be conceptual or framework/runtime types.
// They may not exist as TS classes in this repo.
const ALLOW_MISSING = new Set([
  // TypeORM / Nest / framework
  'Repository',
  'JwtService',
  'ConfigService',
  'ValidationPipe',
  'JwtAuthGuard',
  'RolesGuard',
  'AuthGuard',
  // JS/TS runtime
  'Date',
  'Buffer',
  'Promise',
  'Map',
  'Set',
  'String',
  'Number',
  'Boolean',
  'Object',
  'Array',
  'RegExp',
  // HTTP boundary concepts
  'WebClient',
  'HttpClient',
]);

const DECL_PATTERNS = [
  (name) => new RegExp(`\\bexport\\s+(?:default\\s+)?(?:abstract\\s+)?class\\s+${name}\\b`),
  (name) => new RegExp(`\\b(?:abstract\\s+)?class\\s+${name}\\b`),
  (name) => new RegExp(`\\bexport\\s+interface\\s+${name}\\b`),
  (name) => new RegExp(`\\binterface\\s+${name}\\b`),
  (name) => new RegExp(`\\bexport\\s+enum\\s+${name}\\b`),
  (name) => new RegExp(`\\benum\\s+${name}\\b`),
  (name) => new RegExp(`\\bexport\\s+type\\s+${name}\\b`),
  (name) => new RegExp(`\\btype\\s+${name}\\b`),
  // React pages/components are often functions or const arrow functions
  (name) => new RegExp(`\\bexport\\s+default\\s+function\\s+${name}\\b`),
  (name) => new RegExp(`\\bexport\\s+function\\s+${name}\\s*\\(`),
  (name) => new RegExp(`\\bfunction\\s+${name}\\s*\\(`),
  (name) => new RegExp(`\\bexport\\s+const\\s+${name}\\b`),
  (name) => new RegExp(`\\bconst\\s+${name}\\s*=\\s*(?:\\(|function\\b|async\\b|\\w*\\s*=>)`),
];

function listFilesRecursive(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const stack = [rootDir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        const lower = e.name.toLowerCase();
        if (lower === 'node_modules' || lower === 'dist' || lower === 'build' || lower === '.next' || lower === 'coverage') continue;
        stack.push(full);
      } else if (e.isFile()) {
        const lower = e.name.toLowerCase();
        if (lower.endsWith('.ts') || lower.endsWith('.tsx')) out.push(full);
      }
    }
  }
  return out;
}

function listDiagramFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.puml') && !e.name.toLowerCase().endsWith('_compact.puml'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

function parsePumlClasses(pumlText) {
  const lines = pumlText.split(/\r?\n/);
  const names = new Set();
  // Accept: class Foo { , class Foo, interface Foo, enum Foo, abstract class Foo
  const re = /^\s*(class|interface|enum|abstract\s+class)\s+([A-Za-z_][\w.]*)\b/;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("'")) continue;
    const m = raw.match(re);
    if (m) names.add(m[2]);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function sanitizeNameForRegex(name) {
  // PlantUML allows dots in names; treat them literally.
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSymbolIndex(tsFiles) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map();

  const re = /(export\s+)?(default\s+)?(abstract\s+)?(class|interface|enum|type|function)\s+([A-Za-z_][\w]*)\b/g;
  const reConst = /(export\s+)?const\s+([A-Za-z_][\w]*)\b/g;

  for (const f of tsFiles) {
    let text;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }

    for (const m of text.matchAll(re)) {
      const name = m[5];
      const kind = m[4];
      if (!index.has(name)) index.set(name, new Set());
      index.get(name).add(kind);
    }

    for (const m of text.matchAll(reConst)) {
      const name = m[2];
      if (!index.has(name)) index.set(name, new Set());
      index.get(name).add('const');
    }
  }

  return index;
}

function editDistance(a, b) {
  // Levenshtein distance (small + good enough)
  const s = a;
  const t = b;
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;

  /** @type {number[]} */
  let prev = new Array(m + 1);
  /** @type {number[]} */
  let cur = new Array(m + 1);

  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    const si = s.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = si === t.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}

function bestCandidates(missingName, existingNames) {
  const miss = missingName.toLowerCase();
  const scored = [];
  for (const cand of existingNames) {
    const c = cand.toLowerCase();
    // quick prefilter: share a suffix/prefix chunk
    const shareSuffix = miss.endsWith('entity') && c.endsWith('entity');
    const shareService = miss.endsWith('service') && c.endsWith('service');
    const shareController = miss.endsWith('controller') && c.endsWith('controller');

    if (shareSuffix || shareService || shareController || c.includes(miss) || miss.includes(c)) {
      const d = editDistance(miss, c);
      scored.push({ cand, d });
    }
  }
  scored.sort((a, b) => a.d - b.d || a.cand.localeCompare(b.cand));
  return scored.slice(0, 5);
}

function symbolExists(name, tsTextIndex) {
  if (tsTextIndex.has(name)) return true;
  // exact match with dot-less name (rare)
  if (name.includes('.')) {
    const tail = name.split('.').pop();
    if (tail && tsTextIndex.has(tail)) return true;
  }
  return false;
}

function isModuleBacked(name) {
  const modulePath = MODULE_BACKED.get(name);
  if (!modulePath) return false;
  try {
    return fs.existsSync(modulePath);
  } catch {
    return false;
  }
}

function main() {
  const tsFiles = CODE_ROOTS.flatMap(listFilesRecursive);
  const symbolIndex = buildSymbolIndex(tsFiles);
  const allSymbols = [...symbolIndex.keys()];

  const diagrams = listDiagramFiles(DIAGRAM_DIR);

  /** @type {{diagramFile:string, missing:Array<{name:string, reason:string, candidates:Array<{cand:string, d:number}>}>}} */
  const results = [];

  for (const df of diagrams) {
    const pumlText = fs.readFileSync(df, 'utf8');
    const names = parsePumlClasses(pumlText);

    /** @type {Array<{name:string, reason:string, candidates:Array<{cand:string, d:number}>}>} */
    const missing = [];

    for (const n of names) {
      if (ALLOW_MISSING.has(n)) continue;

      // PlantUML names might include dots; try exact and tail.
      if (symbolExists(n, symbolIndex)) continue;

      // Pseudo-classes that map to TS modules (files) rather than declared symbols.
      if (isModuleBacked(n)) continue;

      // Some diagrams contain generic role labels (e.g., WebClient (fetch)) that are not identifiers.
      if (/\s/.test(n) || n.includes('(') || n.includes(')')) continue;

      const candidates = bestCandidates(n, allSymbols);
      missing.push({
        name: n,
        reason: 'Not found in server/src or client/src symbol declarations (class/interface/enum/type/function/const).',
        candidates,
      });
    }

    if (missing.length) results.push({ diagramFile: df, missing });
  }

  const reportLines = [];
  reportLines.push(`# Class diagram audit report`);
  reportLines.push('');
  reportLines.push(`- Project root: ${PROJECT_ROOT}`);
  reportLines.push(`- Diagram dir: ${DIAGRAM_DIR}`);
  reportLines.push(`- Code roots: ${CODE_ROOTS.join(', ')}`);
  reportLines.push(`- Diagrams scanned: ${diagrams.length}`);
  reportLines.push(`- TS/TSX files scanned: ${tsFiles.length}`);
  reportLines.push('');

  if (!results.length) {
    reportLines.push('No missing class names detected (excluding allowlisted framework/runtime types).');
  } else {
    reportLines.push(`Found potential issues in ${results.length} diagram(s):`);
    reportLines.push('');

    for (const r of results) {
      reportLines.push(`## ${path.basename(r.diagramFile)}`);
      reportLines.push('');
      for (const m of r.missing) {
        reportLines.push(`- Missing: ${m.name}`);
        if (m.candidates.length) {
          const candStr = m.candidates.map((c) => `${c.cand} (d=${c.d})`).join('; ');
          reportLines.push(`  - Candidates: ${candStr}`);
        }
      }
      reportLines.push('');
    }
  }

  const outPath = path.join(DIAGRAM_DIR, 'audit_class_diagrams_report.md');
  fs.writeFileSync(outPath, reportLines.join('\n'), 'utf8');
  console.log(`Wrote report -> ${outPath}`);

  // Print a short summary to stdout too
  console.log(`Scanned ${diagrams.length} diagram(s). Potential issue diagrams: ${results.length}.`);
}

main();
