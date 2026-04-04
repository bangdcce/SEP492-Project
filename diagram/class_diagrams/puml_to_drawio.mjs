import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function xmlAttrEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

function uuid12() {
  return crypto.randomBytes(6).toString('hex');
}

/**
 * @typedef {{source:string, token:string, target:string, hidden:boolean, directionHint:('left'|'right'|'up'|'down'|null), label:string}} Relation
 * @typedef {{name:string, kind:'class'|'enum', bodyLines:string[], order:number, width:number, height:number, x:number, y:number}} Node
 */

const BLOCK_START_RE = /^\s*(class|enum|interface|abstract\s+class)\s+([A-Za-z_][\w.]*)\s*\{\s*$/;
const TITLE_RE = /^\s*title\s+(.+?)\s*$/;
const RANKSEP_RE = /^\s*skinparam\s+ranksep\s+(\d+)\s*$/;
const NODESEP_RE = /^\s*skinparam\s+nodesep\s+(\d+)\s*$/;
const RELATION_RE =
  /^\s*([A-Za-z_][\w.]*)\s+([-.o*|<>]+(?:\[[^\]]+\])?(?:left|right|up|down)?[-.<>|]*)\s+([A-Za-z_][\w.]*)\s*(?::\s*(.+))?$/;

function normalizeRelationToken(token) {
  let t = String(token);
  t = t.replace(/\[[^\]]+\]/g, '');
  t = t.replace(/left|right|up|down/g, '');
  t = t.trim();
  // Reduce very long tokens to core arrows when possible.
  const known = ['..>', '-->', '*--', 'o--', '--|>', '..|>'];
  for (const k of known) {
    if (t.includes(k)) return k;
  }
  return t;
}

function parsePumlFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  let title = path.basename(filePath, '.puml');
  let ranksep = 120;
  let nodesep = 70;
  let direction = 'LR';

  /** @type {Map<string, Node>} */
  const nodes = new Map();
  /** @type {Relation[]} */
  const relations = [];

  let order = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const stripped = raw.trim();

    if (stripped === 'left to right direction') {
      direction = 'LR';
      continue;
    }

    const mTitle = raw.match(TITLE_RE);
    if (mTitle) {
      title = mTitle[1];
      continue;
    }

    const mRank = raw.match(RANKSEP_RE);
    if (mRank) {
      ranksep = Number.parseInt(mRank[1], 10);
      continue;
    }

    const mNodeSep = raw.match(NODESEP_RE);
    if (mNodeSep) {
      nodesep = Number.parseInt(mNodeSep[1], 10);
      continue;
    }

    if (stripped.startsWith("'")) continue;
    if (stripped.startsWith('@') || stripped.startsWith('skinparam') || stripped.startsWith('hide ')) continue;

    const mBlock = raw.match(BLOCK_START_RE);
    if (mBlock) {
      const kindToken = mBlock[1];
      const name = mBlock[2];
      // Teacher requirement: enums are NOT shown in class diagrams.
      // Skip enum blocks entirely.
      if (kindToken.startsWith('enum')) {
        i++;
        while (i < lines.length && (lines[i] ?? '').trim() !== '}') i++;
        continue;
      }
      const kind = 'class';
      /** @type {string[]} */
      const bodyLines = [];
      i++;
      while (i < lines.length && (lines[i] ?? '').trim() !== '}') {
        bodyLines.push((lines[i] ?? '').replace(/\s+$/, ''));
        i++;
      }
      nodes.set(name, {
        name,
        kind,
        bodyLines,
        order,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      });
      order++;
      continue;
    }

    const mRel = raw.match(RELATION_RE);
    if (mRel) {
      const source = mRel[1];
      const token = mRel[2];
      const target = mRel[3];
      const label = (mRel[4] || '').trim();
      const hidden = token.includes('[hidden]');
      let directionHint = null;
      for (const candidate of ['left', 'right', 'up', 'down']) {
        if (token.includes(candidate)) {
          directionHint = candidate;
          break;
        }
      }
      relations.push({ source, token, target, hidden, directionHint, label });
      continue;
    }
  }

  return { title, ranksep, nodesep, direction, nodes, relations };
}

