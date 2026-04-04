import * as fs from 'node:fs';
import * as path from 'node:path';

const BLOCK_START_RE = /^\s*(class|interface|abstract\s+class|enum)\s+([A-Za-z_][\w.]*)\s*\{\s*$/;

const SKIP_OUTPUT_NAMES = new Set([]);

const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..'); // SEP492-Project/
const CODE_ROOTS = [
  path.join(PROJECT_ROOT, 'server', 'src'),
  path.join(PROJECT_ROOT, 'client', 'src'),
];

// NOTE: We intentionally do NOT assume framework/external types have "infinite" members.
// Teacher guideline: only use `...` when the visible list is too long.
// If a UC only shows a few methods (even for framework types), we list them without `...`.
const EXTERNAL_MEMBER_HINTS = new Map([]);

// Teacher rule: only use `...` when there are *many* omitted members.
// If only a few are omitted, prefer listing them (we may not always be able to auto-expand,
// but we should avoid implying "many" when the gap is small).
const MAX_SECTION_LINES = 10;

function listPumlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.puml'))
    .map((e) => path.join(dir, e.name))
    .sort();
}

function isEllipsisLine(line) {
  const t = String(line).trim();
  return t === '...' || t === '…';
}

function splitBody(bodyLines) {
  const cleaned = bodyLines
    .map((l) => String(l).replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith("'"));

  const dividerIndex = cleaned.findIndex((l) => l.trim() === '--');
  if (dividerIndex >= 0) {
    return {
      attrs: cleaned.slice(0, dividerIndex),
      methods: cleaned.slice(dividerIndex + 1),
    };
  }

  // Heuristic: methods contain parentheses
  const attrs = [];
  const methods = [];
  for (const line of cleaned) {
    if (/\([^)]*\)/.test(line)) methods.push(line);
    else attrs.push(line);
  }
  return { attrs, methods };
}

function indentLine(line, indent) {
  // Keep existing indentation if it already has it, otherwise apply.
  if (/^\s+/.test(line)) return line;
  return `${indent}${line}`;
}

function walkFiles(rootDir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(rootDir)) return out;

  /** @type {string[]} */
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        // Skip build artifacts and deps
        const lower = e.name.toLowerCase();
        if (lower === 'node_modules' || lower === 'dist' || lower === 'build' || lower === '.next') continue;
        stack.push(full);
      } else if (e.isFile()) {
        const lower = e.name.toLowerCase();
        if (lower.endsWith('.ts') || lower.endsWith('.tsx')) out.push(full);
      }
    }
  }
  return out;
}

/**
 * Best-effort member extraction from TS source.
 * Returns counts, not full member names, because we only need to decide whether `...` is necessary.
 */
function extractMemberCountsFromTsText(tsText, className) {
  const idx = tsText.search(new RegExp(`\\b(class|interface|abstract\\s+class)\\s+${className}\\b`));
  if (idx === -1) return null;

  const slice = tsText.slice(idx);
  const braceStart = slice.indexOf('{');
  if (braceStart === -1) return null;

  let i = braceStart + 1;
  let depth = 1;
  let body = '';
  while (i < slice.length && depth > 0) {
    const ch = slice[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth > 0) body += ch;
    i++;
  }

  const lines = body.split(/\r?\n/);
  let attrs = 0;
  let methods = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*') || line.startsWith('*')) continue;

    // Methods (including async, getters/setters)
    const mMethod = line.match(
      /^(public|private|protected)?\s*(static\s+)?(readonly\s+)?(async\s+)?(get\s+|set\s+)?([A-Za-z_][\w]*)\s*\(/,
    );
    if (mMethod) {
      const name = mMethod[6];
      if (name !== 'constructor') methods++;
      continue;
    }

    // Properties: name: Type; or name = ...;
    const mProp = line.match(/^(public|private|protected)?\s*(static\s+)?(readonly\s+)?([A-Za-z_][\w]*)\s*(:|=)/);
    if (mProp) {
      const name = mProp[4];
      if (name !== 'constructor') attrs++;
      continue;
    }
  }

  return { attrs, methods };
}

