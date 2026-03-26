import fs from 'node:fs';

const files = fs
  .readdirSync('.', { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('_compact.puml'))
  .map((e) => e.name)
  .sort();

const START_RE = /^\s*(class|interface|abstract\s+class|enum)\s+([A-Za-z_][\w.]*)\s*\{\s*$/;

function analyzeFile(text) {
  const lines = text.split(/\r?\n/);
  const ellipses = lines.filter((l) => l.trim() === '...').length;

  let i = 0;
  let classes = 0;
  let maxMembers = 0;
  let maxClass = null;

  while (i < lines.length) {
    const m = lines[i].match(START_RE);
    if (!m) {
      i++;
      continue;
    }

    const kind = m[1].trim();
    const isEnum = kind.startsWith('enum');
    const name = m[2];

    classes++;
    i++;

    let members = 0;
    while (i < lines.length && (lines[i] ?? '').trim() !== '}') {
      const t = (lines[i] ?? '').trim();
      if (t && t !== '--' && t !== '...' && !t.startsWith("'")) members++;
      i++;
    }

    if (!isEnum && members > maxMembers) {
      maxMembers = members;
      maxClass = name;
    }

    i++; // skip closing brace
  }

  return { ellipses, classes, maxMembers, maxClass };
}

const results = files.map((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return { file: f, ...analyzeFile(t) };
});

results.sort((a, b) => b.maxMembers - a.maxMembers);

console.log('Top by largest class member-count:');
for (const r of results.slice(0, 10)) {
  console.log(
    `${r.file} | classes=${r.classes} ellipses=${r.ellipses} maxMembers=${r.maxMembers} (${r.maxClass})`,
  );
}

const suspicious = results.filter((r) => r.ellipses === 0 && r.maxMembers >= 8);
console.log(`\nSuspicious (no ellipsis, maxMembers>=8): ${suspicious.length}`);
for (const r of suspicious) {
  console.log(`${r.file} | maxMembers=${r.maxMembers} (${r.maxClass})`);
}