function splitSections(node) {
  const cleaned = (node.bodyLines || []).map((l) => String(l).trim()).filter((l) => l.length > 0);
  if (node.kind === 'enum') return { attrs: [], methodsOrValues: cleaned };

  const dividerIndex = cleaned.indexOf('--');
  if (dividerIndex >= 0) {
    return {
      attrs: cleaned.slice(0, dividerIndex),
      methodsOrValues: cleaned.slice(dividerIndex + 1),
    };
  }

  // Heuristic split (matches common PlantUML style where methods contain parentheses)
  // so draw.io can render a two-compartment class box like the reference.
  const attrs = [];
  const methodsOrValues = [];
  for (const line of cleaned) {
    // Keep explicit ellipsis lines but place them in the section they appear in.
    // (If the source has only one `...`, it will show in whichever section it belongs.)
    if (/\([^)]*\)/.test(line)) methodsOrValues.push(line);
    else attrs.push(line);
  }
  return { attrs, methodsOrValues };
}

function wrapText(line, width = 52) {
  const s = String(line ?? '');
  if (!s) return [''];

  /** @type {string[]} */
  const out = [];
  let current = '';
  const parts = s.split(/\s+/).filter(Boolean);

  const pushCurrent = () => {
    if (current) out.push(current);
    current = '';
  };

  for (const part of parts) {
    if (part.length > width) {
      pushCurrent();
      for (let i = 0; i < part.length; i += width) out.push(part.slice(i, i + width));
      continue;
    }

    if (!current) {
      current = part;
    } else if (current.length + 1 + part.length <= width) {
      current += ` ${part}`;
    } else {
      pushCurrent();
      current = part;
    }
  }
  pushCurrent();
  return out.length ? out : [s];
}

function buildNodeHtml(node) {
  const { attrs, methodsOrValues } = splitSections(node);

  /** @type {string[][]} */
  let sections = [];
  if (node.kind === 'enum') {
    // Enums: keep a single compartment of values.
    sections = [methodsOrValues];
  } else {
    // Teacher requirement: every class/interface must have 2 compartments:
    // top = attributes, bottom = methods (even if one side is empty).
    sections = [attrs, methodsOrValues];
  }

  /** @type {string[][]} */
  const wrappedSections = [];
  let maxChars = node.name.length;
  let totalLines = 0;

  for (const section of sections) {
    /** @type {string[]} */
    const wrappedLines = [];
    const effectiveLines = section.length > 0 ? section : [''];
    for (const line of effectiveLines) {
      for (const part of wrapText(line)) {
        wrappedLines.push(part);
        maxChars = Math.max(maxChars, part.length);
        totalLines += 1;
      }
    }
    wrappedSections.push(wrappedLines);
  }

  const width = clamp(140, maxChars * 6.2 + 28, 520);
  const headerHeight = 30;
  const lineHeight = 14;
  const sectionPadding = 8;
  const height = headerHeight + totalLines * lineHeight + sectionPadding * Math.max(1, wrappedSections.length);

  const rows = [];
  rows.push(
    `<tr><td style='text-align:center;font-weight:bold;padding:6px 4px;'>${htmlEscape(node.name)}</td></tr>`,
  );

  for (let index = 0; index < wrappedSections.length; index++) {
    const section = wrappedSections[index];
    const border = 'border-top:1px solid #000000;';

    // Section is never empty here because we omit empty compartments above,
    // but keep this defensive (and still avoid rendering a blank placeholder).
    const content =
      section.length > 0
        ? section
            .map((line) => {
              // Keep the compartment visible even when empty.
              const safe = line ? htmlEscape(line) : '&nbsp;';
              return `<div style='line-height:1.25;padding-left:2px;'>${safe}</div>`;
            })
            .join('')
        : '&nbsp;';
    rows.push(
      `<tr><td style='${border}vertical-align:top;padding:4px 4px 6px 4px;'>${content}</td></tr>`,
    );
  }

  const table = `<table style='width:100%;height:100%;border-collapse:collapse;'>${rows.join('')}</table>`;
  return { html: table, width, height };
}