/**
 * Extract best-effort member signatures from TS source so we can list real members.
 * Returns null if the class/interface is not found.
 */
function extractMemberLinesFromTsText(tsText, className) {
  const idx = tsText.search(new RegExp(`\\b(class|interface|abstract\\s+class)\\s+${className}\\b`));
  if (idx === -1) return null;

  const slice = tsText.slice(idx);
  const braceStart = slice.indexOf('{');
  if (braceStart === -1) return null;

  let i = braceStart + 1;
  let depth = 1;
  let body = '';
  while (i < slice.length && depth > 0) {
    const ch = slice[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth > 0) body += ch;
    i++;
  }

  const lines = body.split(/\r?\n/);

  /** @type {string[]} */
  const attrs = [];
  /** @type {string[]} */
  const methods = [];

  const visSymbol = (modifier) => {
    const m = String(modifier || '').trim();
    if (m === 'private') return '-';
    if (m === 'protected') return '#';
    return '+';
  };

  // Track nesting inside decorator object literals and method bodies.
  // We only want members declared at the class top-level.
  let nestedDepth = 0;

  const countBracesDelta = (s) => {
    let delta = 0;
    for (const ch of String(s)) {
      if (ch === '{') delta++;
      else if (ch === '}') delta--;
    }
    return delta;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      nestedDepth += countBracesDelta(rawLine);
      if (nestedDepth < 0) nestedDepth = 0;
      continue;
    }
    if (line.startsWith('//')) {
      nestedDepth += countBracesDelta(rawLine);
      if (nestedDepth < 0) nestedDepth = 0;
      continue;
    }
    if (line.startsWith('/*') || line.startsWith('*')) {
      nestedDepth += countBracesDelta(rawLine);
      if (nestedDepth < 0) nestedDepth = 0;
      continue;
    }

    if (nestedDepth === 0) {
      if (line.startsWith('@')) {
        // Decorator lines themselves are not members.
      } else {
        // Getter without parentheses: get badge(): Type {
        const mGet = line.match(
          /^(public|private|protected)?\s*(static\s+)?get\s+([A-Za-z_][\w]*)\s*\(\s*\)?\s*:\s*([^\{;]+?)(\{|;|$)/,
        );
        if (mGet) {
          const vis = visSymbol(mGet[1]);
          const name = mGet[3];
          const returnType = String(mGet[4] || '').trim();
          methods.push(`${vis} ${name}(): ${returnType}`);
        } else {
          // Regular methods: foo(a: A): R { ... }
          const mMethod = line.match(
            /^(public|private|protected)?\s*(static\s+)?(readonly\s+)?(async\s+)?([A-Za-z_][\w]*)\s*\(([^)]*)\)\s*(?::\s*([^\{;]+))?/,
          );
          if (mMethod) {
            const name = mMethod[5];
            if (name !== 'constructor') {
              const vis = visSymbol(mMethod[1]);
              const params = String(mMethod[6] || '').trim();
              const returnType = String(mMethod[7] || '').trim();
              if (returnType) methods.push(`${vis} ${name}(${params}): ${returnType}`);
              else methods.push(`${vis} ${name}(${params})`);
            }
          } else {
            // Properties: name: Type;
            // Require trailing ';' so we don't capture decorator object literal keys (which often end with ',').
            const mProp = line.match(
              /^(public|private|protected)?\s*(static\s+)?(readonly\s+)?([A-Za-z_][\w]*)\s*:\s*([^;=]+)\s*;$/,
            );
            if (mProp) {
              const vis = visSymbol(mProp[1]);
              const name = mProp[4];
              const type = String(mProp[5] || '').trim();
              attrs.push(`${vis} ${name}: ${type}`);
            }
          }
        }
      }
    }

    nestedDepth += countBracesDelta(rawLine);
    if (nestedDepth < 0) nestedDepth = 0;
  }

  return { attrs, methods };
}

function buildCodeIndex() {
  const files = CODE_ROOTS.flatMap((r) => walkFiles(r));
  return { files };
}

function getFullMemberCounts(className, codeIndex) {
  if (EXTERNAL_MEMBER_HINTS.has(className)) return EXTERNAL_MEMBER_HINTS.get(className);

  // A symbol name can appear in multiple files (e.g., local UI interfaces).
  // For ellipsis decisions we want to avoid claiming "many more" unless we're confident.
  // So we select the *smallest* matching member-count across all definitions.
  /** @type {{attrs:number, methods:number} | null} */
  let best = null;
  for (const file of codeIndex.files) {
    const text = fs.readFileSync(file, 'utf8');
    const counts = extractMemberCountsFromTsText(text, className);
    if (!counts) continue;
    if (!best) {
      best = counts;
      continue;
    }
    const bestTotal = best.attrs + best.methods;
    const curTotal = counts.attrs + counts.methods;
    if (curTotal < bestTotal) best = counts;
  }
  if (best) return best;
  // Unknown/unresolved: don't force ellipsis unless the source already has it.
  return null;
}

function getFullMemberLines(className, codeIndex) {
  /** @type {{attrs:string[], methods:string[]} | null} */
  let best = null;
  let bestTotal = -1;

  for (const file of codeIndex.files) {
    const text = fs.readFileSync(file, 'utf8');
    const members = extractMemberLinesFromTsText(text, className);
    if (!members) continue;
    const total = (members.attrs?.length ?? 0) + (members.methods?.length ?? 0);
    if (total > bestTotal) {
      best = members;
      bestTotal = total;
    }
  }
  return best;
}

function stripEllipsis(lines) {
  return lines.filter((l) => !isEllipsisLine(l));
}

function memberNameKey(line, kind) {
  const s = String(line ?? '').trim();
  if (!s) return null;
  if (kind === 'attr') {
    const m = s.match(/^[+\-#~]?\s*([A-Za-z_][\w]*)\s*:/);
    return m ? m[1] : null;
  }
  if (kind === 'method') {
    const m = s.match(/^[+\-#~]?\s*([A-Za-z_][\w]*)\s*\(/);
    return m ? m[1] : null;
  }
  return null;
}

function buildPreferredSection(ucLines, fullLines, kind) {
  const ucClean = stripEllipsis(ucLines || []).filter((l) => String(l).trim().length > 0);
  const fullClean = stripEllipsis(fullLines || []).filter((l) => String(l).trim().length > 0);

  /** @type {Set<string>} */
  const usedNames = new Set();
  /** @type {string[]} */
  const out = [];

  for (const l of ucClean) {
    out.push(l);
    const k = memberNameKey(l, kind);
    if (k) usedNames.add(k);
  }

  for (const l of fullClean) {
    if (out.length >= MAX_SECTION_LINES) break;
    const k = memberNameKey(l, kind);
    if (k && usedNames.has(k)) continue;
    out.push(l);
    if (k) usedNames.add(k);
  }

  // Decide whether ellipsis is needed: only when the real class has > 10 members
  // in this compartment.
  const needsEllipsis = fullClean.length > MAX_SECTION_LINES;

  // If UC itself listed >10 lines, clamp and add ellipsis.
  const clamped = out.slice(0, MAX_SECTION_LINES);
  const wasTruncated = out.length > MAX_SECTION_LINES;
  if ((needsEllipsis || wasTruncated) && clamped.length === MAX_SECTION_LINES) {
    return [...clamped, '...'];
  }
  return clamped;
}

function ensureEllipsisIfNeeded(listedLines, fullCount) {
  const hadEllipsisInSource = (listedLines || []).some((l) => isEllipsisLine(l));
  const cleaned = stripEllipsis(listedLines);

  // If the author explicitly put `...` in the source, keep it.
  if (hadEllipsisInSource) {
    if (cleaned.length === 0) return { lines: ['...'], added: true };
    return { lines: [...cleaned, '...'], added: true };
  }

  // If this UC lists nothing in the compartment, do not add ellipsis.
  // (Avoid implying "many" when nothing is shown.)
  if (cleaned.length === 0) return { lines: cleaned, added: false };

  if (fullCount == null) return { lines: cleaned, added: false };

  // Teacher rule: only use `...` when the *real* compartment is longer than 10.
  // If fullCount <= 10, prefer listing everything (handled elsewhere when we can extract).
  if (fullCount <= MAX_SECTION_LINES) return { lines: cleaned, added: false };

  const listedCount = cleaned.length;
  const omitted = Math.max(0, fullCount - listedCount);
  if (omitted <= 0) return { lines: cleaned, added: false };
  return { lines: [...cleaned, '...'], added: true };
}

function clampSectionToMax(lines) {
  const cleaned = stripEllipsis(lines || []);
  if (cleaned.length <= MAX_SECTION_LINES) return { lines: cleaned, truncated: false };
  return { lines: cleaned.slice(0, MAX_SECTION_LINES), truncated: true };
}

function makeCompactPuml(text, codeIndex) {
  const lines = text.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(BLOCK_START_RE);
    if (!m) {
      out.push(line);
      continue;
    }

    const kindToken = m[1];
    const isEnum = kindToken.trim().startsWith('enum');
    const className = m[2];

    // Teacher requirement: enums are NOT shown in class diagrams.
    // Skip emitting the entire enum block in compact output.
    if (isEnum) {
      i++;
      while (i < lines.length && (lines[i] ?? '').trim() !== '}') i++;
      continue;
    }

    out.push(line);
    /** @type {string[]} */
    const body = [];
    i++;
    while (i < lines.length && (lines[i] ?? '').trim() !== '}') {
      body.push(lines[i]);
      i++;
    }

    // Detect indentation from first non-empty line, fallback to 4 spaces.
    const firstNonEmpty = body.find((l) => l.trim().length > 0);
    const indent = firstNonEmpty ? (firstNonEmpty.match(/^\s*/)?.[0] ?? '    ') : '    ';

    const { attrs: ucAttrs, methods: ucMethods } = splitBody(body);

    // Prefer UC-listed members first, then fill from real TS members.
    const fullLines = getFullMemberLines(className, codeIndex);
    let finalAttrs = null;
    let finalMethods = null;

    if (fullLines) {
      finalAttrs = buildPreferredSection(ucAttrs, fullLines.attrs, 'attr');
      finalMethods = buildPreferredSection(ucMethods, fullLines.methods, 'method');
    } else {
      const full = getFullMemberCounts(className, codeIndex);
      const fullAttrs = full?.attrs ?? null;
      const fullMethods = full?.methods ?? null;

      const eAttrs = ensureEllipsisIfNeeded(ucAttrs, fullAttrs);
      const eMethods = ensureEllipsisIfNeeded(ucMethods, fullMethods);

      finalAttrs = eAttrs.lines;
      finalMethods = eMethods.lines;
    }

    // Teacher requirement: every class/interface must have 2 compartments.
    for (const l of finalAttrs) out.push(indentLine(l, indent));
    out.push(`${indent}--`);
    for (const l of finalMethods) out.push(indentLine(l, indent));

    out.push(lines[i] ?? '}');
  }

  return out.join('\n');
}

function main() {
  const rawArgs = process.argv.slice(2);
  let overwrite = false;
  /** @type {string[]} */
  const positional = [];
  for (const a of rawArgs) {
    if (a === '--overwrite') {
      overwrite = true;
      continue;
    }
    positional.push(a);
  }

  const inDir = positional[0] ? path.resolve(positional[0]) : process.cwd();
  const outDir = positional[1] ? path.resolve(positional[1]) : inDir;

  fs.mkdirSync(outDir, { recursive: true });

  const files = listPumlFiles(inDir);
  let written = 0;

  const codeIndex = buildCodeIndex();

  for (const file of files) {
    const base = path.basename(file);
    if (base.toLowerCase().endsWith('_compact.puml')) continue;

    const content = fs.readFileSync(file, 'utf8');
    const compact = makeCompactPuml(content, codeIndex);

    const outName = base.replace(/\.puml$/i, '_compact.puml');
    if (SKIP_OUTPUT_NAMES.has(outName)) continue;
    const outPath = path.join(outDir, outName);

    if (!overwrite && fs.existsSync(outPath)) continue;
    fs.writeFileSync(outPath, compact, 'utf8');
    written++;
  }

  console.log(`Wrote ${written} compact .puml file(s) -> ${outDir}`);
}

main();