function resolveLayout(nodes, relations, ranksep, nodesep, direction) {
  /** @type {Map<string, number>} */
  const cols = new Map();
  /** @type {Map<string, number>} */
  const rows = new Map();

  for (const name of nodes.keys()) {
    cols.set(name, 0);
    rows.set(name, 0);
  }

  for (let iter = 0; iter < nodes.size * 4; iter++) {
    let changed = false;
    for (const rel of relations) {
      if (!nodes.has(rel.source) || !nodes.has(rel.target)) continue;

      const srcCol = cols.get(rel.source) ?? 0;
      const dstCol = cols.get(rel.target) ?? 0;
      const srcRow = rows.get(rel.source) ?? 0;
      const dstRow = rows.get(rel.target) ?? 0;

      if (rel.hidden) {
        if (rel.directionHint === 'right' && dstCol < srcCol + 1) {
          cols.set(rel.target, srcCol + 1);
          changed = true;
        } else if (rel.directionHint === 'left' && srcCol < dstCol + 1) {
          cols.set(rel.source, dstCol + 1);
          changed = true;
        } else if (rel.directionHint === 'down' && dstRow < srcRow + 1) {
          rows.set(rel.target, srcRow + 1);
          changed = true;
        } else if (rel.directionHint === 'up' && srcRow < dstRow + 1) {
          rows.set(rel.source, dstRow + 1);
          changed = true;
        }
        continue;
      }

      if (direction === 'LR' && dstCol < srcCol + 1) {
        cols.set(rel.target, srcCol + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  /** @type {Map<number, Node[]>} */
  const columns = new Map();
  for (const node of nodes.values()) {
    const col = cols.get(node.name) ?? 0;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col).push(node);
  }

  /** @type {Map<number, number>} */
  const xPositions = new Map();
  let xCursor = 40;
  const sortedCols = [...columns.keys()].sort((a, b) => a - b);
  for (const col of sortedCols) {
    const colNodes = columns.get(col) || [];
    const colWidth = Math.max(...colNodes.map((n) => n.width || 140));
    xPositions.set(col, xCursor);
    xCursor += colWidth + nodesep;
  }

  for (const col of sortedCols) {
    const colNodes = (columns.get(col) || []).slice();
    colNodes.sort((a, b) => {
      const ra = rows.get(a.name) ?? 0;
      const rb = rows.get(b.name) ?? 0;
      if (ra !== rb) return ra - rb;
      return a.order - b.order;
    });

    let yCursor = 70;
    let previousRow = 0;
    let previousHeight = 0;

    for (const node of colNodes) {
      const nodeRow = rows.get(node.name) ?? 0;
      const gapUnits = yCursor > 70 ? Math.max(1, nodeRow - previousRow) : Math.max(1, nodeRow + 1);
      if (yCursor === 70) {
        yCursor = 70 + nodeRow * Math.max(40, ranksep * 0.5);
      } else {
        yCursor += previousHeight + gapUnits * Math.max(40, ranksep * 0.45);
      }
      node.x = xPositions.get(col) ?? 40;
      node.y = yCursor;
      previousRow = nodeRow;
      previousHeight = node.height;
    }
  }
}

function makeEdgeStyle(token) {
  const base = [
    'edgeStyle=orthogonalEdgeStyle',
    'rounded=0',
    'orthogonalLoop=1',
    'jettySize=auto',
    'html=1',
    'strokeColor=#000000',
    'fontColor=#000000',
  ];

  const t = normalizeRelationToken(token);
  if (t === '..>') {
    base.push('dashed=1', 'dashPattern=8 8', 'endArrow=classic', 'endFill=1');
  } else if (t === '-->') {
    base.push('endArrow=classic', 'endFill=1');
  } else if (t === '*--') {
    base.push('startArrow=diamondThin', 'startFill=1', 'endArrow=none');
  } else if (t === 'o--') {
    base.push('startArrow=diamondThin', 'startFill=0', 'endArrow=none');
  } else if (t === '--|>') {
    base.push('endArrow=block', 'endFill=0');
  } else if (t === '..|>') {
    base.push('dashed=1', 'dashPattern=8 8', 'endArrow=block', 'endFill=0');
  } else {
    base.push('endArrow=none');
  }

  return `${base.join(';')};`;
}

function inferRelationLabel(token) {
  const t = normalizeRelationToken(token);
  if (t === '..>') return 'dependency';
  if (t === '-->' || t === '--') return 'association';
  if (t === '*--') return 'composition';
  if (t === 'o--') return 'aggregation';
  if (t === '--|>') return 'inheritance';
  if (t === '..|>') return 'realization';
  return '';
}

function buildDiagramXml(parsed) {
  const { title, ranksep, nodesep, direction, nodes, relations } = parsed;

  // First pass: compute node sizes.
  for (const node of nodes.values()) {
    const { width, height } = buildNodeHtml(node);
    node.width = width;
    node.height = height;
  }

  resolveLayout(nodes, relations, ranksep, nodesep, direction);

  /** @type {string[]} */
  const cells = [];
  cells.push(`<mxCell id="0"/>`);
  cells.push(`<mxCell id="1" parent="0"/>`);

  /** @type {Map<string,string>} */
  const nodeIds = new Map();
  let currentId = 2;

  let maxRight = 0;
  let maxBottom = 0;

  const titleWidth = Math.max(280, title.length * 8);
  cells.push(
    `<mxCell id="${currentId}" value="${xmlAttrEscape(htmlEscape(title))}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=20;fontStyle=1;" vertex="1" parent="1">` +
      `<mxGeometry x="40" y="18" width="${titleWidth}" height="28" as="geometry"/>` +
      `</mxCell>`,
  );
  currentId++;

  const nodeStyle =
    'shape=rectangle;rounded=0;html=1;whiteSpace=wrap;overflow=fill;align=left;verticalAlign=top;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;spacing=0;';

  const sortedNodes = [...nodes.values()].sort((a, b) => a.order - b.order);
  for (const node of sortedNodes) {
    nodeIds.set(node.name, String(currentId));
    const { html, width, height } = buildNodeHtml(node);
    node.width = width;
    node.height = height;
    const x = node.x;
    const y = node.y;

    cells.push(
      `<mxCell id="${currentId}" value="${xmlAttrEscape(html)}" style="${nodeStyle}" vertex="1" parent="1">` +
        `<mxGeometry x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" as="geometry"/>` +
        `</mxCell>`,
    );
    currentId++;
    maxRight = Math.max(maxRight, x + width);
    maxBottom = Math.max(maxBottom, y + height);
  }

  for (const rel of relations) {
    if (rel.hidden) continue;
    const srcId = nodeIds.get(rel.source);
    const dstId = nodeIds.get(rel.target);
    if (!srcId || !dstId) continue;

    const style = makeEdgeStyle(rel.token);
    // Teacher requirement: every relationship arrow must have a label.
    // Export rule: label shows ONLY the relation type (dependency/association/...).
    // Ignore any explicit label text in the source .puml to avoid showing API names.
    const inferred = inferRelationLabel(rel.token);
    const rawLabel = inferred || 'relation';
    const value = xmlAttrEscape(htmlEscape(rawLabel));
    cells.push(
      `<mxCell id="${currentId}" value="${value}" style="${style}" edge="1" parent="1" source="${srcId}" target="${dstId}">` +
        `<mxGeometry relative="1" as="geometry"/>` +
        `</mxCell>`,
    );
    currentId++;
  }

  const pageWidth = Math.max(1920, Math.floor(maxRight + 120));
  const pageHeight = Math.max(1080, Math.floor(maxBottom + 120));

  const root = `<root>${cells.join('')}</root>`;
  const mxGraph =
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">` +
    root +
    `</mxGraphModel>`;

  return mxGraph;
}

function buildMxFileSingle(pageName, mxGraphModelXml) {
  const diagramId = uuid12();
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile host="app.diagrams.net" modified="2026-03-23T00:00:00.000Z" agent="puml_to_drawio.mjs" version="26.0.11" compressed="false">` +
    `<diagram id="${diagramId}" name="${xmlAttrEscape(pageName)}">` +
    mxGraphModelXml +
    `</diagram>` +
    `</mxfile>`
  );
}

function buildMxFileMaster(pages) {
  // pages: {name, mxGraphModelXml}[]
  const diagrams = pages
    .map(
      (p) =>
        `<diagram id="${uuid12()}" name="${xmlAttrEscape(p.name)}">${p.mxGraphModelXml}</diagram>`,
    )
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile host="app.diagrams.net" modified="2026-03-23T00:00:00.000Z" agent="puml_to_drawio.mjs" version="26.0.11" compressed="false">` +
    diagrams +
    `</mxfile>`
  );
}

function listPumlFiles(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    const out = [];
    const entries = fs.readdirSync(inputPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.puml')) out.push(path.join(inputPath, e.name));
    }
    out.sort();
    return out;
  }
  return [inputPath];
}

function defaultOutputDir(cwd) {
  // Match the provided sample: ROOT.parent / "drawio-class-diagram"
  return path.resolve(cwd, '..', 'drawio-class-diagram');
}

function convertAll(inputs, outDir, overwrite, writeMaster, onlyCompact) {
  const pumlFiles = [];
  for (const input of inputs) {
    for (const f of listPumlFiles(input)) {
      if (f.toLowerCase().endsWith('.puml')) pumlFiles.push(f);
    }
  }
  const filtered = onlyCompact
    ? pumlFiles.filter((f) => path.basename(f).toLowerCase().endsWith('_compact.puml'))
    : pumlFiles;
  filtered.sort();

  fs.mkdirSync(outDir, { recursive: true });

  let converted = 0;
  const pages = [];

  for (const file of filtered) {
    const parsed = parsePumlFile(file);
    const mxGraph = buildDiagramXml(parsed);
    pages.push({ name: path.basename(file, '.puml'), mxGraphModelXml: mxGraph });

    const outPath = path.join(outDir, `${path.basename(file, '.puml')}.drawio`);
    if (!overwrite && fs.existsSync(outPath)) continue;
    const xml = buildMxFileSingle(path.basename(file, '.puml'), mxGraph);
    fs.writeFileSync(outPath, xml, 'utf8');
    converted++;
  }

  if (writeMaster && pages.length) {
    const masterPath = path.join(outDir, 'all-class-diagrams.drawio');
    if (overwrite || !fs.existsSync(masterPath)) {
      fs.writeFileSync(masterPath, buildMxFileMaster(pages), 'utf8');
    }
  }

  return { converted, total: filtered.length };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error(
      'Usage: node puml_to_drawio.mjs <file-or-dir> [more...] [--out-dir DIR] [--overwrite] [--no-master] [--only-compact]',
    );
    process.exit(2);
  }

  let outDir = '';
  let overwrite = false;
  let writeMaster = true;
  let onlyCompact = false;
  const inputs = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out-dir') {
      outDir = args[i + 1] || '';
      i++;
      continue;
    }
    if (a === '--overwrite') {
      overwrite = true;
      continue;
    }
    if (a === '--no-master') {
      writeMaster = false;
      continue;
    }
    if (a === '--only-compact') {
      onlyCompact = true;
      continue;
    }
    inputs.push(a);
  }

  const resolvedOutDir = outDir ? path.resolve(outDir) : defaultOutputDir(process.cwd());
  const { converted, total } = convertAll(inputs, resolvedOutDir, overwrite, writeMaster, onlyCompact);
  console.log(`Converted ${converted} file(s) (found ${total} .puml) -> ${resolvedOutDir}`);
}

main();
